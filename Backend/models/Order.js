const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  image: { type: String, default: "" },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true },
    items: { type: [orderItemSchema], required: true },
    itemsPrice: { type: Number, required: true, min: 0, default: 0 },
    shippingPrice: { type: Number, min: 0, default: 0 },
    taxPrice: { type: Number, min: 0, default: 0 },
    totalPrice: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending_payment", "pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending_payment",
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "card", "khqr"],
      default: "bank_transfer",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "confirmed", "rejected"],
      default: "unpaid",
    },
    proofOfPayment: {
      reference: { type: String, trim: true, default: "" },
      note: { type: String, trim: true, default: "" },
      screenshot: { type: String, default: "" },
    },
    paymentVerifiedAt: { type: Date },
    paymentRejectReason: { type: String, trim: true, default: "" },
    shippingAddress: {
      fullName: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customer: 1 });

orderSchema.pre("validate", async function () {
  if (this.orderNumber) return;

  const Order = mongoose.model("Order");
  const db = mongoose.connection.db;

  // Find the highest existing order-number sequence so the counter never
  // collides with orders created outside this counter (e.g. seeded/manual).
  const [maxRow] = await Order.aggregate([
    { $match: { orderNumber: /^ORD-\d+$/ } },
    {
      $group: {
        _id: null,
        maxSeq: { $max: { $toInt: { $substrCP: ["$orderNumber", 4, { $subtract: [{ $strLenCP: "$orderNumber" }, 4] }] } } },
      },
    },
  ]);
  const maxSeq = maxRow?.maxSeq ?? 0;

  // Raise the counter floor if existing order numbers are ahead of it.
  await db
    .collection("counter")
    .updateOne({ key: "orderNumber" }, { $max: { seq: maxSeq } }, { upsert: true });

  // Atomically increment so concurrent checkouts always get unique numbers.
  const counter = await db
    .collection("counter")
    .findOneAndUpdate(
      { key: "orderNumber" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );

  const n = counter?.value?.seq ?? maxSeq + 1;
  this.orderNumber = `ORD-${String(n).padStart(5, "0")}`;
});

orderSchema.virtual("totalQty").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

module.exports = mongoose.model("Order", orderSchema);
