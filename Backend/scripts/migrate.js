#!/usr/bin/env node

/**
 * Medora Healthcare — Database Migration Runner
 *
 * Applies every pending migration in database/migrations, in filename order,
 * exactly once, and records what it applied in the schema_migrations table.
 *
 * Behaviour:
 *   - discovers migrations from the directory (no hard-coded list)
 *   - skips versions already recorded in schema_migrations
 *   - detects checksum drift on an already-applied file and refuses to continue
 *   - runs each migration and its history row inside one transaction
 *   - holds a session-level advisory lock so two runners cannot interleave
 *   - stops on the first failure without dropping or resetting anything
 *
 * Usage:
 *   npm run db:migrate
 *
 * For a database that already has the schema but no history (for example one
 * migrated before this runner existed), use `npm run db:baseline -- 001 002`
 * first. Do not re-run migrations against a populated database to "fix" it.
 */

const pool = require("../config/db");
const {
  HISTORY_TABLE,
  ADVISORY_LOCK_KEY,
  CREATE_HISTORY_TABLE,
  readMigrations,
  readApplied,
} = require("./lib/migrations");

function banner(title) {
  console.log("\n==============================================");
  console.log(`  ${title}`);
  console.log("==============================================\n");
}

async function runMigrations() {
  banner("Medora Healthcare — Database Migration Runner");

  const migrations = readMigrations();
  const client = await pool.connect();
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    // Serialise concurrent runners. Released in `finally`, and automatically
    // by PostgreSQL if this process dies with the connection still open.
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    await client.query(CREATE_HISTORY_TABLE);
    const applied = await readApplied(client);

    console.log(
      `Found ${migrations.length} migration file(s); ${applied.size} already recorded.\n`
    );

    for (const migration of migrations) {
      const recordedChecksum = applied.get(migration.version);

      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== migration.checksum) {
          throw new Error(
            `Checksum mismatch for ${migration.name} (version ${migration.version}).\n` +
              `  recorded: ${recordedChecksum}\n` +
              `  on disk:  ${migration.checksum}\n` +
              `An applied migration must never be edited. Revert the file, or add a new\n` +
              `migration that changes the schema instead.`
          );
        }

        console.log(`[SKIP]    ${migration.name} — already applied`);
        skippedCount += 1;
        continue;
      }

      console.log(`Applying  ${migration.name} ...`);

      await client.query("BEGIN");
      try {
        // `pg` uses the simple query protocol when no parameters are passed,
        // so a file containing multiple statements executes as one batch.
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${HISTORY_TABLE} (version, name, checksum) VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${migration.name} failed and was rolled back: ${err.message}`
        );
      }

      console.log(`[SUCCESS] ${migration.name}`);
      appliedCount += 1;
    }

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const db = await client.query("SELECT current_database() AS name");

    console.log(
      `\nApplied ${appliedCount}, skipped ${skippedCount}. Database: ${db.rows[0].name}`
    );
    console.log("Public tables:");
    tables.rows.forEach((r) => console.log(` - ${r.table_name}`));

    const history = await client.query(
      `SELECT version, name, applied_at FROM ${HISTORY_TABLE} ORDER BY version`
    );
    console.log(`\n${HISTORY_TABLE}:`);
    history.rows.forEach((r) =>
      console.log(` - ${r.version}  ${r.name}  ${r.applied_at.toISOString()}`)
    );

    console.log("\nMigrations completed successfully.\n");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch (_) {
      // The connection may already be broken; the lock dies with the session.
    }
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error(`\n[Migration Error] ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runMigrations };
