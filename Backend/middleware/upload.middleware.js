const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads", "products");
const paymentsDir = path.join(__dirname, "..", "uploads", "payments");
const brandingDir = path.join(__dirname, "..", "uploads", "branding");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(paymentsDir, { recursive: true });
fs.mkdirSync(brandingDir, { recursive: true });

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ALLOWED_TYPES[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  }
};

const readMagicBytes = (filePath) => {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    resolve(buf);
  });
};

const SIGNATURES = {
  "image/jpeg": (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/png": (buf) =>
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a,
  "image/webp": (buf) =>
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50,
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = {
  uploadDir,
  paymentsDir,
  brandingDir,
  MAX_FILE_SIZE,
  uploadProductImage: (req, res, next) => {
    upload.single("image")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (req.file) {
        try {
          const buf = await readMagicBytes(req.file.path);
          const matches = SIGNATURES[req.file.mimetype](buf);
          if (!matches) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "File is not a valid JPG, PNG or WEBP image" });
          }
        } catch (readErr) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Could not read the uploaded file" });
        }
      }
      next();
    });
  },
  uploadBranding: (req, res, next) => {
    const brandingStorage = multer.diskStorage({
      destination: (r, file, cb) => cb(null, brandingDir),
      filename: (r, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${ALLOWED_TYPES[file.mimetype]}`);
      },
    });
    const brandingUpload = multer({
      storage: brandingStorage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    });
    brandingUpload.single("logo")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (req.file) {
        try {
          const buf = await readMagicBytes(req.file.path);
          const matches = SIGNATURES[req.file.mimetype](buf);
          if (!matches) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "File is not a valid JPG, PNG or WEBP image" });
          }
        } catch (readErr) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Could not read the uploaded file" });
        }
      }
      next();
    });
  },
  uploadPaymentProof: (req, res, next) => {
    const paymentStorage = multer.diskStorage({
      destination: (r, file, cb) => cb(null, paymentsDir),
      filename: (r, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${ALLOWED_TYPES[file.mimetype]}`);
      },
    });
    const paymentUpload = multer({
      storage: paymentStorage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    });
    paymentUpload.single("proofScreenshot")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (req.file) {
        try {
          const buf = await readMagicBytes(req.file.path);
          const matches = SIGNATURES[req.file.mimetype](buf);
          if (!matches) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "File is not a valid JPG, PNG or WEBP image" });
          }
        } catch (readErr) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Could not read the uploaded file" });
        }
      }
      next();
    });
  },
};