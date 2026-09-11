const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Category = require("../models/Category");
const Product = require("../models/Product");
const { ensureProductImages } = require("../seed/imageGenerator");
const { parts, slugify } = require("../seed/parts");

function cdntoSet(obj) {
  return {
    specifications: obj.specifications ?? {},
    specs: Object.fromEntries(
      Object.entries(obj.specifications ?? {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(", ") : String(v),
      ])
    ),
  };
}

async function migrate() {
  try {
    console.log("== Build Your PC: seed structured Computer Parts inventory ==");

    const cats = await Category.find({});
    const nameToId = new Map(cats.map((c) => [c.name, c._id]));

    let inserted = 0;
    let updated = 0;
    const imagePaths = [];

    for (const part of parts) {
      const slug = slugify(part.name);
      const existing = await Product.findOne({ slug });

      const doc = {
        ...part,
        slug,
        images: [part.image],
        categoryId: nameToId.get(part.category) ?? null,
        ...cdntoSet(part),
      };

      if (existing) {
        await Product.updateOne({ _id: existing._id }, { $set: doc });
        updated++;
        console.log(`updated: ${slug}`);
      } else {
        await Product.create(doc);
        inserted++;
        console.log(`inserted: ${slug}`);
      }
      imagePaths.push(part.image);
    }

    await ensureProductImages(imagePaths);

    const total = await Product.countDocuments();
    console.log(
      `done. inserted=${inserted}, updated=${updated}, total products=${total}`
    );
    mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(migrate)
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });