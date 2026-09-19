const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const uploadsRoot = path.join(__dirname, "..", "uploads");

const stem = (image) => {
  const base = String(image || "").split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
};
const ext = (image) => {
  const base = String(image || "").split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot);
};

async function renameFor(collectionName, label, update) {
  const db = mongoose.connection.db;
  const docs = await db.collection(collectionName).find({}).toArray();
  let fixed = 0;
  for (const d of docs) {
    const image = d.image;
    if (!image || !d.slug) continue;
    if (stem(image) === d.slug) continue;

    const newImage = image.replace(/[^/]+$/, `${d.slug}${ext(image)}`);
    const srcAbs = path.join(uploadsRoot, image.replace(/^\/uploads\//, ""));
    const dstAbs = path.join(uploadsRoot, newImage.replace(/^\/uploads\//, ""));

    if (fs.existsSync(srcAbs) && !fs.existsSync(dstAbs)) {
      fs.copyFileSync(srcAbs, dstAbs);
    }
    const copied = fs.existsSync(dstAbs);

    await db.collection(collectionName).updateOne(
      { _id: d._id },
      update(newImage)
    );
    fixed++;
    console.log(
      `  ${label} "${d.name}"\n    ${image} -> ${newImage}${copied ? "" : "  (source file missing!)"}`
    );
  }
  return { total: docs.length, fixed };
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });

    console.log("PRODUCTS");
    const p = await renameFor("products", "product", (image) => ({
      $set: { image, images: [image] },
    }));

    console.log("CATEGORIES");
    const c = await renameFor("categories", "category", (image) => ({
      $set: { image },
    }));

    console.log(`\nproducts: ${p.fixed}/${p.total} renamed`);
    console.log(`categories: ${c.fixed}/${c.total} renamed`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error("ERR", e);
    process.exit(1);
  }
})();