#!/usr/bin/env node

/**
 * Medora Healthcare — Migration Baseline Utility
 *
 * Records migrations as already applied WITHOUT executing them.
 *
 * Use this only for a database that already has the Phase 1 schema but no
 * schema_migrations history — for example the original developer's local
 * database, which was migrated before the tracking table existed.
 *
 * Safety model:
 *   1. The live schema is inspected against the expected Phase 1 fingerprint.
 *   2. If any check fails, nothing is recorded and the command exits non-zero.
 *   3. Versions must be named explicitly; there is no "record everything" mode,
 *      so a future migration can never be marked applied by accident.
 *
 * Usage:
 *   npm run db:baseline -- 001 002
 *
 * This is not a substitute for db:migrate. A fresh database must be built by
 * running the migrations, not by baselining them.
 */

const pool = require("../config/db");
const {
  HISTORY_TABLE,
  ADVISORY_LOCK_KEY,
  CREATE_HISTORY_TABLE,
  readMigrations,
  readApplied,
} = require("./lib/migrations");

const EXPECTED_ROLES = ["admin", "doctor", "patient", "receptionist"];
const EXPECTED_TABLES = [
  "permissions",
  "role_permissions",
  "roles",
  "sessions",
  "user_roles",
  "users",
];

/** Inspect the live schema and return a list of human-readable failures. */
async function inspectPhaseOneSchema(client) {
  const failures = [];

  const { rows: tableRows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const tables = tableRows.map((r) => r.table_name);

  const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
  if (missing.length > 0) {
    failures.push(`Missing tables: ${missing.join(", ")}`);
  }

  if (missing.length === 0) {
    const { rows: roleRows } = await client.query(
      "SELECT name FROM roles ORDER BY name"
    );
    const names = roleRows.map((r) => r.name);
    const expected = [...EXPECTED_ROLES].sort();

    if (names.length !== expected.length || names.join(",") !== expected.join(",")) {
      failures.push(
        `roles should contain exactly [${expected.join(", ")}], found [${names.join(", ")}]`
      );
    }

    const counts = [
      ["permissions", 15],
      ["role_permissions", 16],
    ];
    for (const [table, expectedCount] of counts) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM ${table}`
      );
      if (rows[0].n !== expectedCount) {
        failures.push(`${table} should hold ${expectedCount} rows, found ${rows[0].n}`);
      }
    }

    const { rows: triggerRows } = await client.query(`
      SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND c.relname = 'user_roles';
    `);
    if (!triggerRows.some((r) => r.tgname === "trg_enforce_single_admin")) {
      failures.push("Trigger trg_enforce_single_admin is missing from user_roles");
    }

    const { rows: indexRows } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'users';
    `);
    if (!indexRows.some((r) => r.indexname === "uq_users_email_lower")) {
      failures.push("Index uq_users_email_lower is missing from users");
    }
  }

  return { tables, failures };
}

async function runBaseline(requestedVersions) {
  console.log("\n==============================================");
  console.log("  Medora Healthcare — Migration Baseline");
  console.log("==============================================\n");

  const migrations = readMigrations();
  const byVersion = new Map(migrations.map((m) => [m.version, m]));

  const unknown = requestedVersions.filter((v) => !byVersion.has(v));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown migration version(s): ${unknown.join(", ")}. ` +
        `Available: ${migrations.map((m) => m.version).join(", ")}`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    const { tables, failures } = await inspectPhaseOneSchema(client);

    console.log("Inspecting live schema ...");
    console.log(`  tables found: ${tables.join(", ") || "(none)"}\n`);

    if (failures.length > 0) {
      console.error("[REFUSED] The live schema does not match Phase 1:");
      failures.forEach((f) => console.error(`  - ${f}`));
      console.error(
        "\nNothing was recorded. Build the database with `npm run db:migrate` instead.\n"
      );
      process.exitCode = 1;
      return;
    }

    console.log("[OK] Phase 1 fingerprint verified.\n");

    await client.query(CREATE_HISTORY_TABLE);
    const applied = await readApplied(client);

    let recorded = 0;
    for (const version of requestedVersions) {
      const migration = byVersion.get(version);

      if (applied.has(version)) {
        if (applied.get(version) !== migration.checksum) {
          console.warn(
            `[WARN] ${migration.name} is recorded with a different checksum. ` +
              `The file has changed since it was baselined.`
          );
        } else {
          console.log(`[SKIP] ${migration.name} — already recorded`);
        }
        continue;
      }

      await client.query(
        `INSERT INTO ${HISTORY_TABLE} (version, name, checksum) VALUES ($1, $2, $3)`,
        [version, migration.name, migration.checksum]
      );
      console.log(`[BASELINED] ${migration.name} — recorded without executing`);
      recorded += 1;
    }

    console.log(`\nRecorded ${recorded} version(s). No SQL was executed.\n`);
    console.log("Next: run `npm run db:migrate` — it should report nothing pending.\n");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch (_) {}
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));

  if (requested.length === 0) {
    console.error(
      "\n[Usage] npm run db:baseline -- <version> [version ...]\n" +
        "  Example: npm run db:baseline -- 001 002\n\n" +
        "  Versions must be named explicitly so a future migration cannot be\n" +
        "  marked as applied by accident.\n"
    );
    process.exitCode = 1;
  } else {
    runBaseline(requested).catch((err) => {
      console.error(`\n[Baseline Error] ${err.message}\n`);
      process.exitCode = 1;
    });
  }
}

module.exports = { runBaseline, inspectPhaseOneSchema };
