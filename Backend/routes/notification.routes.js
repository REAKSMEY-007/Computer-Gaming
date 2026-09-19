const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const {
  getMyNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} = require("../controllers/notification.controller");

router.get("/", protect, getMyNotifications);
router.patch("/read-all", protect, markAllRead);
router.put("/read-all", protect, markAllRead);
router.patch("/:id/read", protect, markRead);
router.put("/:id/read", protect, markRead);
router.delete("/:id", protect, deleteNotification);

module.exports = router;