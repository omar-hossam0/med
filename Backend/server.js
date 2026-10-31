const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { requireAuth, requireRole } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Explicit origins for credentialed CORS. In development any loopback origin is
// also accepted, because Next falls back to :3001, :3002, ... when :3000 is
// already in use — and a blocked origin used to surface as a generic 500.
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

function isAllowedOrigin(origin) {
  // No Origin header: curl, server-to-server, or the Next rewrite proxy.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isProduction) return false;

  try {
    const url = new URL(origin);
    const httpish = url.protocol === "http:" || url.protocol === "https:";
    return httpish && LOOPBACK_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      const error = new Error(`CORS origin not allowed: ${origin}`);
      error.statusCode = 403;
      error.code = "cors_origin_denied";
      return callback(error);
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

// Admin dashboard routes (users, doctors & staff, reference data)
app.use("/api/admin", adminRoutes);

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
