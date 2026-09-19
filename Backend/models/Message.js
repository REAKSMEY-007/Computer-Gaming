const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, default: "General", trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["unread", "read", "replied", "archived"],
      default: "unread",
    },
    reply: {
      text: { type: String, default: "" },
      repliedAt: { type: Date },
      repliedBy: { type: String },
    },
  },
  { timestamps: true }
);

messageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);