const Product = require("../models/Product");
const { validateBuild } = require("../utils/buildPcValidator");

const SLOT_BY_FIELD = {
  cpuId: "cpu",
  motherboardId: "motherboard",
  ramId: "ram",
  gpuId: "gpu",
  psuId: "psu",
  caseId: "case",
  coolingId: "cooling",
};

const VALID_ID = /^[0-9a-fA-F]{24}$/;

const validatePcBuild = async (req, res) => {
  try {
    const body = req.body ?? {};

    const selection = {};
    const ids = [];
    for (const [field, slot] of Object.entries(SLOT_BY_FIELD)) {
      const value = body[field];
      if (value === null || value === undefined || value === "") {
        selection[slot] = null;
        continue;
      }
      if (typeof value !== "string" || !VALID_ID.test(value)) {
        return res.status(400).json({
          message: `Invalid ${field}: "${value}" is not a valid product id`,
        });
      }
      selection[slot] = value;
      ids.push(value);
    }

    // Single fetch for every selected component (no N sequential lookups).
    const products = await Product.find({ _id: { $in: ids }, isActive: true });
    const byId = new Map(products.map((p) => [String(p._id), p]));

    // Any id that didn't resolve is a hard error (not silently "compatible").
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return res.status(404).json({
        message: `One or more selected products were not found: ${missing.join(", ")}`,
      });
    }

    const components = {};
    for (const slot of Object.keys(selection)) {
      components[slot] = selection[slot] ? byId.get(selection[slot]) : null;
    }

    const result = validateBuild(components);
    res.json(result);
  } catch (err) {
    console.error("validatePcBuild error:", err.message);
    res.status(500).json({ message: "Internal server error validating build" });
  }
};

module.exports = { validatePcBuild };