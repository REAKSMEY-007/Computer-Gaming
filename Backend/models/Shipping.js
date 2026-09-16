const mongoose = require("mongoose");

const shippingConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: true },
    flatRate: { type: Number, min: 0, default: 5.99 },
    freeShippingThreshold: { type: Number, min: 0, default: 50 },
  },
  { timestamps: true }
);

const ShippingConfig = mongoose.model("ShippingConfig", shippingConfigSchema);

// Returns the single global shipping config, creating it with defaults on first access.
const getShippingConfig = async () => {
  return ShippingConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { enabled: true, flatRate: 5.99, freeShippingThreshold: 50 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = ShippingConfig;
module.exports.getShippingConfig = getShippingConfig;