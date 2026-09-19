// Final clean check: every lifestyle product's image must exist on disk
// and the HTTP head must return 200. DB is the source of truth.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { lifestyleProducts } = require("../seed/lifestyleProducts");

const slugify = (n) =>
  n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const DIR = path.join(__dirname, "..", "uploads", "products");

function head(p) {
  return new Promise((res) => {
    const opts = { host: "localhost", port: 3000, path: p, method: "HEAD" };
    const r = http.request(opts, (q) => { q.resume(); res(q.statusCode); });
    r.on("error", () => res("ERR"));
    r.end();
  });
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/computer-store");
  const slugs = lifestyleProducts.map((p) => slugify(p.name));
  const prods = await Product.find({ slug: { $in: slugs } }).lean();
  const map = new Map(prods.map((p) => [p.slug, p]));
  const expected = lifestyleProducts.length;
  let bad = 0;

  for (const seed of lifestyleProducts) {
    const s = slugify(seed.name);
    const db = map.get(s);
    if (!db) { console.log("  ?? no product:", s); bad++; continue; }

    const file = db.image.replace("/uploads/products/", "");
    const onDisk = fs.existsSync(path.join(DIR, file));
    const code = await head(db.image);

    const mark = onDisk && code === 200 ? "ok " : "BAD";
    if (mark !== "ok ") bad++;
    console.log(`  ${mark}  ${code}  ${db.image}  ::  ${db.name}${!onDisk ? "  (no file)" : ""}`);
  }

  console.log(`\nlifestyle in DB: ${map.size}/${expected} | problems: ${bad}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
