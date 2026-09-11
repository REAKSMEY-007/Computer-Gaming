const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { uploadProductImage } = require("../middleware/upload.middleware");
const {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  getTopSellingProducts,
  getDealProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

router.get("/", getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/top-selling", getTopSellingProducts);
router.get("/deals", getDealProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);
router.post("/", protect, adminOnly, uploadProductImage, createProduct);
router.put("/:id", protect, adminOnly, uploadProductImage, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;
