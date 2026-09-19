require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/computer-store");
  const fixes = {
    "cyberpowerpc-gamer-xtreme-vr.jpg": "/uploads/products/cyberpowerpc-gamer-xtreme-vr.png",
    "alienware-aurora-r16-gaming-pc.png": "/uploads/products/alienware-aurora-r16-gaming-pc.png",
    "ibuypower-slatemesh-gaming-pc.png": "/uploads/products/ibuypower-slatemesh-gaming-pc.png",
  };
  for (const [from, to] of Object.entries(fixes)) {
    const r = await Product.updateMany(
      { images: from },
      { $set: { image: to, images: [to] }, $pull: { images: from }, updatedAt: new Date() }
    );
    console.log(`  ${from} -> ${to}  (matched ${r.matchedCount})`);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
