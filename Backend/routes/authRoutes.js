const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginRateLimiter } = require("../middleware/rateLimiter");
const { verifyCsrf } = require("../middleware/csrf");

const router = express.Router();

// Public endpoints
router.post("/register", authController.register);
router.post("/login", loginRateLimiter, authController.login);

// Authenticated session endpoints
router.get("/me", requireAuth, authController.getMe);
router.post("/logout", requireAuth, verifyCsrf, authController.logout);

module.exports = router;
