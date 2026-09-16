const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

const productRoutes = require("./routes/product.routes");
const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const orderRoutes = require("./routes/order.routes");
const buildPcRoutes = require("./routes/buildPc.routes");
const configRoutes = require("./routes/config.routes");
const notificationRoutes = require("./routes/notification.routes");
const adminSettingsRoutes = require("./routes/adminSettings.routes");
const userRoutes = require("./routes/user.routes");
const paymentRoutes = require("./routes/payment.routes");

io.on("connection", (socket) => {
  // Join a per-user room so payment notifications can be pushed instantly to
  // the right customer. The token is sent by the client at handshake time.
  const token = socket.handshake?.auth?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.join(`user:${decoded.id}`);
    } catch {
      // Invalid/expired token: leave the socket unauthenticated (broadcasts still work).
    }
  }
  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/build-pc", buildPcRoutes);
app.use("/api/config", configRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminSettingsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payment", paymentRoutes);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    },
  })
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
