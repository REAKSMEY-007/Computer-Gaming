const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["payment_confirmed", "payment_rejected", "order_status"],
      default: "order_status",
    },
    message: { type: String, required: true, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String, trim: true, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);