#!/usr/bin/env node

/**
 * Medora Healthcare — Database Migration Runner
 *
 * Safely applies database migrations in sequential order.
 * Run this only after reviewing and approving the migration SQL files.
 *
 * Usage:
 *   npm run db:migrate
 */

const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const MIGRATIONS = [
  "001_identity_access.sql",
  "002_single_admin_enforcement.sql",
];

async function runMigrations() {
  console.log("\n==============================================");
  console.log("  Medora Healthcare — Database Migration Runner");
  console.log("==============================================\n");

  const migrationsDir = path.resolve(__dirname, "../../database/migrations");

  const client = await pool.connect();
  try {
    for (const file of MIGRATIONS) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`[WARN] Migration file not found: ${filePath}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(filePath, "utf8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`[SUCCESS] Applied ${file}`);
    }

    // Verify created tables
    const res = await client.query(`
      SELECT current_database() AS database_name, table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\nCurrent public tables in ${res.rows[0]?.database_name || "the connected database"}:`);
    res.rows.forEach((r) => console.log(` - ${r.table_name}`));

    console.log("\nMigrations completed successfully.\n");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error(`\n[Migration Error] ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
