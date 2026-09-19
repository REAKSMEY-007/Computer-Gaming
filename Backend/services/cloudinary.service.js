const cloudinary = require("cloudinary").v2;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Cloudinary is used for product images in production (Render), where the
// local uploads/ directory is not persisted. If the credentials are missing
// (e.g. plain local dev), the backend transparently falls back to the legacy
// local-disk storage so development keeps working.
const isConfigured = () => Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (isConfigured()) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
  });
}

const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "image", ...options },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result.secure_url, publicId: result.public_id });
        }
      )
      .end(buffer);
  });

// Best-effort deletion — never throws so callers can burn down cleanup paths.
const deleteImage = async (publicId) => {
  if (!publicId || !isConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // ignore — orphaned Cloudinary asset is harmless
  }
};

// Turn a https://res.cloudinary.com/.../image/upload/v12345/<folder>/<file>.<ext>
// URL back into the Cloudinary public id ("<folder>/<file>") so an old image
// can be removed after a product is updated.
const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("cloudinary.com/")) return null;
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.slice(idx + marker.length);
  path = path.replace(/^v\d+\//, "");
  path = path.replace(/\.[^./]+$/, "");
  return path || null;
};

module.exports = { isConfigured, uploadBuffer, deleteImage, publicIdFromUrl };