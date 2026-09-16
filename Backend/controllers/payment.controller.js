const axios = require("axios");
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");

const BAKONG_API_URL =
  process.env.BAKONG_API_URL || "https://api-bakong.nbc.gov.kh";
const KHQR_VALIDITY_MS = 15 * 60 * 1000; // dynamic KHQR expires after 15 minutes

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
      `${BAKONG_API_URL}/v1/check_transaction_by_md5`,
      { md5: md5.trim() },
      {
        headers: {
          Authorization: `Bearer ${process.env.BAKONG_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
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

module.exports = { generateKhqr, verifyMd5 };