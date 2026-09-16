const express = require("express");
const router = express.Router();
const { getPreferences, updatePreferences } = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");

router.get("/preferences", protect, getPreferences);
router.patch("/preferences", protect, updatePreferences);

module.exports = router;