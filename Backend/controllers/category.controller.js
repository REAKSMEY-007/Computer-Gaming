const Category = require("../models/Category");
const Product = require("../models/Product");

const getAllCategories = async (req, res) => {
  try {
    const query = {};
    if (req.query.active === "true") query.isActive = true;
    const categories = await Category.find(query).sort({ parentCategory: 1, sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const slug = req.params.slug;
    const category = await Category.findOne({ slug });
    if (!category) return res.status(404).json({ message: "Category not found" });

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);

    // If the category is a parent section, include products from all its children.
    let categoryNames;
    if (!category.parentCategory) {
      const children = await Category.find({ parentCategory: category.name, isActive: true }, { name: 1 });
      categoryNames = [category.name, ...children.map((c) => c.name)];
    } else {
      categoryNames = [category.name];
    }

    const filter = { category: { $in: categoryNames }, isActive: true };
    const sort = req.query.sort === "-price" ? { price: -1 } : req.query.sort === "price" ? { price: 1 } : { createdAt: -1 };

    const total = await Product.countDocuments(filter);
    let productsPromise = Product.find(filter)
      .sort(sort)
      .select("-__v")
      .hint({ category: 1, isActive: 1 });
    if (limit > 0) productsPromise = productsPromise.skip((page - 1) * limit).limit(limit);
    const products = await productsPromise;

    res.json({ category, products, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    const saved = await category.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  getProductsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};