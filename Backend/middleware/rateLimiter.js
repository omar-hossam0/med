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

module.exports = {
  loginRateLimiter,
};
