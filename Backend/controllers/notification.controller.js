const Notification = require("../models/Notification");

const getMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("[getMyNotifications] error:", err);
    res.status(500).json({ message: "Something went wrong loading notifications." });
  }
};

const markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }
    res.json(notification);
  } catch (err) {
    console.error("[markRead] error:", err);
    res.status(500).json({ message: "Something went wrong updating the notification." });
  }
};

const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    res.json({ modified: result.modifiedCount || 0 });
  } catch (err) {
    console.error("[markAllRead] error:", err);
    res.status(500).json({ message: "Something went wrong updating notifications." });
  }
};

// Shared helper: persists a notification (used by order payment flows).
const createNotification = async ({ recipient, type, message, order, orderNumber }) => {
  return new Notification({ recipient, type, message, order, orderNumber }).save();
};

module.exports = { getMyNotifications, markRead, markAllRead, createNotification };