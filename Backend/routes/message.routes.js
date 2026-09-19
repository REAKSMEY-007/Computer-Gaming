const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const {
  createMessage,
  getMessages,
  updateMessageStatus,
  replyMessage,
  deleteMessage,
} = require("../controllers/message.controller");

router.post("/", createMessage);
router.get("/", protect, adminOnly, getMessages);
router.patch("/:id/status", protect, adminOnly, updateMessageStatus);
router.post("/:id/reply", protect, adminOnly, replyMessage);
router.delete("/:id", protect, adminOnly, deleteMessage);

module.exports = router;