const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Product = require("../models/Product");
const { ensureProductImages, OUTPUT_DIR } = require("../seed/imageGenerator");

// Budget Esports parts -> working source image (null = generate a unique one).
const budgetImages = [
  { slug: "amd-ryzen-5-5600", url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80" },
  { slug: "gigabyte-b550m-ds3h", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80" },
  { slug: "corsair-vengeance-lpx-16gb-2x8gb-ddr4", url: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=600&q=80" },
  { slug: "xfx-speedster-swft210-radeon-rx-6600-8gb", url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80" },
  { slug: "kingston-nv2-1tb-m-2-nvme-ssd", url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80" },
  { slug: "evga-600-w1-80-white-600w", url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=600&q=80" },
  // 404 source URL -> generate locally
  { slug: "thermaltake-versa-h18-m-atx-case", url: null },
  // duplicate of the CPU photo -> generate a distinct local image
  { slug: "deepcool-ag400-cpu-cooler", url: null },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? require("https") : require("http");
    proto
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const localPaths = [];
    for (const { slug, url } of budgetImages) {
      const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);
      if (url && !fs.existsSync(dest)) {
        try {
          await download(url, dest);
          console.log(`  downloaded: ${slug}.jpg`);
        } catch (err) {
          console.warn(`  download failed for ${slug}: ${err.message} — will generate instead`);
        }
      }
      localPaths.push(`/uploads/products/${slug}.jpg`);
    }

    // Fill in any missing file (broken source / failed download) with a unique generated image.
    await ensureProductImages(localPaths);

    for (const { slug } of budgetImages) {
      const image = `/uploads/products/${slug}.jpg`;
      await Product.updateOne(
        { slug },
        { $set: { image, images: [image] }, $unset: { imageUrl: "" } }
      );
      console.log(`  updated db image: ${slug}`);
    }

    console.log("All budget product images localized.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Fix images failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
