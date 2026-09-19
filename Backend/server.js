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
const messageRoutes = require("./routes/message.routes");

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
app.use("/api/payments", paymentRoutes);
app.use("/api/messages", messageRoutes);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    },
  })
);

// MongoDB connection with automatic retry (exponential backoff) so the server
// can ride out transient network blips to the Atlas cluster on boot.
async function connectWithRetry(retries = 5, initialDelayMs = 5000) {
  if (!process.env.MONGO_URI) {
    console.error(
      "ERROR: MONGO_URI is not defined. Add it to Backend/.env for local dev, " +
        "or set it in the Render environment variables.\n" +
        "Expected format: mongodb+srv://<dbUser>:<dbPassword>@<cluster>.mongodb.net/<dbName>?retryWrites=true&w=majority"
    );
    process.exit(1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        retryWrites: true,
      });
      console.log(`Connected to MongoDB (attempt ${attempt})`);
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        const delayMs = initialDelayMs * 2 ** (attempt - 1);
        console.log(`Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error("Could not connect to MongoDB after multiple attempts. Exiting.");
  process.exit(1);
}

(async () => {
  await connectWithRetry();

  mongoose.connection.on("error", (err) => {
    console.error("Runtime MongoDB error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected — the driver will keep trying to reconnect.");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
