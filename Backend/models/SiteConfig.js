const mongoose = require("mongoose");

const siteConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    siteName: { type: String, default: "Computer&Gaming", trim: true },
    logoUrl: { type: String, default: "" },
    faviconUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);

// Returns the single global site config, creating it with defaults on first access.
const getSiteConfig = async () => {
  return SiteConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { siteName: "Computer&Gaming" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = SiteConfig;
module.exports.getSiteConfig = getSiteConfig;