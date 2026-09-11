const crypto = require("crypto");
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const restOf = (url) => UPLOADS + url.split("/").pop();

require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Product = require("./models/Product");

const API = "http://localhost:3000/api";
const UPLOADS = __dirname + "/uploads/products/";
const SLUG = "amd-ryzen-7-7800x3d";
const ID = "6a9fb90eaf555e1a6b2ec10b";

const results = [];
const check = async (name, fn) => {
  try {
    results.push((await fn()) ? `PASS: ${name}` : `FAIL: ${name}`);
  } catch (e) {
    results.push(`FAIL: ${name} -> ${e.message}`);
  }
};
const req = async (path, o = {}) => {
  const opts = { ...o, headers: { ...(o.headers || {}) } };
  if (o.body && !(o.body instanceof FormData)) opts.headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, opts);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const formWithImage = (filePath) => {
  const mime = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : filePath.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  const fd = new FormData();
  fd.append("image", new Blob([fs.readFileSync(filePath)], { type: mime }), "test.jpg");
  fd.append("name", "AMD Ryzen 7 7800X3D");
  return fd;
};

const galleryImages = (p) => {
  const extras = (p.images || []).filter((s) => s && s !== p.image);
  return [p.image, ...extras];
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const before = await Product.findOne({ slug: SLUG });
  const beforeImage = before.image;

  const admin = await User.findOne({ role: "admin" });
  const TOKEN = jwt.sign(
    { id: admin._id, role: admin.role, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  // 1) Admin uploads a NEW image (Multipart, exactly like the admin panel)
  const updated = await req(`/products/${ID}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: formWithImage(UPLOADS + "acer-nitro-24-180hz.jpg"),
  });
  console.log("PUT status:", updated.status, JSON.stringify(updated.body));
  const newImg = updated.body?.image;

  await check("admin upload updates product.image (response #1)", () => !!newImg && newImg !== beforeImage);
  await check("admin upload syncs product.images (response #2)", () => {
    const b = updated.body;
    return Array.isArray(b?.images) && b.images.length === 1 && b.images[0] === newImg;
  });

  await check("GET /products/:id returns new image + synced images", async () => {
    const r = await req(`/products/${ID}`);
    return r.body?.image === newImg && Array.isArray(r.body?.images) && r.body.images[0] === newImg;
  });

  await check("GET /products/slug/:slug returns new image + synced images (detail page source)", async () => {
    const r = await req(`/products/slug/${SLUG}`);
    return r.body?.image === newImg && Array.isArray(r.body?.images) && r.body.images[0] === newImg;
  });

  await check("GET /products list grid returns new image (list page source)", async () => {
    const r = await req(`/products?page=${1}&size=100`);
    const found = r.body?.products?.find((x) => x.slug === SLUG);
    return !!found && found.image === newImg;
  });

  await check("galleryImages() shows the new image first (no stale secondary)", async () => {
    const r = await req(`/products/slug/${SLUG}`);
    const g = galleryImages(r.body);
    return g.length === 1 && g[0] === newImg;
  });

  // 2) Restore the original image so the product is left as it was before testing
  const restored = await req(`/products/${ID}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: formWithImage(UPLOADS + beforeImage.split("/").pop()),
  });
  await check("restore original image bytes + images stay synced", async () => {
    const r = await req(`/products/slug/${SLUG}`);
    const sameBytes = sha(restOf(r.body.image)) === sha(restOf(beforeImage));
    return sameBytes && Array.isArray(r.body.images) && r.body.images[0] === r.body.image;
  });

  console.log(results.join("\n"));
  const fails = results.filter((r) => r.startsWith("FAIL"));
  console.log(fails.length ? `\n${fails.length} FAILURES` : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error("IMG-FIX E2E ERROR:", e.message);
  process.exit(1);
});