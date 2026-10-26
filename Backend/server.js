const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const { requireAuth, requireRole } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const port = process.env.PORT || 5000;

// Allowed frontend origins for credentialed CORS
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Medora Backend is running" });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Protected demonstration endpoints for RBAC verification
app.get("/api/admin/check", requireAuth, requireRole("admin"), (req, res) => {
  res.json({
    success: true,
    message: "Admin authorization verified.",
    user: req.user,
  });
});

app.get("/api/patient/check", requireAuth, requireRole("patient"), (req, res) => {
  res.json({
    success: true,
    message: "Patient authorization verified.",
    user: req.user,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Medora Backend is running at http://localhost:${port}`);
  });
}

module.exports = app;
