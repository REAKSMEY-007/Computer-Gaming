const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
    },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brand: { type: String, required: true, trim: true, index: true },
    image: { type: String, required: true },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 90 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    isTopSelling: { type: Boolean, default: false },
    specs: { type: Map, of: String, default: {} },
    specifications: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.index({ tags: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isTopSelling: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ name: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  category: "text",
});

productSchema.virtual("discountPrice").get(function () {
  if (!this.discount || this.discount <= 0) return this.price;
  return Math.round(this.price * (1 - this.discount / 100) * 100) / 100;
});

productSchema.pre("validate", async function () {
  if (!this.slug && this.name) {
    const base = this.name
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    let candidate = base || "product";
    let count = 1;
    while (await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })) {
      candidate = `${base}-${count}`;
      count += 1;
    }
    this.slug = candidate;
  }
});

module.exports = mongoose.model("Product", productSchema);