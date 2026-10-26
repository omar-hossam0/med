#!/usr/bin/env node

/**
 * Medora Healthcare — Single Admin Bootstrap Script
 *
 * Secure CLI script to provision the single initial Administrator account.
 * Enforces atomic creation and prevents duplicate Admin accounts.
 *
 * Usage:
 *   node Backend/scripts/bootstrap-admin.js
 * Or with environment variables:
 *   ADMIN_NAME="System Administrator" ADMIN_EMAIL="admin@medora.clinic" ADMIN_PASSWORD="SecurePassword123" node Backend/scripts/bootstrap-admin.js
 */

const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const argon2 = require("argon2");
const pool = require("../config/db");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkDatabaseReadiness(client) {
  const tablesCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('users', 'roles', 'user_roles');
  `);

  const foundTables = tablesCheck.rows.map((r) => r.table_name);
  const required = ["users", "roles", "user_roles"];
  const missing = required.filter((tbl) => !foundTables.includes(tbl));

  if (missing.length > 0) {
    throw new Error(
      `Database is not initialized. Missing tables: ${missing.join(
        ", "
      )}. Please apply migrations (database/migrations/001_identity_access.sql) first.`
    );
  }
}

async function promptForCredentials() {
  const rl = readline.createInterface({ input, output });

  try {
    const name =
      process.env.ADMIN_NAME ||
      (await rl.question("Enter Admin Full Name: ")).trim();

    const email =
      process.env.ADMIN_EMAIL ||
      (await rl.question("Enter Admin Email: ")).trim();

    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await rl.question("Enter Admin Password (min 8 chars, 1 uppercase, 1 lowercase, 1 digit): ");
    }

    return { name, email, password };
  } finally {
    rl.close();
  }
}

async function bootstrapAdmin() {
  console.log("\n==============================================");
  console.log("  Medora Healthcare — Admin Bootstrap Utility ");
  console.log("==============================================\n");

  const client = await pool.connect();
  try {
    // 1. Verify database schema readiness
    await checkDatabaseReadiness(client);

    // 2. Collect credentials securely
    const { name, email, password } = await promptForCredentials();

    // 3. Validate credentials
    if (!name || name.trim().length < 2) {
      throw new Error("Admin full name must be at least 2 characters long.");
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      throw new Error("A valid email address is required.");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new Error(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number."
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // 4. Begin transaction with table lock to prevent concurrent bootstrap
    await client.query("BEGIN");
    await client.query("LOCK TABLE user_roles IN EXCLUSIVE MODE");

    // Check if an Admin account already exists
    const existingAdmin = await client.query(`
      SELECT ur.user_id, u.email
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN users u ON ur.user_id = u.id
      WHERE r.name = 'admin'
      LIMIT 1;
    `);

    if (existingAdmin.rows.length > 0) {
      await client.query("ROLLBACK");
      console.error(
        `\n[Policy Violation] An Admin account already exists in Medora (${existingAdmin.rows[0].email}).`
      );
      console.error("Only a single Admin account is permitted in Phase 1.");
      process.exitCode = 1;
      return;
    }

    // Check if user with this email already exists
    const duplicateEmail = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );

    if (duplicateEmail.rows.length > 0) {
      await client.query("ROLLBACK");
      console.error(
        `\n[Error] A user with email '${normalizedEmail}' already exists.`
      );
      process.exitCode = 1;
      return;
    }

    // Lookup admin role ID
    const adminRoleRes = await client.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );

    if (adminRoleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error(
        "The 'admin' role was not found in the roles table. Ensure database migrations are seeded properly."
      );
    }

    const adminRoleId = adminRoleRes.rows[0].id;

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    // Insert Admin user (email_verified_at set to NOW() since bootstrapped by owner)
    const userRes = await client.query(
      `INSERT INTO users (full_name, email, password_hash, status, created_by, email_verified_at)
       VALUES ($1, $2, $3, 'active', NULL, NOW())
       RETURNING id, full_name, email, status, created_at`,
      [trimmedName, normalizedEmail, passwordHash]
    );

    const adminUser = userRes.rows[0];

    // Assign 'admin' role
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [adminUser.id, adminRoleId]
    );

    await client.query("COMMIT");

    console.log("\n[SUCCESS] Single Admin account created successfully!");
    console.log(`- User ID: ${adminUser.id}`);
    console.log(`- Full Name: ${adminUser.full_name}`);
    console.log(`- Email: ${adminUser.email}`);
    console.log(`- Status: ${adminUser.status}`);
    console.log(`- Role: admin`);
    console.log("\nYou may now sign in using the common login page at http://localhost:3000/login\n");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error(`\n[Bootstrap Error] ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  bootstrapAdmin();
}

module.exports = { bootstrapAdmin };
