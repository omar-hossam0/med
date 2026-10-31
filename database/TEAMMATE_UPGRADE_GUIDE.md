# Teammate Upgrade Guide — Admin Backend + Database V2

**For:** the developer of the Admin Backend (`da8b0ac`)
**Goal:** take your local database from the Admin-only schema to the unified 42-table schema, without losing a single row.
**Time:** about 5 minutes, plus the preflight reply.

---

## 0. What is about to happen, in one paragraph

Your migrations `004_admin_workforce.sql` and `005_admin_account_lifecycle.sql` were **not modified** — not one byte. Database Simplification V2 was written *after* your work and its migrations were renumbered to `006`-`013` so they run **after** yours. Your `001`-`005` will be recognised as already applied and skipped. `006` then transforms `audit_logs` in place (`action` → `event_type` + `event_category`), copies every `security_events` row into `audit_logs`, and drops `security_events`. Nothing of yours is thrown away.

---

## 1. Do NOT do these

- Do **not** delete `schema_migrations`, or edit its rows.
- Do **not** `DROP DATABASE` / recreate the database.
- Do **not** run `db:migrate` before §2 and §3.
- Do **not** hand-edit migration `004` or `005`. Their checksums are what prove your history is intact.
- Do **not** run `npm run db:seed:demo` on a database you care about until the upgrade is verified.

---

## 2. Preflight — read-only, run this first and send me the output

This tells us whether your machine matches what I simulated. It changes nothing.

**PowerShell / Git Bash (Windows), from the repo root:**

```bash
# 2.1 which database am I actually on?
cd Backend
node -e "const p=require('./config/db');p.query('select current_database() db, current_user usr').then(r=>{console.log(r.rows[0]);return p.end()})"

# 2.2 what migration history do I have?
psql -h localhost -p 5432 -U postgres -d <YOUR_DB_NAME> -c "SELECT version, name, checksum FROM schema_migrations ORDER BY version;"

# 2.3 which tables exist right now?
psql -h localhost -p 5432 -U postgres -d <YOUR_DB_NAME> -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"

# 2.4 do I have the pre-V2 audit shape? (expect: action=1, event_type=0)
psql -h localhost -p 5432 -U postgres -d <YOUR_DB_NAME> -c "SELECT sum(CASE WHEN column_name='action' THEN 1 ELSE 0 END) AS action, sum(CASE WHEN column_name='event_type' THEN 1 ELSE 0 END) AS event_type FROM information_schema.columns WHERE table_name='audit_logs';"

# 2.5 how much data is at stake?
psql -h localhost -p 5432 -U postgres -d <YOUR_DB_NAME> -c "SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM doctor_profiles) doctors, (SELECT count(*) FROM staff_profiles) staff, (SELECT count(*) FROM audit_logs) audits, (SELECT count(*) FROM security_events) security;"
```

### How to read the result

| 2.2 shows | Meaning | What to do |
|---|---|---|
| exactly `001`-`005`, checksums present | Expected. Straight upgrade. | §3 |
| `001`-`004` only | You never ran 005. | §3 — the runner will apply 005 then 006-013. Still fine. |
| any version `006` or higher | You already pulled something. | **Stop**, send me 2.2 and 2.3. |
| checksums missing / NULL | History was inserted by hand. | **Stop**, send me 2.2. |
| `security_events` already gone in 2.3 | Someone already migrated. | **Stop**, send me 2.2 and 2.3. |

If 2.5 shows large real data (hundreds of patients), tell me before migrating — we will do a dry run on a copy instead.

---

## 3. Backup (mandatory, 30 seconds)

```bash
# Windows, from any shell — adjust the path
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -p 5432 -U postgres -d <YOUR_DB_NAME> -Fc -f "%USERPROFILE%\Desktop\medora_before_v2.dump"

# verify it is readable BEFORE you need it
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -l "%USERPROFILE%\Desktop\medora_before_v2.dump" | head -20
```

If `pg_restore -l` lists your tables, the backup is good. **A git branch is not a database backup.**

---

## 4. Pull and install

```bash
git checkout main
git pull origin main          # brings 3 commits: merge + unification + fix
cd Backend
npm install                   # package.json gained db:validate and test:schema
```

Confirm the migration files you expect are present:

```bash
ls ../database/migrations/
# 001 002 003 004_admin_workforce 005_admin_account_lifecycle
# 006_audit_logs_unification 007_scheduling_core 008_consultations_transcripts
# 009_agent_reports 010_followups_proposals 011_medical_records
# 012_reference_knowledge 013_audit_identity_reference
```

Confirm your two files are untouched:

```bash
git log --oneline -- ../database/migrations/004_admin_workforce.sql
# must show only: da8b0ac feat: implement admin account lifecycle management
```

---

## 5. Migrate

```bash
cd Backend
npm run db:migrate
```

### Expected output

