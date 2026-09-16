const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { createNotification } = require("./notification.controller");
const { calculateShipping } = require("./shipping.controller");

const percentDelta = (curr, prev) => {
  if (!prev) return curr > 0 ? 100 : 0;
  if (!curr) return -100;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round(n * 100) / 100;

// Date-range policy: date-only values from the picker (e.g. "2026-09-09") are
// interpreted as UTC calendar days. Order timestamps are stored as UTC, so a
// selected "Sep 9" window begins at 2026-09-09T00:00:00.000Z and a selected
// "Sep 10" ends at 2026-09-11T00:00:00.000Z (inclusive end). One consistent
// boundary set is used for the stat cards, revenue series and recent orders.
const utcMidnight = (iso) => new Date(`${iso}T00:00:00.000Z`);

const isoWeekInfo = (d) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dow); // Thursday of the current ISO week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / DAY_MS + 1) / 7);
  return { year: date.getUTCFullYear(), week };
};

const mondayOfIsoWeek = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4)); // 4 Jan is always in ISO week 1
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = jan4.getTime() - (jan4Dow - 1) * DAY_MS;
  return new Date(week1Monday + (week - 1) * 7 * DAY_MS);
};

const bucketKey = (d, granularity) => {
  const y = d.getUTCFullYear();
  if (granularity === "daily") return `${y}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  if (granularity === "monthly") return `${y}-${pad2(d.getUTCMonth() + 1)}`;
  const iso = isoWeekInfo(d);
  return `${iso.year}-W${pad2(iso.week)}`;
};

const labelForKey = (key, granularity) => {
  const short = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (granularity === "daily") return short(new Date(key + "T00:00:00Z"));
  if (granularity === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short" });
  }
  const [y, w] = [Number(key.slice(0, 4)), Number(key.slice(6))];
  return short(mondayOfIsoWeek(y, w));
};

// Builds a contiguous (zero-filled) revenue/order series over [start, end)
// bucketed at a granularity that fits the range length.
const buildRevenueSeries = (docs, granularity, start, end) => {
  const keys = [];
  const byKey = new Map();
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  // Don't floor `end`: it may be "now" mid-day, and the last (partial) day
  // must still get a bucket so the chart covers the same days as the table.
  const last = new Date(end);
  while (cursor.getTime() < last.getTime()) {
    const key = bucketKey(cursor, granularity);
    if (!byKey.has(key)) {
      byKey.set(key, { label: labelForKey(key, granularity), revenue: 0, orders: 0 });
      keys.push(key);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const doc of docs) {
    const bucket = byKey.get(bucketKey(new Date(doc.createdAt), granularity));
    if (bucket) {
      bucket.revenue += Number(doc.totalPrice) || 0;
      bucket.orders += 1;
    }
  }
  return keys.map((k) => byKey.get(k));
};

const getAnalytics = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const now = new Date();

    // Resolve the active window: an explicit custom range wins over the preset.
    const sDate = req.query.startDate ? utcMidnight(req.query.startDate) : null;
    const eDate = req.query.endDate ? utcMidnight(req.query.endDate) : null;
    let currentStart;
    let currentEnd;
    if (sDate && !isNaN(sDate) && eDate && !isNaN(eDate)) {
      currentStart = sDate;
      currentEnd = new Date(eDate.getTime() + DAY_MS); // endDate is inclusive → [start, end+1day)
    } else {
      currentStart = new Date(now.getTime() - days * DAY_MS);
      currentEnd = now;
    }
    if (currentStart.getTime() >= currentEnd.getTime()) {
      currentEnd = new Date(currentStart.getTime() + DAY_MS);
    }
    if (currentEnd.getTime() > now.getTime()) currentEnd = now;

    const rangeMs = currentEnd.getTime() - currentStart.getTime();
    const prevStart = new Date(currentStart.getTime() - rangeMs);
    const rangeDays = Math.round(rangeMs / DAY_MS);
    const granularity = rangeDays <= 32 ? "daily" : rangeDays <= 140 ? "weekly" : "monthly";

    const nonCancelled = { status: { $nin: ["cancelled"] } };
    // Revenue only counts orders whose payment was actually confirmed by an
    // admin (Processing/Shipped/Delivered). Pending-Payment-Verification and
    // cancelled orders are excluded so totals stay accurate.
    const paidConfirmed = { status: { $in: ["processing", "shipped", "delivered"] } };
    const activeProduct = { isActive: true };
    const inRange = { createdAt: { $gte: currentStart, $lt: currentEnd } };
    const inPrev = { createdAt: { $gte: prevStart, $lt: currentStart } };

    const [
      totalOrders,
      totalProducts,
      totalCustomers,
      lowStock,
      revenueAgg,
      prevOrders,
      prevRevenueAgg,
      productsNew,
      productsPrev,
      customersAtPrevStart,
      statusBreakdown,
      stockSummary,
      recentOrderDocs,
      seriesDocs,
    ] = await Promise.all([
      Order.countDocuments(inRange),
      Product.countDocuments(activeProduct),
      // Total Customers is a running total of registered accounts (not
      // date-filtered): excludes nobody, since admins also buy here. The
      // period-to-period delta is derived from the running total instead.
      User.countDocuments({}),
      Product.countDocuments({ ...activeProduct, stock: { $lt: 5 } }),
      Order.aggregate([
        { $match: { ...paidConfirmed, ...inRange } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
      Order.countDocuments(inPrev),
      Order.aggregate([
        { $match: { ...paidConfirmed, ...inPrev } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
      Product.countDocuments({ ...activeProduct, ...inRange }),
      Product.countDocuments({ ...activeProduct, ...inPrev }),
      User.countDocuments({ createdAt: { $lt: currentStart } }),
      Order.aggregate([{ $match: inRange }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Product.aggregate([
        { $match: activeProduct },
        {
          $group: {
            _id: null,
            inStock: { $sum: { $cond: [{ $gte: ["$stock", 5] }, 1, 0] } },
            lowStock: {
              $sum: { $cond: [{ $and: [{ $lt: ["$stock", 5] }, { $gt: ["$stock", 0] }] }, 1, 0] },
            },
            outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
          },
        },
      ]),
      Order.find(inRange).sort({ createdAt: -1 }).limit(8).select("-__v").lean(),
      Order.find({ ...paidConfirmed, ...inRange }).select({ createdAt: 1, totalPrice: 1 }).lean(),
    ]);

    const revenue = revenueAgg.length ? revenueAgg[0].total : 0;
    const prevRevenue = prevRevenueAgg.length ? prevRevenueAgg[0].total : 0;
    const stock = stockSummary.length ? stockSummary[0] : { inStock: 0, lowStock: 0, outOfStock: 0 };
    const revenueSeries = buildRevenueSeries(seriesDocs, granularity, currentStart, currentEnd);

    // Avg. Order Value = revenue / all orders in the period (mirrors the two
    // parent cards). Guard against division-by-zero when there are no orders.
    const aov = totalOrders > 0 ? round2(revenue / totalOrders) : 0;
    const prevAov = prevOrders > 0 ? round2(prevRevenue / prevOrders) : 0;
    const customersAdded = totalCustomers - customersAtPrevStart;

    const stats = [
      {
        key: "orders",
        label: "Total Orders",
        value: totalOrders,
        delta: percentDelta(totalOrders, prevOrders),
        prev: prevOrders,
        periodAdd: totalOrders,
      },
      {
        key: "revenue",
        label: "Total Revenue",
        value: revenue,
        delta: percentDelta(revenue, prevRevenue),
        prev: prevRevenue,
        periodAdd: revenue,
        currency: true,
      },
      {
        key: "avgOrderValue",
        label: "Avg. Order Value",
        value: aov,
        delta: percentDelta(aov, prevAov),
        prev: prevAov,
        periodAdd: aov,
        currency: true,
      },
      {
        key: "customers",
        label: "Total Customers",
        value: totalCustomers,
        delta: percentDelta(totalCustomers, customersAtPrevStart),
        prev: customersAtPrevStart,
        periodAdd: customersAdded,
      },
      {
        key: "products",
        label: "Total Products",
        value: totalProducts,
        delta: percentDelta(productsNew, productsPrev),
        prev: productsPrev,
        periodAdd: productsNew,
      },
      { key: "lowStock", label: "Low Stock Alerts", value: lowStock, delta: 0, prev: 0, periodAdd: lowStock },
    ];

    res.json({
      stats,
      statusBreakdown,
      stockSummary: stock,
      granularity,
      revenueSeries,
      recentOrders: recentOrderDocs,
    });
  } catch (err) {
    console.error("[getAnalytics] error:", err);
    res.status(500).json({ message: "Something went wrong loading analytics." });
  }
};

const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
    const query = {};

    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      query.$or = [{ orderNumber: new RegExp(q, "i") }, { customerName: new RegExp(q, "i") }, { customerEmail: new RegExp(q, "i") }];
    }

    const total = await Order.countDocuments(query);
    let ordersPromise = Order.find(query).sort({ createdAt: -1 }).select("-__v");
    if (limit > 0) ordersPromise = ordersPromise.skip((page - 1) * limit).limit(limit);
    const orders = await ordersPromise;

    res.json({ orders, total, page, limit });
  } catch (err) {
    console.error("[getOrders] error:", err);
    res.status(500).json({ message: "Something went wrong loading orders." });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    // Customers may only ever see their own orders; admins can view any order.
    if (
      req.user.role !== "admin" &&
      String(order.customer) !== String(req.user._id)
    ) {
      return res.status(403).json({ message: "You are not allowed to view this order." });
    }
    res.json(order);
  } catch (err) {
    console.error("[getOrderById] error:", err);
    res.status(500).json({ message: "Something went wrong loading the order." });
  }
};

const createOrder = async (req, res) => {
  try {
    const num = (v) => (v === undefined || v === "" ? 0 : Number(v));
    const parseJson = (v, fb) =>
      v === undefined || v === "" ? fb : typeof v === "string" ? JSON.parse(v) : v;

    // Multipart (screenshot upload) sends string fields; JSON sends native values.
    const body = req.body;
    const rest = { ...body };
    delete rest.items;
    delete rest.itemsPrice;
    delete rest.shippingPrice;
    delete rest.taxPrice;
    delete rest.totalPrice;
    delete rest.shippingAddress;
    delete rest.status;
    delete rest.paymentMethod;
    delete rest.proofOfPayment;
    delete rest.khqrMd5;

    const items = Array.isArray(body.items) ? body.items : parseJson(body.items, []);
    const itemsPrice = num(body.itemsPrice);
    const taxPrice = num(body.taxPrice);
    const shippingAddress = parseJson(body.shippingAddress, {});
    // Shipping and grand total are always computed here, server-side, from the
    // admin-configured rule — never trusted from the client.
    const shippingPrice = await calculateShipping(itemsPrice);
    const totalPrice = round2(itemsPrice + shippingPrice + taxPrice);
    const paymentMethod = body.paymentMethod || "bank_transfer";
    // A KHQR payment carries the transaction md5 hash; since Bakong already
    // confirmed the transfer online, the order can be marked paid immediately
    // (no manual admin verification step needed).
    const paymentConfirmedOnline = paymentMethod === "khqr" || Boolean(body.khqrMd5);
    const status =
      body.status ||
      (paymentConfirmedOnline
        ? "processing"
        : paymentMethod === "bank_transfer"
          ? "pending_payment"
          : "processing");

    const incomingProof = parseJson(body.proofOfPayment, {});
    const proofOfPayment = { reference: "", note: "", screenshot: "", ...(incomingProof || {}) };
    if (paymentConfirmedOnline && body.khqrMd5) proofOfPayment.reference = body.khqrMd5;
    if (req.file) proofOfPayment.screenshot = `/uploads/payments/${req.file.filename}`;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty. Add items before checking out." });
    }

    const decremented = [];
    let saved;
    try {
      // Decrement stock first, guarding against insufficient stock.
      for (const item of items) {
        const result = await Product.updateOne(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
        if (result.matchedCount === 0) {
          const err = new Error("One or more items are out of stock. Please update your cart and try again.");
          err.code = "INSUFFICIENT_STOCK";
          throw err;
        }
        decremented.push(item);
      }

      saved = await new Order({
        ...rest,
        items,
        itemsPrice,
        shippingPrice,
        taxPrice,
        totalPrice,
        status,
        paymentMethod,
        paymentStatus: paymentConfirmedOnline ? "confirmed" : "unpaid",
        proofOfPayment,
        shippingAddress,
        ...(paymentConfirmedOnline
          ? { isPaid: true, paidAt: new Date(), paymentVerifiedAt: new Date() }
          : {}),
      }).save();
    } catch (err) {
      // Roll back stock changes if the order could not be created.
      for (const item of decremented) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
      }
      throw err;
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("new-order", { orderId: saved._id, orderNumber: saved.orderNumber });
    }
    res.status(201).json(saved);
  } catch (err) {
    console.error("[createOrder] failed:", err);
    const message =
      err.code === "INSUFFICIENT_STOCK"
        ? err.message
        : "Something went wrong processing your order. Please try again.";
    res.status(400).json({ message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const fields = { ...req.body };
    if (fields.status === "delivered") {
      fields.isPaid = true;
      fields.paidAt = fields.paidAt || new Date();
    }
    const prev = await Order.findById(req.params.id);
    if (!prev) return res.status(404).json({ message: "Order not found" });

    const order = await Order.findByIdAndUpdate(req.params.id, fields, {
      new: true,
      runValidators: true,
    });

    // Admin refund/cancel: alert the customer in real time so the bell updates.
    if (order && fields.status === "cancelled" && prev.status !== "cancelled") {
      const message = `Your refund for order ${order.orderNumber} has been processed.`;
      const notification = await createNotification({
        recipient: order.customer,
        type: "order_status",
        message,
        order: order._id,
        orderNumber: order.orderNumber,
      });
      const io = req.app.get("io");
      if (io) io.to(`user:${String(order.customer)}`).emit("notification", { notification });
    }

    res.json(order);
  } catch (err) {
    console.error("[updateOrder] error:", err);
    res.status(400).json({ message: "Could not update this order. Please try again." });
  }
};

// Manually verify the bank-transfer proof attached to an order.
const verifyPayment = async (req, res) => {
  const { action, reason } = req.body;
  if (!["confirm", "reject"].includes(action)) {
    return res.status(400).json({ message: "Invalid verification action." });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: "This order is not awaiting payment verification." });
    }

    if (action === "confirm") {
      order.status = "processing";
      order.isPaid = true;
      order.paidAt = order.paidAt || new Date();
      order.paymentStatus = "confirmed";
      order.paymentVerifiedAt = new Date();
      order.paymentRejectReason = "";
      await order.save();

      const message = `Your payment for order ${order.orderNumber} has been confirmed! Your order is now being processed.`;
      const notification = await createNotification({
        recipient: order.customer,
        type: "payment_confirmed",
        message,
        order: order._id,
        orderNumber: order.orderNumber,
      });
      const io = req.app.get("io");
      if (io) io.to(`user:${String(order.customer)}`).emit("notification", { notification });

      return res.json(order);
    }

    // Reject: cancel the order and return reserved stock to inventory.
    order.status = "cancelled";
    order.paymentStatus = "rejected";
    order.paymentRejectReason = (reason || "").trim();
    order.paymentVerifiedAt = new Date();
    if (!order.paymentRejectReason) order.paymentRejectReason = "Payment could not be verified";
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
    }
    await order.save();

    const rejectReason = order.paymentRejectReason;
    const message =
      `There was an issue verifying your payment for order ${order.orderNumber}.` +
      (rejectReason && rejectReason !== "Payment could not be verified"
        ? ` Reason: ${rejectReason}`
        : " Please contact support or try again.");
    const notification = await createNotification({
      recipient: order.customer,
      type: "payment_rejected",
      message,
      order: order._id,
      orderNumber: order.orderNumber,
    });
    const io = req.app.get("io");
    if (io) io.to(`user:${String(order.customer)}`).emit("notification", { notification });

    res.json(order);
  } catch (err) {
    console.error("[verifyPayment] error:", err);
    res.status(400).json({ message: "Could not verify this payment. Please try again." });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted" });
  } catch (err) {
    console.error("[deleteOrder] error:", err);
    res.status(500).json({ message: "Something went wrong deleting the order." });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const [totalOrders, revenue, pendingVerification] = await Promise.all([
      Order.countDocuments({}),
      Order.aggregate([
        { $match: { status: { $in: ["processing", "shipped", "delivered"] } } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
      Order.countDocuments({ status: "pending_payment" }),
    ]);

    res.json({
      totalOrders,
      revenue: revenue.length ? revenue[0].total : 0,
      pendingOrders: pendingVerification,
    });
  } catch (err) {
    console.error("[getOrderStats] error:", err);
    res.status(500).json({ message: "Something went wrong loading order stats." });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
    const query = { customer: req.user._id };
    const total = await Order.countDocuments(query);
    let ordersPromise = Order.find(query).sort({ createdAt: -1 }).select("-__v");
    if (limit > 0) ordersPromise = ordersPromise.skip((page - 1) * limit).limit(limit);
    const orders = await ordersPromise;
    res.json({ orders, total, page, limit });
  } catch (err) {
    console.error("[getMyOrders] error:", err);
    res.status(500).json({ message: "Something went wrong loading your orders." });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  verifyPayment,
  deleteOrder,
  getOrderStats,
  getMyOrders,
  getAnalytics,
};
