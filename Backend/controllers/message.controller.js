const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createMessage = async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanSubject =
    typeof subject === "string" && subject.trim() ? subject.trim() : "General";
  const cleanMessage = typeof message === "string" ? message.trim() : "";

  if (!cleanName) {
    return res.status(400).json({ message: "Name is required" });
  }
  if (!cleanEmail || !EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ message: "A valid email address is required" });
  }
  if (!cleanMessage) {
    return res.status(400).json({ message: "Message body is required" });
  }

  try {
    const saved = await Message.create({
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
    });
    res.status(201).json({ message: "Your message has been sent", data: saved });
  } catch (err) {
    console.error("[createMessage] error:", err);
    res.status(500).json({ message: "Could not send your message. Please try again." });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).lean();
    res.json({ messages });
  } catch (err) {
    console.error("[getMessages] error:", err);
    res.status(500).json({ message: "Something went wrong loading messages." });
  }
};

const updateMessageStatus = async (req, res) => {
  const { status } = req.body || {};
  const allowed = ["unread", "read", "archived"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid message status" });
  }
  try {
    const updated = await Message.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Message not found" });
    res.json(updated);
  } catch (err) {
    console.error("[updateMessageStatus] error:", err);
    res.status(500).json({ message: "Could not update the message." });
  }
};

const replyMessage = async (req, res) => {
  const text = (req.body.text || req.body.reply || "").trim();
  if (!text) {
    return res.status(400).json({ message: "Reply text is required" });
  }
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const updatedDoc = await Message.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          "reply.text": text,
          "reply.repliedAt": new Date(),
          "reply.repliedBy": req.user?.username || req.user?.email || "Admin",
          status: "read",
        },
      },
      { new: true, runValidators: true }
    );

    const email = (message.email || "").toLowerCase().trim();
    if (email) {
      const recipientUser = await User.findOne({ email });
      if (recipientUser) {
        const notification = await Notification.create({
          userId: recipientUser._id,
          recipient: recipientUser._id,
          title: "Support Replied",
          message: `Admin replied: "${text.substring(0, 50)}..."`,
          link: "/contact",
          type: "support_reply",
          isRead: false,
          read: false,
        });
        const io = req.app.get("io");
        if (io) {
          io.to(`user:${String(recipientUser._id)}`).emit("notification", { notification });
        }
      }
    }

    res.json({ message: updatedDoc });
  } catch (err) {
    console.error("[replyMessage] error:", err);
    res.status(500).json({ message: "Could not send the reply." });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const deleted = await Message.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Message not found" });
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("[deleteMessage] error:", err);
    res.status(500).json({ message: "Could not delete the message." });
  }
};

module.exports = { createMessage, getMessages, updateMessageStatus, replyMessage, deleteMessage };