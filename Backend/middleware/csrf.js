const crypto = require("crypto");

const CSRF_COOKIE_NAME = "medora_csrf";
const SESSION_COOKIE_NAME = "medora_session";

/**
 * Sign a random CSRF value with the current opaque session token (HMAC-SHA256).
 * This makes the token session-bound: an attacker cannot forge a valid
 * double-submit pair without knowing the HttpOnly session token.
 */
function signCsrf(random, sessionToken) {
  return crypto.createHmac("sha256", sessionToken).update(random).digest("hex");
}

/**
 * Generate a signed, session-bound CSRF token: "<random>.<hmac>".
 */
function generateCsrfToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== "string") {
    throw new Error("generateCsrfToken requires the session token");
  }
  const random = crypto.randomBytes(24).toString("hex");
  return `${random}.${signCsrf(random, sessionToken)}`;
}

/**
 * Set the CSRF cookie so the frontend can read and echo it in a header.
 */
function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // must be readable by the frontend to echo it
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
}

/**
 * CSRF protection for state-changing authenticated requests.
 * Layered defence:
 *   1. Reject cross-site requests via Sec-Fetch-Site.
 *   2. Require cookie == header (double-submit).
 *   3. Verify the HMAC signature bound to the HttpOnly session token.
 */
function verifyCsrf(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite === "cross-site") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Cross-site request blocked by CSRF policy.",
    });
  }

  const sessionToken = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;

  // No session -> nothing authenticated to protect (requireAuth handles auth).
  if (!sessionToken) {
    return next();
  }

  const csrfCookie = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : null;
  const csrfHeader =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf;

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid or missing CSRF token.",
    });
  }

  const [random, signature] = String(csrfCookie).split(".");
  if (!random || !signature || signature.length !== 64) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Malformed CSRF token.",
    });
  }

  const expected = signCsrf(random, sessionToken);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  const valid =
    provided.length === expectedBuf.length &&
    crypto.timingSafeEqual(provided, expectedBuf);

  if (!valid) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid CSRF token signature.",
    });
  }

  next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrf,
};
