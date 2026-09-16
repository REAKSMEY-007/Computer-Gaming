const mongoose = require("mongoose");

const preferencesSchema = new mongoose.Schema(
  {
    // Absent until the user toggles the theme — lets the client keep using the
    // system preference until an explicit choice is made.
    themeMode: { type: String, enum: ["light", "dark"] },
  },
  { _id: false }
);

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
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);