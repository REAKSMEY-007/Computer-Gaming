const axios = require("axios");
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");
const Order = require("../models/Order");
const { createNotification } = require("./notification.controller");

const KHQR_VALIDITY_MS = 15 * 60 * 1000; // dynamic KHQR expires after 15 minutes

// BAKONG_API_URL is a switchable base that may be set to either the API root
// ("https://api-bakong.nbc.gov.kh") or the full verify endpoint
// ("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5"); both forms are
// normalised below so the request URLs always come out correct.
const BAKONG_API_URL = (
  process.env.BAKONG_API_URL || "https://api-bakong.nbc.gov.kh"
)
  .trim()
  .replace(/\/+$/, "");

const BAKONG_CHECK_MD5_URL = /\/v1\/check_transaction_by_md5$/i.test(BAKONG_API_URL)
  ? BAKONG_API_URL
  : `${BAKONG_API_URL}/v1/check_transaction_by_md5`;

const BAKONG_CHECK_TRANSACTION_ID_URL = BAKONG_CHECK_MD5_URL.replace(
  /check_transaction_by_md5$/i,
  "check_transaction_by_transactionID"
);

const BAKONG_OPTS = {
  headers: {
    Authorization: `Bearer ${process.env.BAKONG_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
};

// Dev fallback: a real-account KHQR cannot be verified with a sandbox-only
// developer token, so during local development 401/404 responses from Bakong
// are treated as an accepted payment to keep the checkout flow testable.
const isDevBypassAllowed = () =>
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_DEV_PAYMENT_BYPASS === "true";

// Resolves the order behind a verification attempt: explicit orderId wins, then
// fall back to correlating by the stored Bakong reference.
const resolveOrder = async ({ orderId, md5, transactionId } = {}) => {
  let order = orderId && (await Order.findById(orderId));
  if (!order && md5) order = await Order.findOne({ khqrMd5: String(md5).trim() });
  if (!order && transactionId) {
    order = await Order.findOne({ khqrTransactionId: String(transactionId).trim() });
  }
  return order;
};

// Shared: flips a found order to its paid/processing state, persists the Bakong
// reference and pushes a real-time confirmation to the customer.
const markOrderPaid = async (order, io, { md5, transactionId } = {}) => {
  if (order.isPaid) return false;

  order.status = "processing";
  order.paymentStatus = "confirmed";
  order.isPaid = true;
  order.paidAt = order.paidAt || new Date();
  order.paymentVerifiedAt = new Date();
  if (md5) order.khqrMd5 = String(md5).trim();
  if (transactionId) order.khqrTransactionId = String(transactionId).trim();
  order.proofOfPayment = {
    ...(order.proofOfPayment || {}),
    reference:
      (transactionId && String(transactionId).trim()) ||
      (md5 && String(md5).trim()) ||
      order.proofOfPayment?.reference ||
      "",
    note: "Paid via Bakong KHQR",
  };
  await order.save();

  const notification = await createNotification({
    recipient: order.customer,
    type: "payment_confirmed",
    message: `Your payment for order ${order.orderNumber} was received and verified automatically. Your order is now being processed.`,
    order: order._id,
    orderNumber: order.orderNumber,
  }).catch(() => null);
  if (io && notification) {
    io.to(`user:${String(order.customer)}`).emit("notification", { notification });
  }
  return true;
};

// POST /api/payment/generate-khqr
// Body: { amount, currency = "USD", billNumber }
// Returns: { success, qrString, md5, expiresAt, currency }
const generateKhqr = async (req, res) => {
  try {
    const { amount, billNumber } = req.body || {};

    // Always embed the exact amount into the QR so users never type it manually.
    // Defaults to $48.73 when no amount is provided.
    const rawAmount = amount == null || amount === "" ? 48.73 : amount;
    const parsedAmount = parseFloat(Number(rawAmount).toFixed(2));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "A valid positive amount is required." });
    }

    // Dynamic KHQR payload (amount is mandatory for embedding payment total).
    const optionalData = {
      currency: khqrData.currency.usd, // 840 = USD, required for ABA/ACLEDA Mobile
      amount: parsedAmount,
      mobileNumber: process.env.BAKONG_MERCHANT_MOBILE || "85516526595",
      storeLabel: "Computer Store",
      terminalLabel: "Online Checkout",
      billNumber: String(billNumber || `INV-${Date.now()}`),
      expirationTimestamp: Date.now() + KHQR_VALIDITY_MS, // required for dynamic (amount-bearing) KHQR
    };

    // Use robust fallbacks if .env keys are missing or malformed
    const accountId = process.env.BAKONG_ACCOUNT_ID || "duong_reaksmey@bkrt";
    const merchantName =
      process.env.BAKONG_MERCHANT_NAME || "REAKSHEY Duong";
    const merchantCity = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";

    // NOTE: IndividualInfo(bakongAccountID, merchantName, merchantCity, optionalData)
    // Passing extra args shifts the payload and silently discards amount/currency/billNumber.
    const individualInfo = new IndividualInfo(
      accountId,
      merchantName,
      merchantCity,
      optionalData
    );

    const khqr = new BakongKHQR();
    const response = khqr.generateIndividual(individualInfo);

    if (response && response.status && response.status.code === 0) {
      return res.status(200).json({
        success: true,
        data: {
          qrString: response.data.qr,
          md5: response.data.md5,
        },
        expiresAt: Date.now() + KHQR_VALIDITY_MS,
        currency: "USD",
      });
    }

    console.error("Bakong SDK Internal Status Error:", response);
    return res.status(400).json({
      success: false,
      message: response?.status?.message || "Failed to generate KHQR string",
    });
  } catch (error) {
    console.error("Bakong KHQR Exception Error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not generate the payment QR code",
      error: error.message,
    });
  }
};

// POST /api/payment/verify-md5
// Body: { md5 }
// Returns: { success, status: "PAID" | "PENDING", responseCode }
const verifyMd5 = async (req, res) => {
  const { md5 } = req.body || {};

  if (!md5 || typeof md5 !== "string" || !md5.trim()) {
    return res.status(400).json({ success: false, message: "md5 is required." });
  }

  try {
    const { data } = await axios.post(
      BAKONG_CHECK_MD5_URL,
      { md5: md5.trim() },
      BAKONG_OPTS
    );

    const status = data?.responseCode === 0 ? "PAID" : "PENDING";
    res.json({ success: true, status, responseCode: data?.responseCode });
  } catch (err) {
    console.error(
      "Bakong check_transaction_by_md5 error:",
      err.response?.data || err.message
    );
    res.status(502).json({
      success: false,
      message:
        err.response?.data?.responseMessage ||
        err.response?.data?.message ||
        "Bakong payment verification failed.",
    });
  }
};

// POST /api/payments/verify-khqr
// Body: { md5 } | { transactionId }, optionally { orderId } to pin the order.
// Returns:
//   { status: "SUCCESS", orderId, orderNumber } — Bakong confirmed the transfer
//   { status: "PENDING" }                        — transaction not settled yet
const verifyKhqr = async (req, res) => {
  const { md5, transactionId, orderId } = req.body || {};

  if (!md5 && !transactionId) {
    return res
      .status(400)
      .json({ status: "PENDING", message: "md5 or transactionId is required." });
  }

  try {
    let bakong;
    if (md5 && String(md5).trim()) {
      ({ data: bakong } = await axios.post(
        BAKONG_CHECK_MD5_URL,
        { md5: String(md5).trim() },
        BAKONG_OPTS
      ));
    } else {
      ({ data: bakong } = await axios.post(
        BAKONG_CHECK_TRANSACTION_ID_URL,
        { transactionId: String(transactionId).trim() },
        BAKONG_OPTS
      ));
    }

    // Bakong reports a settled transfer with response code 0 (the field is
    // surfaced as `errorCode` on the raw wire payload, `responseCode` when the
    // SDK shapes it) — treat either as success.
    const paidCode =
      bakong?.errorCode != null ? Number(bakong.errorCode) : Number(bakong?.responseCode);
    if (paidCode !== 0) {
      return res.json({ status: "PENDING" });
    }

    // Persist the Bakong reference on the order the first time we see it so a
    // later md5-only lookup can resolve the order without an explicit orderId.
    if (orderId && md5) {
      await Order.updateOne(
        { _id: orderId, khqrMd5: { $in: ["", null] } },
        { $set: { khqrMd5: String(md5).trim() } }
      );
    }

    const order = await resolveOrder({ orderId, md5, transactionId });

    if (!order) {
      return res.json({
        status: "SUCCESS",
        orderId: orderId || null,
        message: "Payment was received but the matching order could not be found.",
      });
    }

    await markOrderPaid(order, req.app.get("io"), { md5, transactionId });

    return res.json({
      status: "SUCCESS",
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    const httpStatus = err.response?.status;

    // A sandbox-only developer token cannot verify a real merchant QR. Log it
    // clearly and, when running locally, fall back to marking the order paid so
    // development/testing can still exercise the full checkout → success flow.
    if (httpStatus === 401 || httpStatus === 404) {
      console.warn(
        `[Bakong API] Production transaction not found via Sandbox API token. (HTTP ${httpStatus})`
      );

      if (!isDevBypassAllowed()) {
        return res.status(502).json({
          status: "PENDING",
          message:
            err.response?.data?.responseMessage ||
            err.response?.data?.message ||
            "Bakong payment verification failed.",
        });
      }

      console.warn(
        "[Bakong API] Dev payment bypass enabled — marking order as paid for local testing."
      );
      const order = await resolveOrder({ orderId, md5, transactionId });
      if (!order) {
        return res.json({
          status: "SUCCESS",
          orderId: orderId || null,
          message: "Dev payment bypass: no matching order found to mark paid.",
        });
      }
      await markOrderPaid(order, req.app.get("io"), { md5, transactionId });
      return res.json({
        status: "SUCCESS",
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
    }

    console.error(
      "[verifyKhqr] Bakong check error:",
      err.response?.data || err.message
    );
    // Surrender the response to the poller so it simply retries on transient
    // network/Bakong errors instead of failing the checkout flow.
    return res.status(502).json({
      status: "PENDING",
      message:
        err.response?.data?.responseMessage ||
        err.response?.data?.message ||
        "Bakong payment verification failed.",
    });
  }
};

module.exports = { generateKhqr, verifyMd5, verifyKhqr };