const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "uploads", "products");

function slugFromImage(image) {
  return image
    .replace(/^\/uploads\/products\//, "")
    .replace(/\.jpg$/, "");
}

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

async function ensureProductImages(imagePaths) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const image of imagePaths) {
    const slug = slugFromImage(image);
    const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);
    if (fs.existsSync(dest)) continue;

    const url = `https://picsum.photos/seed/${encodeURIComponent(slug)}/600/400`;
    await download(url, dest);
    const size = fs.statSync(dest).size;
    if (size < 500) {
      fs.unlinkSync(dest);
      throw new Error(`downloaded file too small for ${slug}`);
    }
    console.log(`  ✓ ${slug}.jpg`);
  }
}

module.exports = { ensureProductImages, OUTPUT_DIR };
