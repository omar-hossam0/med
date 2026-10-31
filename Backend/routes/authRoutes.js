const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginRateLimiter, activationLimiter } = require("../middleware/rateLimiter");
const { verifyCsrf } = require("../middleware/csrf");

const router = express.Router();

// Public endpoints
router.post("/register", authController.register);
router.post("/login", loginRateLimiter, authController.login);

// Invitation / password-reset token consumption. Public by design: the token is
// the credential. Rate-limited because every call hashes a password.
router.post("/activate", activationLimiter, authController.activate);

// Authenticated session endpoints
router.get("/me", requireAuth, authController.getMe);
router.post("/logout", requireAuth, verifyCsrf, authController.logout);

module.exports = router;
