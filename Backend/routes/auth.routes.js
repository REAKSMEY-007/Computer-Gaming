const express = require("express");
const router = express.Router();
const { register, login, googleLogin, updateProfile, changePassword } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.put("/profile", protect, updateProfile);
router.put("/profile/password", protect, changePassword);

module.exports = router;