```
Found 13 migration file(s); 5 already recorded.

[SKIP]    001_identity_access.sql — already applied
[SKIP]    002_single_admin_enforcement.sql — already applied
[SKIP]    003_patient_doctor_profiles.sql — already applied
[SKIP]    004_admin_workforce.sql — already applied
[SKIP]    005_admin_account_lifecycle.sql — already applied
Applying  006_audit_logs_unification.sql ...
[SUCCESS] 006_audit_logs_unification.sql
...
[SUCCESS] 013_audit_identity_reference.sql

Applied 8, skipped 5.
```

**The five `[SKIP]` lines are the proof your history was preserved.** If you see `Applying 004…` instead, stop — the runner did not recognise your history and you are about to re-create tables that already exist. It will fail safely on the first `CREATE TABLE`, but send me the output.

---

## 6. Verify (2 minutes)

```bash
# 6.1 exactly 42 tables
psql ... -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"

# 6.2 audit_logs transformed, security_events gone
psql ... -c "SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs' AND column_name IN ('action','event_type','event_category');"
psql ... -c "SELECT count(*) FROM information_schema.tables WHERE table_name='security_events';"   -- expect 0

# 6.3 your old audit rows survived and were remapped
psql ... -c "SELECT event_type, event_category, count(*) FROM audit_logs GROUP BY 1,2 ORDER BY 1;"
#   user.provisioned        | provisioning  | 3
#   doctor.verification_changed | approval  | 1
#   security.privilege_changed  | security  | 2   <- came from security_events

# 6.4 nobody was lost
psql ... -c "SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM doctor_profiles) doctors, (SELECT count(*) FROM staff_profiles) staff, (SELECT count(*) FROM user_invitations) invites;"

# 6.5 the ERD matches your database
npm run db:validate      # expect: [OK] ... matches PostgreSQL exactly

# 6.6 your API still works
npm test                 # expect: # pass 31  # fail 0
```

If 6.3 shows your old audit count is **lower** than the count in 2.5, stop and tell me — that is the only failure mode that could lose data, and it should be impossible because 006 copies before it drops.

---

## 7. What changed in code you wrote

Small and mechanical, but it will conflict if you have local edits.

### `services/auditService.js`

```js
// before
auditService.record(client, { action: "user.provisioned", ... });

// after
auditService.record(client, { eventType: "user.provisioned", eventCategory: "provisioning", ... });
```

`recordSecurityEvent()` keeps its signature — it just writes `audit_logs` now, and adds the `security.` prefix itself. `security_events` no longer exists.

### `tests/admin.test.js`

Three assertions moved to the new shape:

```js
// was: WHERE entity_id = $1 AND action = 'user.provisioned'
// now: WHERE entity_id = $1 AND event_type = 'user.provisioned'

// was: SELECT count(*) FROM security_events WHERE event_type='privilege_changed'
// now: SELECT count(*) FROM v_security_events WHERE event_type='security.privilege_changed'
```

Teardown no longer deletes audit rows — they are append-only evidence and the database refuses the delete. Test fixtures are still removed with `DELETE FROM users`, and their audit rows survive with `actor_user_id` set to NULL (migration 013).

### Nothing else

Routes, controllers, validators, serializers, response shapes, middleware and every frontend contract are unchanged. Your `npm run db:seed:demo` still works.

---

## 8. If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `Duplicate migration version 004` | You pulled an older commit, before the renumbering. | `git pull` again; confirm `006_audit_logs_unification.sql` exists. |
| `Checksum mismatch for 004_admin_workforce.sql` | Your 004 file differs from the committed one (local edit, or line endings rewritten). | `git diff da8b0ac -- database/migrations/004_admin_workforce.sql`. If it shows changes, restore it: `git checkout da8b0ac -- database/migrations/004_admin_workforce.sql`. Do not force the runner. |
| `relation "audit_logs" already exists` inside 006 | Your `audit_logs` was not the 005 shape. | Stop. Send 2.4 and the full error. |
| `audit_logs is append-only` during 006 | A trigger from an earlier attempt is present. | Stop, send the error. |
| Anything at all | — | `pg_restore -d <YOUR_DB_NAME> --clean --if-exists medora_before_v2.dump` restores §3 exactly. |

### Restore procedure (only if you must)

```bash
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -p 5432 -U postgres \
  -d <YOUR_DB_NAME> --clean --if-exists "%USERPROFILE%\Desktop\medora_before_v2.dump"
```

Then delete nothing else, and tell me what failed.

---

## 9. Reply template

Paste this back after §2 and §6:

```
DB name:            ...
2.2 versions:       ...
2.3 table count:    ...
2.4 action/event_type: .../...
2.5 rows:           users=… doctors=… staff=… audits=… security=…
migrate:            skipped=5 applied=8   (yes/no)
6.1 tables:         ...
6.3 audit groups:   ...
6.6 npm test:       pass=… fail=…
```

That is enough for me to confirm your database is on the same schema as mine.
