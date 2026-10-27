/**
 * Medora Healthcare — migration discovery and checksum helpers.
 *
 * Shared by scripts/migrate.js (apply) and scripts/baseline.js (record an
 * already-migrated database without executing anything).
 *
 * No side effects on import: this module must be safe to require from either
 * command without opening a database connection.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../database/migrations");

/** Name of the history table. Created by the runner if it does not exist. */
const HISTORY_TABLE = "schema_migrations";

/** Arbitrary but stable key for pg_advisory_lock, unique to this project. */
const ADVISORY_LOCK_KEY = 727001;

const CREATE_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
    version    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    checksum   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/**
 * SHA-256 of a migration file, with CRLF normalised to LF.
 *
 * The normalisation matters on a mixed Windows/Linux team: the same file
 * checked out with different line endings must produce the same checksum,
 * otherwise every teammate sees a false "file was edited" drift warning.
 */
function checksum(sql) {
  return crypto
    .createHash("sha256")
    .update(sql.replace(/\r\n/g, "\n"))
    .digest("hex");
}

/**
 * Read every .sql file in database/migrations, ordered by filename.
 *
 * Returns [{ version, name, sql, checksum }] where version is the leading
 * numeric prefix ("001") and name is the full filename.
 */
function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .sql migration files found in ${MIGRATIONS_DIR}`);
  }

  const seen = new Map();

  return files.map((name) => {
    const match = /^(\d+)_/.exec(name);
    if (!match) {
      throw new Error(
        `Migration "${name}" does not start with a numeric version prefix (e.g. 003_).`
      );
    }

    const version = match[1];
    if (seen.has(version)) {
      throw new Error(
        `Duplicate migration version ${version}: "${seen.get(version)}" and "${name}".`
      );
    }
    seen.set(version, name);

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");

    return { version, name, sql, checksum: checksum(sql) };
  });
}

/** Read applied versions as a Map<version, checksum>. */
async function readApplied(client) {
  const { rows } = await client.query(
    `SELECT version, checksum FROM ${HISTORY_TABLE}`
  );
  return new Map(rows.map((r) => [r.version, r.checksum]));
}

module.exports = {
  MIGRATIONS_DIR,
  HISTORY_TABLE,
  ADVISORY_LOCK_KEY,
  CREATE_HISTORY_TABLE,
  checksum,
  readMigrations,
  readApplied,
};
