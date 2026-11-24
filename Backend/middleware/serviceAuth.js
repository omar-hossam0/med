/**
 * Authentication for internal AI service workflows.
 *
 * AI agents are services, not human roles and not browser sessions. The token
 * is compared in constant time and the middleware fails closed when
 * AGENT_SERVICE_TOKEN is unset — a missing secret must never grant access.
 */
const crypto = require("crypto");
const { httpError } = require("../utils/httpError");

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireServiceAuth(req, res, next) {
  const expected = process.env.AGENT_SERVICE_TOKEN;
  if (!expected) {
    console.error("[serviceAuth] AGENT_SERVICE_TOKEN is not configured; internal agent routes are disabled.");
    return next(httpError(503, "service_auth_failed", "Internal agent service is not configured."));
  }

  const provided = req.get("x-service-token");
  if (!provided || !safeEqual(provided, expected)) {
    // A browser session is authenticated but has the wrong credential type:
    // the authorization matrix expects 403. An anonymous caller gets 401.
    const hasSessionCookie = Boolean(req.cookies && req.cookies.medora_session);
    return next(httpError(
      hasSessionCookie ? 403 : 401,
      "service_auth_failed",
      hasSessionCookie
        ? "Internal agent endpoints are not available to browser sessions."
        : "Invalid internal service credentials."
    ));
  }

  req.service = { actorType: "service", authenticatedAt: new Date().toISOString() };
  return next();
}

module.exports = { requireServiceAuth, safeEqual };
