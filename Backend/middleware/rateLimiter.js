const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for authentication login endpoint.
 * Restricts multiple failed attempts within a 15-minute window.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: "Too Many Requests",
    message: "Too many login attempts. Please wait 15 minutes before trying again.",
  },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for administrative mutations (provisioning, status changes,
 * invitations). The admin surface is small and deliberate, so the ceiling is
 * generous but finite.
 */
const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many administrative changes. Please wait before trying again.",
  },
});

/**
 * Rate limiter for the public activation endpoint, which consumes a token and
 * hashes a password on every call.
 */
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many activation attempts. Please wait 15 minutes before trying again.",
  },
});

module.exports = {
  loginRateLimiter,
  adminActionLimiter,
  activationLimiter,
};
