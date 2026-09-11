const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    parentCategory: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("Category", categorySchema);