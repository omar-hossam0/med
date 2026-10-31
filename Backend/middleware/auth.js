const { getSessionByToken } = require("../services/authService");

const SESSION_COOKIE_NAME = "medora_session";

/**
 * Extracts session token from cookie or Authorization header.
 */
function extractToken(req) {
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware requiring a valid, unexpired, unrevoked session.
 * Attaches `req.user` and `req.session` on success.
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required. Please sign in to continue.",
      });
    }

    const sessionData = await getSessionByToken(token);

    if (!sessionData) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session is invalid, expired, or revoked. Please sign in again.",
      });
    }

    req.session = sessionData.session;
    req.user = sessionData.user;
    req.sessionToken = token;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware requiring the user to have at least one of the specified roles.
 * Must be used after `requireAuth`.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required.",
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Access denied: this resource requires one of the following roles: ${allowedRoles.join(
          ", "
        )}.`,
      });
    }

    next();
  };
}

/**
 * Middleware requiring the user to possess all of the specified permissions.
 * Must be used after `requireAuth`.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required.",
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasAll) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied: insufficient permission privileges.",
      });
    }

    next();
  };
}

/**
 * Middleware requiring at least one of the specified permissions.
 * Must be used after `requireAuth`.
 *
 * `requirePermission` above requires every listed permission; admin routes
 * often accept either of two (for example users.manage OR staff_accounts.view).
 */
function requireAnyPermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required.",
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = requiredPermissions.some((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasAny) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied: insufficient permission privileges.",
      });
    }

    next();
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  extractToken,
  requireAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
};
