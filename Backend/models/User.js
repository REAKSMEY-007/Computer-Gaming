const mongoose = require("mongoose");

const preferencesSchema = new mongoose.Schema(
  {
    // Absent until the user toggles the theme — lets the client keep using the
    // system preference until an explicit choice is made.
    themeMode: { type: String, enum: ["light", "dark"] },
  },
  { _id: false }
);

// Saved delivery locations, used to pre-fill checkout and let customers pick
// where an order ships. Absent until the user saves one from their profile or
// adds it inline at checkout.
const addressSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    fullName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    isDefault: { type: Boolean, default: false },
  }
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
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);