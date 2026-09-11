const fs = require("fs");
const path = require("path");
const SiteConfig = require("../models/SiteConfig");

const rootUploads = path.join(__dirname, "..", "uploads");

const isBrandingUrl = (url) =>
  typeof url === "string" && url.startsWith("/uploads/branding/");

// Deletes an old branding logo once it has been replaced (best effort).
const removeLogoIfBranding = (url) => {
  if (!isBrandingUrl(url)) return;
  const filename = path.basename(url);
  const filePath = path.join(rootUploads, "branding", filename);
  fs.unlinkSync(filePath);
};

const getConfig = async (req, res) => {
  try {
    const cfg = await SiteConfig.getSiteConfig();
    res.json({
      siteName: cfg.siteName,
      logoUrl: cfg.logoUrl || null,
      faviconUrl: cfg.faviconUrl || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const prev = await SiteConfig.getSiteConfig();
    const set = {};

    if (req.body && typeof req.body.siteName === "string") {
      const name = req.body.siteName.trim();
      if (!name) return res.status(400).json({ message: "Site name cannot be empty" });
      if (name.length > 60)
        return res.status(400).json({ message: "Site name must be 60 characters or fewer" });
      set.siteName = name;
    }

    if (req.file) {
      set.logoUrl = `/uploads/branding/${req.file.filename}`;
      try {
        removeLogoIfBranding(prev.logoUrl);
      } catch {
        // old file already gone — ignore
      }
    }

    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const cfg = await SiteConfig.findOneAndUpdate(
      { key: "default" },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({
      siteName: cfg.siteName,
      logoUrl: cfg.logoUrl || null,
      faviconUrl: cfg.faviconUrl || null,
    });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getConfig, updateSettings };