# Medora — Database Simplification V2 · Preflight Report

Generated before any schema change. Every statement below was read from the live
server, the repository, or both. Nothing here is assumed from the earlier CareOS
report or from the ERD alone.

---

## 1. Connection target

| Item | Verified value |
|---|---|
| Server | `localhost:5432` (loopback only) |
| Server version | PostgreSQL 18.6 (x86_64-windows, MSVC 19.44) |
| Database | **`medora_v1`** |
| Connecting role | `postgres` (superuser, local install) |
| Schemas | `public` only |
| Extensions | `pgcrypto`, `plpgsql` |
| Environment class | **Local development** (see §5) |
| Configured by | `Backend/.env` → `Backend/config/db.js` |

### ⚠ Naming discrepancy (resolved, not blocking)

`AGENTS.md`, `SCHEMA_ARCHITECTURE.md` and the task brief refer to the database as
`medora_db`. The only Medora database that exists on this server is **`medora_v1`**,
and `Backend/.env` — the file `config/db.js` actually loads — points at `medora_v1`.
`medora_db` does **not** exist (`pg_database` was queried). This work therefore
targets `medora_v1`, the database the application itself uses. No database was
created, renamed or dropped. The naming discrepancy is recorded in the final
report as an open documentation decision; it is not a reason to touch the server.

## 2. Physical tables in `public`

**6 base tables.** Not 45.

| Table | Rows |
|---|---|
| `permissions` | 15 |
| `role_permissions` | 16 |
| `roles` | 4 |
| `sessions` | 10 (6 revoked) |
| `user_roles` | 2 |
| `users` | 2 |

`schema_migrations` **does not exist** — the tracking table was never created on
this database, so applied-migration history is currently untracked.

## 3. Migration state

| Version | File on disk | Applied to `medora_v1`? | Evidence |
|---|---|---|---|
| 001 | `001_identity_access.sql` | **Yes, but unrecorded** | the 6 tables, 4 roles, 15 permissions, 16 grants and `uq_users_email_lower` all match the file |
| 002 | `002_single_admin_enforcement.sql` | **Yes, but unrecorded** | `enforce_single_admin()` and trigger `trg_enforce_single_admin` on `user_roles` exist |
| 003 | `003_patient_doctor_profiles.sql` | **No** | `patient_profiles`, `specialties`, `doctor_profiles` and `set_updated_at()` are absent |

Checksum drift cannot be evaluated because no history rows exist. No migration
file has been edited as part of this work; 001/002/003 are untouched.

## 4. Existing objects (summary)

- **Foreign keys (6):** `users.created_by`, `user_roles → users/roles`,
  `role_permissions → roles/permissions`, `sessions → users`. All `CASCADE`
  except `users.created_by` (`SET NULL`).
- **Indexes (12):** 6 primary keys, `uq_users_email_lower`,
  `permissions_code_key`, `roles_name_key`, `sessions_token_hash_key`,
  `idx_sessions_user_id`, `idx_sessions_expires_at`.
- **CHECK constraints (1):** `users_status_check`.
- **Triggers (1):** `trg_enforce_single_admin` (BEFORE INSERT/UPDATE on `user_roles`).
- **Functions:** `enforce_single_admin()` plus the `pgcrypto` built-ins.

## 5. Data classification — safe to proceed

| Check | Result |
|---|---|
| Real patients? | No. Two accounts: `admin@medora.com` ("Medora Administrator") and `omar@gmail.com` ("omar hossam", patient) — the developer's own seed accounts. |
| Clinical data anywhere? | No. No clinical table exists. |
| Production indicators? | None: loopback host, superuser `postgres`, no TLS, no replication, single database, `.env` is gitignored and marked local-development. |
| Verdict | **Development database. Consolidation may proceed.** |

## 6. References to the six consolidation candidates

| Candidate table | Physically exists | Rows | Backend / frontend references |
|---|---|---|---|
| `appointment_status_history` | No | — | none |
| `transcript_approvals` | No | — | none |
| `report_approvals` | No | — | none |
| `report_deliveries` | No | — | none |
| `document_extraction_jobs` | No | — | none |
| `security_events` | No | — | none |

`grep` over `Backend/`, `src/` and `scripts/` (excluding `node_modules`) returns
**zero** matches for all six names. The backend today is authentication only:
`server.js`, `routes/authRoutes.js`, `controllers/authController.js`,
`services/authService.js`, `middleware/{auth,csrf,errorHandler,rateLimiter}.js`,
`tests/auth.test.js`.

## 7. Logical ERD state

`database/medora.dbml` declares **45 tables**: 9 implemented
(`users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions`,
`patient_profiles`, `specialties`, `doctor_profiles`) plus `schema_migrations`,
and 35 design-only tables.

Because the six consolidation candidates are **not physically deployed**, the
brief's instruction applies directly:

> If any affected table is not yet physically deployed, implement the correct
> simplified version directly in the next unapplied numbered migration, rather
> than creating an obsolete table only to drop it later.

## 8. Consequence for the migration plan

- **No destructive migration is required.** There is no table to drop, no row to
  backfill, no duplicate to reconcile, no foreign key to repoint.
- The six consolidations become **design decisions applied at creation time**.
  This removes the highest-risk part of the brief entirely: no
  `DROP TABLE`, no `TRUNCATE`, no data loss window, no restore dependency.
- The work is **purely additive** (new tables, new columns on tables that do not
  yet exist, new constraints, new triggers, new views), so it follows the
  project's normal additive-migration rule rather than the destructive-approval
  gate. A backup is still taken (§9).
- `003` must be applied first, because `patient_profiles` / `doctor_profiles` /
  `specialties` are part of the 39-table target and later tables reference
  `users` through them conceptually.
- The missing `schema_migrations` table must be baselined for `001` and `002`
  before `db:migrate` runs, otherwise the runner would re-execute `001` against
  a populated database and fail on the first `CREATE TABLE users`.

### Planned numbering (after the highest applied version, 002)

| File | Content |
|---|---|
| 004 | `audit_logs` (absorbs appointment status history + security events), `notifications` |
| 005 | `clinic_locations`, `doctor_availability`, `doctor_time_off`, `appointments`, `care_relationships` |
| 006 | `consultations`, `consultation_consents`, `consultation_recordings`, `transcripts`, `agent_executions`, `transcript_versions` (absorbs approvals) |
| 007 | `medical_reports` (absorbs publication), `report_versions` (absorbs approvals), `record_update_proposals` |
| 008 | `follow_ups`, `appointment_proposals` |
| 009 | six medical-record tables |
| 010 | `reference_documents`, `reference_document_versions`, `reference_chunks`, `rag_queries`, `rag_citations` |

## 9. Backup

Taken before migration, custom format, stored outside the repository working
tree. Details and verification result are in the final report. No secret,
password or connection string is written to any artifact.

## 10. Blockers found

None. The one open documentation question is the `medora_db` vs `medora_v1`
naming, which does not affect the schema work.
