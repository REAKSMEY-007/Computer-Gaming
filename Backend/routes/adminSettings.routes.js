const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { uploadBranding } = require("../middleware/upload.middleware");
const { getConfig, updateSettings } = require("../controllers/siteConfig.controller");

router.get("/settings", protect, adminOnly, getConfig);
router.put("/settings", protect, adminOnly, uploadBranding, updateSettings);

module.exports = router;