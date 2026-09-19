const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { uploadPaymentProof } = require("../middleware/upload.middleware");
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  verifyPayment,
  deleteOrder,
  clearMyOrders,
  getOrderStats,
  getMyOrders,
  getAnalytics,
} = require("../controllers/order.controller");

router.get("/", protect, adminOnly, getOrders);
router.get("/stats", protect, adminOnly, getOrderStats);
router.get("/analytics", protect, adminOnly, getAnalytics);
router.get("/mine", protect, getMyOrders);
router.delete("/mine", protect, clearMyOrders);
router.get("/:id", protect, getOrderById);
router.post("/", protect, uploadPaymentProof, createOrder);
router.put("/:id/payment", protect, adminOnly, verifyPayment);
router.put("/:id", protect, adminOnly, updateOrder);
router.delete("/:id", protect, adminOnly, deleteOrder);

module.exports = router;
