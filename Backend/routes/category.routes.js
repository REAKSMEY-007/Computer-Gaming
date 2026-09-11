const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  getProductsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

router.get("/", getAllCategories);
router.get("/slug/:slug", getCategoryBySlug);
router.get("/slug/:slug/products", getProductsByCategory);
router.get("/:id", getCategoryById);
router.post("/", protect, adminOnly, createCategory);
router.put("/:id", protect, adminOnly, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

module.exports = router;