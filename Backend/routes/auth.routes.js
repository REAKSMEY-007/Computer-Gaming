const express = require("express");
const router = express.Router();
const { register, login, googleLogin, updateProfile, changePassword, updateAvatar, addAddress } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { uploadAvatar } = require("../middleware/upload.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.put("/profile", protect, updateProfile);
router.put("/profile/password", protect, changePassword);
router.put("/profile/avatar", protect, uploadAvatar, updateAvatar);
router.post("/addresses", protect, addAddress);

module.exports = router;
