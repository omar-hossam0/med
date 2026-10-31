# Medora

AI-assisted healthcare platform for patients, doctors, reception staff and administrators.

Next.js (App Router) front end with a standalone Express + PostgreSQL API.

---

## Prerequisites

| Requirement | Version used |
|---|---|
| Node.js | 22.x |
| PostgreSQL | 18 |
| npm | 10.x |

---

## Quick start

### 1. Install dependencies

The repository has **two** package trees. Both must be installed.

```bash
npm install                    # front end
npm --prefix Backend install   # API
```

### 2. Create the environment file

```bash
cp Backend/.env.example Backend/.env          # macOS / Linux
Copy-Item Backend\.env.example Backend\.env   # Windows PowerShell
```

Then edit `Backend/.env` and set `DB_USER` and `DB_PASSWORD` to your local
PostgreSQL credentials. `.env` is git-ignored — never commit it.

### 3. Create the database

The application expects a database named `medora_db`.

```sql
CREATE DATABASE medora_db WITH ENCODING 'UTF8';
```

Use the default template, collation and character type. Setting them manually
is a common cause of later comparison and index errors.

### 4. Verify the connection

```bash
npm --prefix Backend run db:test
```

Expected output:

```
PostgreSQL connection successful. Database: medora_db
```

### 5. Apply migrations

**Fresh database** — build it from the migrations:

```bash
npm --prefix Backend run db:migrate
```

**Database that already has the schema but no migration history** — for example
one migrated before `schema_migrations` existed. Inspect and record, do **not**
re-run the SQL:

```bash
npm --prefix Backend run db:baseline -- 001 002
npm --prefix Backend run db:migrate      # should report nothing pending
```

`db:baseline` verifies the live schema against the expected Phase 1 fingerprint
first. If the schema does not match, it records nothing and exits non-zero.

### 6. Create the single Admin account

Run once, interactively, and choose the credentials yourself:

```bash
npm --prefix Backend run bootstrap:admin
```

The database enforces **exactly one** Admin account. A second attempt is
rejected. This script is not a public API and must never run automatically.

### 7. Run both servers

```bash
npm run dev
```

- Front end: <http://localhost:3000>
- API: <http://localhost:5000>

The Next.js dev server proxies `/api/*` to the API, so the browser only ever
talks to port 3000.

---

## Commands

### Root

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and front end together |
| `npm run dev:frontend` | Next.js only |
| `npm run dev:backend` | API only |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

### `Backend/`

| Command | Purpose |
|---|---|
| `npm run dev` | API with nodemon |
| `npm run db:test` | Verify the database connection |
| `npm run db:migrate` | Apply pending migrations, recording each one |
| `npm run db:baseline -- 001 002` | Record migrations as applied **without executing** |
| `npm run bootstrap:admin` | Create the single Admin account (interactive) |
| `npm run db:seed:demo -- --confirm` | Opt-in demo doctors and staff (`@medora.example`), local databases only |
| `npm test` | Authentication and admin API test suites |

> `db:seed:demo` writes nothing without `--confirm`. It refuses `NODE_ENV=production`
> and non-local hosts, skips accounts that already exist, and goes through the real
> provisioning service. Add `--activate` to set a generated password for each new
> account and print the credentials once.

---

## Database

One database (`medora_db`), one PostgreSQL schema (`public`), one ERD
(`database/medora.dbml`), one versioned migration per schema change.

```
database/
├── medora.dbml                       # design reference — not executable
├── medora.dbdiagram                  # dbdiagram.io layout
└── migrations/
    ├── 001_identity_access.sql       # tables, roles, permissions, RBAC seeds
    ├── 002_single_admin_enforcement.sql
    └── 003_patient_doctor_profiles.sql
```

### Tables

| Group | Tables |
|---|---|
| Identity (001) | `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `sessions` |
| Profiles (003) | `patient_profiles`, `specialties`, `doctor_profiles` |
| Migration history | `schema_migrations` (managed by the runner) |

### Migration rules

1. **Never edit an applied migration.** The runner stores a checksum and will
   refuse to proceed if a recorded file changes.
2. **Never re-run migrations against a populated database.** Use `db:baseline`
   for a database that already has the schema.
3. **One change per new file**, numbered sequentially (`003_...`).
4. `schema_migrations` is the source of truth for what has been applied. The
   runner creates it automatically.

### Roles

| Role | Created by | Notes |
|---|---|---|
| `patient` | Public sign-up | Name, email, password only |
| `admin` | `bootstrap:admin` | Exactly one per database |
| `doctor` | Admin (future module) | Never self-registers |
| `receptionist` | Admin (future module) | Represents operational staff |

---

## Project structure

```
Backend/
├── server.js                 # Express entry point
├── config/db.js              # pg pool
├── routes/                   # route tables
├── controllers/              # HTTP handlers
├── services/                 # business logic and data access
├── middleware/               # auth, CSRF, rate limiting, errors
├── scripts/                  # migrate, baseline, bootstrap-admin
└── tests/

src/
├── app/                      # App Router routes
├── components/               # UI, grouped by area
└── lib/                      # auth context, helpers, mock data
```

---

## Troubleshooting

**`SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`**
`DB_PASSWORD` is missing from `Backend/.env`.

**`password authentication failed`**
The password in `Backend/.env` is wrong, or `DB_USER` names a different role.

**`relation "users" already exists`**
The database already has the schema but no migration history. Run
`npm run db:baseline -- 001 002`, then `db:migrate`.

**`ECONNREFUSED`**
PostgreSQL is not running, or `DB_HOST`/`DB_PORT` are wrong. On Windows the
service is `postgresql-x64-18`.

---

## Documentation

| File | Contents |
|---|---|
| `AGENTS.md` | Repository conventions and coding rules |
| `Admin.md` | Admin module product context |
| `PatientJourney.md` | Patient journey change summary |
| `DB_NEXT_STEP.md` | Backend roadmap analysis and next step |
| `PHASE2_003_DECISIONS.md` | Phase 2 schema decisions and trade-offs |
| `CHANGES_AND_NEXT_STEPS.md` | Full record of changes made and the work remaining |
| `audit/` | Back-end audit report and coverage ledger |
