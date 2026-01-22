const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { errorHandler } = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const busRoutes = require("./routes/busRoutes");
const seatRoutes = require("./routes/seatRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { initSeatReleaseCron } = require("./jobs/seatReleaseJob");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true, // allow requests, safe for Flutter
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/buses", busRoutes);
app.use("/seats", seatRoutes);
app.use("/booking", bookingRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);

// Global error handler
app.use(errorHandler);

// Initialize cron jobs
initSeatReleaseCron();

module.exports = app;

