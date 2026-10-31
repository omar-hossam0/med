#!/usr/bin/env node

/**
 * Medora Healthcare — DBML canonical-schema validator.
 *
 * database/medora.dbml is the single source of truth for the ERD, so it must be
 * provably identical to the live database. This script checks:
 *
 *   1. the DBML parses: every Table block has columns, no duplicate table names
 *   2. every Ref resolves to a real table and a real column on both sides
 *   3. every table belongs to exactly one TableGroup, and no group names a
 *      table that does not exist
 *   4. no reference to a retired (consolidated) table survives
 *   5. the DBML table set equals the live PostgreSQL base-table set
 *   6. the DBML columns equal the live columns, table by table
 *
 * Usage: npm run db:validate
 * Exit code 1 on any failure.
 */

const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const DBML_PATH = path.resolve(__dirname, "../../database/medora.dbml");

const RETIRED_TABLES = [
  "appointment_status_history",
  "transcript_approvals",
  "report_approvals",
  "report_deliveries",
  "document_extraction_jobs",
  "security_events",
];

const problems = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) problems.push(message);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------
function parseDbml(source) {
  const lines = source.split(/\r?\n/);

  const tables = new Map(); // name -> Set(column)
  const groups = new Map(); // groupName -> [table]
  const refs = [];          // { leftTable, leftCol, rightTable, rightCol, raw }

  let current = null;        // { name, columns:Set, depth }
  let groupName = null;
  let inIndexes = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("//") || line === "") continue;

    if (current) {
      if (line === "}") {
        if (inIndexes > 0) {
          inIndexes -= 1;
          continue;
        }
        tables.set(current.name, current.columns);
        current = null;
        continue;
      }
      if (line.startsWith("indexes")) {
        inIndexes += 1;
        continue;
      }
      if (inIndexes > 0) continue;
      if (line.startsWith("Note:") || line.startsWith("note:")) continue;

      const col = /^([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z]/.exec(line);
      if (col) current.columns.add(col[1]);
      continue;
    }

    if (groupName) {
      if (line === "}") {
        groupName = null;
        continue;
      }
      const g = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(line);
      if (g) groups.get(groupName).push(g[1]);
      continue;
    }

    const tableMatch = /^Table\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(line);
    if (tableMatch) {
      current = { name: tableMatch[1], columns: new Set() };
      continue;
    }

    const groupMatch = /^TableGroup\s+"([^"]+)"\s*\{/.exec(line);
    if (groupMatch) {
      groupName = groupMatch[1];
      groups.set(groupName, []);
      continue;
    }

    const refMatch = /^Ref:\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*([<>-])\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
    if (refMatch) {
      refs.push({
        leftTable: refMatch[1],
        leftCol: refMatch[2],
        rightTable: refMatch[4],
        rightCol: refMatch[5],
        raw: line,
      });
    }
  }

  return { tables, groups, refs };
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n==============================================");
  console.log("  Medora — DBML canonical schema validation");
  console.log("==============================================\n");

  const source = fs.readFileSync(DBML_PATH, "utf8");
  const { tables, groups, refs } = parseDbml(source);

  // 1. Parse sanity
  check(tables.size === 39, `DBML declares ${tables.size} tables, expected 39`);
  for (const [name, cols] of tables) {
    check(cols.size > 0, `table ${name} has no parsed columns`);
  }

  // 2. Every Ref resolves
  for (const ref of refs) {
    check(tables.has(ref.leftTable),
      `Ref points at unknown table "${ref.leftTable}": ${ref.raw}`);
    check(tables.has(ref.rightTable),
      `Ref points at unknown table "${ref.rightTable}": ${ref.raw}`);
    if (tables.has(ref.leftTable)) {
      check(tables.get(ref.leftTable).has(ref.leftCol),
        `Ref points at unknown column ${ref.leftTable}.${ref.leftCol}: ${ref.raw}`);
    }
    if (tables.has(ref.rightTable)) {
      check(tables.get(ref.rightTable).has(ref.rightCol),
        `Ref points at unknown column ${ref.rightTable}.${ref.rightCol}: ${ref.raw}`);
    }
  }

  // 3. TableGroups cover every table exactly once
  const grouped = new Map();
  for (const [name, members] of groups) {
    for (const member of members) {
      check(tables.has(member),
        `TableGroup "${name}" lists unknown table "${member}"`);
      check(!grouped.has(member),
        `table "${member}" is in both "${grouped.get(member)}" and "${name}"`);
      grouped.set(member, name);
    }
  }
  for (const name of tables.keys()) {
    check(grouped.has(name), `table "${name}" belongs to no TableGroup`);
  }

  // 4. No retired table survives anywhere
  for (const retired of RETIRED_TABLES) {
    check(!tables.has(retired), `retired table "${retired}" is still declared`);
    const mentionedInRef = refs.some(
      (r) => r.leftTable === retired || r.rightTable === retired
    );
    check(!mentionedInRef, `a Ref still targets retired table "${retired}"`);
    check(!grouped.has(retired), `a TableGroup still lists retired table "${retired}"`);
  }

  // 5 and 6. Compare against the live database
  const client = await pool.connect();
  try {
    const { rows: liveTables } = await client.query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `);
    const live = liveTables.map((r) => r.table_name);

    check(live.length === 39, `live database has ${live.length} tables, expected 39`);

    const dbmlOnly = [...tables.keys()].filter((t) => !live.includes(t));
    const liveOnly = live.filter((t) => !tables.has(t));
    check(dbmlOnly.length === 0, `declared in DBML but missing in PostgreSQL: ${dbmlOnly.join(", ")}`);
    check(liveOnly.length === 0, `present in PostgreSQL but missing from DBML: ${liveOnly.join(", ")}`);

    const { rows: liveColumns } = await client.query(`
      SELECT table_name, column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position
    `);
    const byTable = new Map();
    for (const row of liveColumns) {
      if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
      byTable.get(row.table_name).add(row.column_name);
    }

    for (const [table, cols] of tables) {
      const liveCols = byTable.get(table);
      if (!liveCols) continue; // already reported as missing
      const missingInDbml = [...liveCols].filter((c) => !cols.has(c));
      const missingInDb = [...cols].filter((c) => !liveCols.has(c));
      check(missingInDbml.length === 0,
        `${table}: PostgreSQL columns absent from DBML: ${missingInDbml.join(", ")}`);
      check(missingInDb.length === 0,
        `${table}: DBML columns absent from PostgreSQL: ${missingInDb.join(", ")}`);
    }

    const { rows: views } = await client.query(`
      SELECT table_name FROM information_schema.views
       WHERE table_schema = 'public' ORDER BY table_name
    `);

    console.log(`DBML tables      : ${tables.size}`);
    console.log(`DBML refs        : ${refs.length}`);
    console.log(`DBML table groups: ${groups.size} (${[...groups.keys()].join(", ")})`);
    console.log(`Live base tables : ${live.length}`);
    console.log(`Live views       : ${views.map((v) => v.table_name).join(", ") || "(none)"}`);
    console.log(`Checks run       : ${checks}\n`);
  } finally {
    client.release();
    await pool.end();
  }

  if (problems.length > 0) {
    console.error(`[FAILED] ${problems.length} problem(s):`);
    problems.forEach((p) => console.error(` - ${p}`));
    process.exitCode = 1;
  } else {
    console.log("[OK] DBML parses, references resolve, and it matches PostgreSQL exactly.\n");
  }
}

main().catch((err) => {
  console.error(`\n[Validator Error] ${err.message}\n`);
  process.exitCode = 1;
});
