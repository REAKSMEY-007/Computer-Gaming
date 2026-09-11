const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const {
  getMyNotifications,
  markRead,
  markAllRead,
} = require("../controllers/notification.controller");

router.get("/", protect, getMyNotifications);
router.put("/read-all", protect, markAllRead);
router.put("/:id/read", protect, markRead);

module.exports = router;