const Product = require("../models/Product");
const Category = require("../models/Category");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProductQuery = async (req) => {
  const query = req.query.includeInactive === "true" ? {} : { isActive: true };
  const { category, brand, tags, q, minPrice, maxPrice, isFeatured, isTopSelling, deals, discount, inStock } = req.query;

  if (category) {
    const cat = await Category.findOne({ name: category });
    if (cat && !cat.parentCategory) {
      const children = await Category.find({ parentCategory: category }, { name: 1 });
      query.category = { $in: [category, ...children.map((c) => c.name)] };
    } else {
      query.category = category;
    }
  }
  if (brand) query.brand = new RegExp(`^${escapeRegex(brand)}$`, "i");
  if (isFeatured !== undefined) query.isFeatured = isFeatured === "true";
  if (isTopSelling !== undefined) query.isTopSelling = isTopSelling === "true";
  if (deals === "true") query.discount = { $gt: 0 };
  if (inStock === "true") query.stock = { $gt: 0 };
  if (discount !== undefined && query.discount === undefined) {
    query.discount = { $gte: Number(discount) || 1 };
  }

  if (tags) {
    const tagList = Array.isArray(tags)
      ? tags
      : String(tags).split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length) query.tags = { $in: tagList };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
  }

  if (q) {
    const term = String(q).trim();
    if (term) {
      const qRegex = new RegExp(escapeRegex(term), "i");
      query.$or = [{ name: qRegex }, { brand: qRegex }, { category: qRegex }, { description: qRegex }];
    }
  }

  return query;
};

const buildSort = (sort) => {
  switch (sort) {
    case "price":
      return { price: 1 };
    case "-price":
      return { price: -1 };
    case "rating":
      return { rating: -1, numReviews: -1 };
    case "name":
      return { name: 1 };
    case "newest":
      return { createdAt: -1 };
    case "discount":
      return { discount: -1, rating: -1, createdAt: -1 };
    case "top-selling":
      return { isTopSelling: -1, numReviews: -1 };
    default:
      return { createdAt: -1 };
  }
};

const getAllProducts = async (req, res) => {
  try {
    const query = await buildProductQuery(req);
    const useSearch = Boolean(query.$or);
    const sort = buildSort(req.query.sort);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);

    const total = await Product.countDocuments(query);
    let productsPromise = Product.find(query).sort(sort).select("-__v");
    if (!useSearch && query.category) {
      productsPromise = productsPromise.hint({ category: 1, isActive: 1 });
    }
    if (limit > 0) {
      productsPromise = productsPromise.skip((page - 1) * limit).limit(limit);
    }
    const products = await productsPromise;

    res.json({ products, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "categoryId",
      "name slug description image"
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      isActive: true,
    })
      .populate("categoryId", "name slug description image parentCategory")
      .select("-__v");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
    const products = await Product.find({ isFeatured: true, isActive: true })
      .sort({ rating: -1, createdAt: -1 })
      .select("-__v")
      .hint({ isFeatured: 1 })
      .limit(limit);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTopSellingProducts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
    const products = await Product.find({ isTopSelling: true, isActive: true })
      .sort({ numReviews: -1, rating: -1 })
      .select("-__v")
      .hint({ isTopSelling: 1 })
      .limit(limit);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDealProducts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
    const products = await Product.find({ discount: { $gt: 0 }, isActive: true })
      .sort({ discount: -1, rating: -1, createdAt: -1 })
      .select("-__v");
    if (limit > 0) {
      products.length = Math.min(products.length, limit);
    }
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createProduct = async (req, res) => {
  const { discount, rating, stock, tags, ...rest } = req.body;
  if (req.file) {
    rest.image = `/uploads/products/${req.file.filename}`;
    rest.images = [rest.image];
  }
  const product = new Product({
    ...rest,
    tags: typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : tags,
    stock: stock !== undefined && stock !== "" ? stock : 0,
    discount: discount !== undefined && discount !== "" ? discount : 0,
    rating: rating !== undefined && rating !== "" ? rating : 0,
  });
  try {
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    if (typeof data.tags === "string") {
      data.tags = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (req.file) {
      data.image = `/uploads/products/${req.file.filename}`;
      data.images = [data.image];
    }
    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  getTopSellingProducts,
  getDealProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};