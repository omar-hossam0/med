const authService = require("../services/authService");
const invitationService = require("../services/invitationService");
const { SESSION_COOKIE_NAME, extractToken } = require("../middleware/auth");
const {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  setCsrfCookie,
} = require("../middleware/csrf");

/**
 * Helper to build secure cookie options for session token.
 */
function getSessionCookieOptions(expiresAt) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    expires: expiresAt || new Date(Date.now() + authService.SESSION_TTL_MS),
  };
}

/**
 * POST /api/auth/register
 * Public patient self-registration.
 */
async function register(req, res, next) {
  try {
    const { full_name, email, password } = req.body;

    const user = await authService.registerPatient({
      fullName: full_name,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      message: "Patient account registered successfully. You can now sign in.",
      user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Common sign-in endpoint for Patient and Admin accounts.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { token, expiresAt, user } = await authService.authenticateUser({
      email,
      password,
    });

    // Send session token in HttpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));

    // Provide a session-bound, signed CSRF token for state-changing requests
    const csrfToken = generateCsrfToken(token);
    setCsrfCookie(res, csrfToken);

    res.status(200).json({
      success: true,
      message: "Signed in successfully.",
      user,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Retrieves the currently authenticated user's profile and roles.
 */
async function getMe(req, res, next) {
  try {
    // req.user was populated by requireAuth middleware
    res.status(200).json({
      authenticated: true,
      user: req.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revokes current session in PostgreSQL and clears cookies.
 */
async function logout(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      await authService.revokeSession(token);
    }

    const isProduction = process.env.NODE_ENV === "production";
    const clearOptions = {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
    };

    res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
    res.clearCookie(CSRF_COOKIE_NAME, {
      ...clearOptions,
      httpOnly: false,
    });

    res.status(200).json({
      success: true,
      message: "Signed out successfully.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/activate
 * Public: consumes a single-use invitation or password-reset token and sets
 * the account password. The token is the credential, so this endpoint does not
 * require a session.
 */
async function activate(req, res, next) {
  try {
    const { token, password } = req.body;

    const result = await invitationService.activate({
      token,
      password,
      context: {
        ip: req.ip || null,
        userAgent: req.get("user-agent") || null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Your password is set. You can now sign in.",
      user: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  logout,
  activate,
};
