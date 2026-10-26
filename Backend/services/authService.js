const crypto = require("crypto");
const argon2 = require("argon2");
const pool = require("../config/db");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hash password securely using Argon2id.
 */
async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify password against an Argon2id hash.
 */
async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure opaque session token.
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Compute SHA-256 hash of the session token for PostgreSQL storage.
 */
function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Patient Self-Registration.
 * Assigns 'patient' role automatically in a PostgreSQL transaction.
 */
async function registerPatient({ fullName, email, password }) {
  // 1. Validation
  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    const error = new Error("Full name must be at least 2 characters long.");
    error.statusCode = 400;
    throw error;
  }

  if (fullName.trim().length > 150) {
    const error = new Error("Full name must not exceed 150 characters.");
    error.statusCode = 400;
    throw error;
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!password || typeof password !== "string") {
    const error = new Error("Password is required.");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("Password must be at least 8 characters long.");
    error.statusCode = 400;
    throw error;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    const error = new Error(
      "Password must include at least one uppercase letter, one lowercase letter, and one number."
    );
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check for duplicate email
    const duplicateCheck = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );

    if (duplicateCheck.rows.length > 0) {
      const error = new Error("An account with this email address already exists.");
      error.statusCode = 409;
      throw error;
    }

    // Lookup patient role ID
    const roleRes = await client.query(
      "SELECT id FROM roles WHERE name = 'patient'"
    );

    if (roleRes.rows.length === 0) {
      const error = new Error(
        "Patient role is not configured. Please ensure database migrations have been executed."
      );
      error.statusCode = 500;
      throw error;
    }

    const patientRoleId = roleRes.rows[0].id;
    const passwordHash = await hashPassword(password);

    // Insert user (status is active for self-registered patient MVP)
    const userInsertRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, status, created_by, email_verified_at)
       VALUES ($1, $2, $3, 'active', NULL, NULL)
       RETURNING id, full_name, email, status, created_at`,
      [trimmedName, normalizedEmail, passwordHash]
    );

    const newUser = userInsertRes.rows[0];

    // Assign 'patient' role
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [newUser.id, patientRoleId]
    );

    await client.query("COMMIT");

    return {
      id: newUser.id,
      full_name: newUser.full_name,
      email: newUser.email,
      status: newUser.status,
      roles: ["patient"],
      created_at: newUser.created_at,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    // Handle unique violation if race condition occurs
    if (err.code === "23505") {
      const conflictError = new Error(
        "An account with this email address already exists."
      );
      conflictError.statusCode = 409;
      throw conflictError;
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Common Login for all roles (Patient, Admin, and future Doctor/Staff).
 */
async function authenticateUser({ email, password }) {
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    const error = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Query user by email
  const userRes = await pool.query(
    `SELECT id, full_name, email, password_hash, status, created_at
     FROM users
     WHERE LOWER(email) = LOWER($1)`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const user = userRes.rows[0];

  // If user has no password set (e.g. pending doctor/staff activation)
  if (!user.password_hash) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  // Verify Argon2id password hash
  const isValid = await verifyPassword(user.password_hash, password);
  if (!isValid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  // Check account status
  if (user.status !== "active") {
    let msg = "Account is not active.";
    if (user.status === "pending_activation") {
      msg = "Your account is pending activation. Please contact administration.";
    } else if (user.status === "suspended") {
      msg = "Your account has been suspended. Please contact clinic administration.";
    } else if (user.status === "disabled") {
      msg = "Your account has been disabled.";
    }
    const error = new Error(msg);
    error.statusCode = 403;
    throw error;
  }

  // Load user roles
  const rolesRes = await pool.query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.name`,
    [user.id]
  );
  const roles = rolesRes.rows.map((r) => r.name);

  // Load user permissions
  const permissionsRes = await pool.query(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY p.code`,
    [user.id]
  );
  const permissions = permissionsRes.rows.map((r) => r.code);

  // Create PostgreSQL session
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      created_at: user.created_at,
    },
  };
}

/**
 * Retrieve user and active session by opaque session token.
 */
async function getSessionByToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const sessionRes = await pool.query(
    `SELECT 
       s.id AS session_id,
       s.user_id,
       s.expires_at,
       s.revoked_at,
       u.full_name,
       u.email,
       u.status,
       u.created_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1`,
    [tokenHash]
  );

  if (sessionRes.rows.length === 0) {
    return null;
  }

  const row = sessionRes.rows[0];

  // Check revocation
  if (row.revoked_at !== null) {
    return null;
  }

  // Check expiration
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  // Check account status
  if (row.status !== "active") {
    return null;
  }

  // Load user roles
  const rolesRes = await pool.query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.name`,
    [row.user_id]
  );
  const roles = rolesRes.rows.map((r) => r.name);

  // Load user permissions
  const permissionsRes = await pool.query(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY p.code`,
    [row.user_id]
  );
  const permissions = permissionsRes.rows.map((r) => r.code);

  return {
    session: {
      id: row.session_id,
      expires_at: row.expires_at,
    },
    user: {
      id: row.user_id,
      full_name: row.full_name,
      email: row.email,
      status: row.status,
      roles,
      permissions,
      created_at: row.created_at,
    },
  };
}

/**
 * Revoke an active session in PostgreSQL.
 */
async function revokeSession(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const tokenHash = hashSessionToken(token);

  const res = await pool.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash]
  );

  return res.rows.length > 0;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  registerPatient,
  authenticateUser,
  getSessionByToken,
  revokeSession,
  SESSION_TTL_MS,
};
