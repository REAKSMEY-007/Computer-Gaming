const Shipping = require("../models/Shipping");

const round2 = (n) => Math.round(n * 100) / 100;

const getShippingConfig = async (req, res) => {
  try {
    const cfg = await Shipping.getShippingConfig();
    res.json({
      enabled: cfg.enabled,
      flatRate: cfg.flatRate,
      freeShippingThreshold: cfg.freeShippingThreshold,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateShippingConfig = async (req, res) => {
  try {
    const set = {};
    const { enabled, flatRate, freeShippingThreshold } = req.body ?? {};

    // Accept both JSON booleans and string form-values ("true"/"false").
    if (typeof enabled === "boolean") set.enabled = enabled;
    else if (enabled === "true") set.enabled = true;
    else if (enabled === "false") set.enabled = false;

    if (flatRate !== undefined && flatRate !== "" && flatRate !== null) {
      const rate = Number(flatRate);
      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: "Shipping rate must be a non-negative number" });
      }
      set.flatRate = round2(rate);
    }

    if (freeShippingThreshold !== undefined && freeShippingThreshold !== "" && freeShippingThreshold !== null) {
      const threshold = Number(freeShippingThreshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return res.status(400).json({ message: "Free shipping threshold must be a non-negative number" });
      }
      set.freeShippingThreshold = round2(threshold);
    }

    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const cfg = await Shipping.findOneAndUpdate(
      { key: "default" },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({
      enabled: cfg.enabled,
      flatRate: cfg.flatRate,
      freeShippingThreshold: cfg.freeShippingThreshold,
    });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// Server-side source of truth for checkout: the client-sent totals are treated
// as untrusted and this rule always wins when an order is created.
const calculateShipping = async (subtotal) => {
  const cfg = await Shipping.getShippingConfig();
  if (!cfg.enabled) return 0;
  if (subtotal >= cfg.freeShippingThreshold) return 0;
  return round2(cfg.flatRate);
};

module.exports = { getShippingConfig, updateShippingConfig, calculateShipping };