const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Product = require("../models/Product");
const { ensureProductImages } = require("./imageGenerator");

async function generate() {
  try {
    const products = await Product.find({}).select("name image");
    console.log(`Found ${products.length} products`);
    await ensureProductImages(products.map((p) => p.image));
    mongoose.disconnect();
    console.log(`Image generation complete (${products.length}/` + products.length + ")");
    process.exit(0);
  } catch (err) {
    console.error("Image generation failed:", err.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(generate)
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
