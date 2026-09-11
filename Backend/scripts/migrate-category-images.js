const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Category = require("../models/Category");

const CATEGORY_DIR = path.join(__dirname, "..", "uploads", "categories");

// Real Wikimedia Commons photos (free licenses) for each category.
// The 3 gaming categories that already use real user-uploaded product
// photos are intentional omissions (kept as-is).
const commonsFiles = {
  cpu: "File:4th Generation Intel® Core™ i7 Processor Front.jpg",
  "gpu-graphics-card": "File:Sapphire-Radeon-HD-5570-Video-Card.jpg",
  ram: "File:16 GiB-DDR4-RAM-Riegel RAM019FIX Small Crop 90 PCNT.png",
  "ssd-hdd": "File:Samsung 980 PRO PCIe 4.0 NVMe SSD 1TB-top PNr°0915.jpg",
  motherboard: "File:2023 Płyta główna ASRock A320M-DVS.jpg",
  "power-supply": "File:ATX Computer power supply unit.jpg",
  "pc-case": "File:PC-Gehäuse Kolink Observatory RGB Midi-Tower 20201120 DSC6134.jpg",
  cooling: "File:Cooler Master Hyper 212 EVO - CPU Cooler with 120mm PWM Fan (RR-212E-20PK-R2).jpg",
  "gaming-keyboard": "File:Mars Gaming MK6 gaming keyboard (49426225481).jpg",
  "webcams-streaming": "File:Logitech Brio 301 webcam HS1.jpg",
  "gaming-chair": "File:Gaming chair 1.jpg",
  controller: "File:Xbox-360-Pro-wController.jpg",
  "mouse-pad": "File:Logitech Red mouse on a mouse pad.jpg",
  "gaming-pc": "File:Astaroth- RGB Lighting Update.jpg",
  "office-pc": "File:Terraflorin PC.jpg",
  "gaming-laptop": "File:MSI Gaming Laptop on wood floor.jpg",
  workstation: 'File:Velocity Micro "ProMagix HD60" Workstation Computer.jpg',
  "pc-laptop": "File:Schenker VIA14 Laptop asv2021-01.jpg",
  "computer-parts": "File:Diverse historische PC-Hardware 202201 HOF08845.png",
  gaming: "File:Gaming PC-Setup - Astaroth- The Completed System.jpg",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? require("https") : require("http");
    proto
      .get(
        url,
        { headers: { "User-Agent": "computer-store-seed/1.0 (local dev; contact: none)" } },
        (res) => {
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
        }
      )
      .on("error", reject);
  });
}

async function getCommonsInfo(title) {
  const u =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=" +
    encodeURIComponent(title) +
    "&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=960";
  const r = await fetch(u, { headers: { "User-Agent": "computer-store-seed/1.0 (local dev; contact: none)" } });
  const j = await r.json();
  const pages = (j.query && j.query.pages) || {};
  const page = Object.values(pages)[0];
  if (!page || !page.imageinfo) throw new Error("no imageinfo for " + title);
  const ii = page.imageinfo[0];
  return {
    thumbUrl: ii.thumburl,
    width: ii.width,
    height: ii.height,
    license: (ii.extmetadata && ii.extmetadata.LicenseShortName && ii.extmetadata.LicenseShortName.value) || "n/a",
    artist: (ii.extmetadata && ii.extmetadata.Artist && ii.extmetadata.Artist.value) || "",
  };
}

async function migrate() {
  try {
    console.log("== Category image migration (real Commons photos) ==");
    fs.mkdirSync(CATEGORY_DIR, { recursive: true });

    const report = [];
    for (const [slug, fileTitle] of Object.entries(commonsFiles)) {
      const dest = path.join(CATEGORY_DIR, `${slug}.jpg`);
      const imagePath = `/uploads/categories/${slug}.jpg`;
      try {
        if (fs.existsSync(dest)) {
          await Category.updateOne({ slug }, { $set: { image: imagePath } });
          console.log(`  - ${slug} already present, re-linked`);
          continue;
        }
        if (fs.existsSync(dest)) {
          await Category.updateOne({ slug }, { $set: { image: imagePath } });
          console.log(`  - ${slug} already present, re-linked`);
          continue;
        }
        const info = await getCommonsInfo(fileTitle);
        await download(info.thumbUrl.replace(/&utm_[^&]*/g, ""), dest);
        const size = fs.statSync(dest).size;
        if (size < 1000) {
          fs.unlinkSync(dest);
          throw new Error("downloaded file too small (" + size + " bytes)");
        }
        await Category.updateOne({ slug }, { $set: { image: imagePath } });
        report.push({ slug, fileTitle, imagePath, license: info.license, artist: info.artist, size });
        console.log(`  ✓ ${slug} <- ${fileTitle} (${info.license})`);
      } catch (err) {
        report.push({ slug, fileTitle, error: err.message });
        console.log(`  ✗ ${slug} failed: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 900));
    }

    fs.writeFileSync(path.join(__dirname, "category-image-report.json"), JSON.stringify(report, null, 2));
    console.log("report -> scripts/category-image-report.json");
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