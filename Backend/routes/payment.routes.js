const express = require("express");
const router = express.Router();
const {
  generateKhqr,
  verifyMd5,
} = require("../controllers/payment.controller");

router.post("/generate-khqr", generateKhqr);
router.post("/verify-md5", verifyMd5);

module.exports = router;