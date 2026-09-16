const User = require("../models/User");

const THEME_MODES = ["light", "dark"];

// GET /api/user/preferences — returns whatever the signed-in user has stored.
// An empty object is the expected shape until the user picks a theme.
const getPreferences = async (req, res) => {
  try {
    res.json({ preferences: (req.user.preferences && req.user.preferences.toObject()) || {} });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/user/preferences — upserts a single named preference.
// New fields can be added here (e.g. currency, notifications) without
// changing the client contract; unknown keys are ignored.
const updatePreferences = async (req, res) => {
  const { themeMode } = req.body || {};
  if (!THEME_MODES.includes(themeMode)) {
    return res.status(400).json({ message: 'themeMode must be "light" or "dark"' });
  }

  try {
    req.user.set("preferences.themeMode", themeMode);
    await req.user.save();
    res.json({ preferences: req.user.preferences.toObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPreferences, updatePreferences };