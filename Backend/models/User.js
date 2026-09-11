const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
    },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);