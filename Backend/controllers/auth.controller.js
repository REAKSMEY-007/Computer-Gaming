const User = require("../models/User");
const Order = require("../models/Order");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider,
  avatar: user.avatar,
});

const register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, role: "customer" });
    await user.save();
    const io = req.app.get("io");
    if (io) {
      io.emit("new-customer", { userId: user._id, username: user.username });
    }
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const googleLogin = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken)
    return res.status(400).json({ message: "Missing Google ID token" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID || undefined,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).json({ message: "Invalid Google ID token" });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      let username = (payload.name || payload.email.split("@")[0]).trim();
      const base = username;
      let n = 1;
      while (await User.findOne({ username })) {
        username = `${base}${n}`;
        n += 1;
      }

      user = new User({
        username,
        email,
        role: "customer",
        authProvider: "google",
        googleId: payload.sub,
        avatar: payload.picture,
      });
      await user.save();
      const io = req.app.get("io");
      if (io) {
        io.emit("new-customer", { userId: user._id, username: user.username });
      }
    } else if (!user.googleId) {
      // Link existing local account to Google by email — same user, no duplicate.
      user.authProvider = "local";
      user.googleId = payload.sub;
      if (payload.picture) user.avatar = payload.picture;
      await user.save();
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Google sign-in failed: " + err.message });
  }
};

const normaliseUsername = (value) => (typeof value === "string" ? value.trim() : "");

const updateProfile = async (req, res) => {
  const username = normaliseUsername(req.body?.username);
  if (!username) return res.status(400).json({ message: "Username cannot be empty" });
  if (username.length < 2 || username.length > 40) {
    return res.status(400).json({ message: "Username must be between 2 and 40 characters" });
  }

  try {
    const duplicate = await User.findOne({ username, _id: { $ne: req.user._id } });
    if (duplicate) return res.status(400).json({ message: "That username is already in use" });

    req.user.username = username;
    await req.user.save();
    // Orders cache the customer name for display and search, so keep that
    // denormalised value aligned with the user's current display name.
    await Order.updateMany({ customer: req.user._id }, { $set: { customerName: username } });
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    res.status(500).json({ message: "Could not update your profile" });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (req.user.authProvider === "google" || !req.user.password) {
    return res.status(400).json({ message: "Signed in with Google — no password to manage" });
  }
  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Enter your current password" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }
  if (newPassword.length > 128) {
    return res.status(400).json({ message: "New password must be 128 characters or fewer" });
  }

  try {
    const valid = await bcrypt.compare(currentPassword, req.user.password);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Could not update your password" });
  }
};

module.exports = { register, login, googleLogin, updateProfile, changePassword };
