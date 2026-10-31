#!/usr/bin/env node

/**
 * Medora — opt-in demo workforce seed
 *
 * Creates a small, realistic set of doctor and staff accounts so the Admin
 * directory can be demonstrated. It is deliberately hard to run by accident:
 *
 *   • does nothing without --confirm
 *   • refuses to run when NODE_ENV=production
 *   • refuses a non-local database host unless --allow-remote is passed
 *   • prints the exact target host/database before writing
 *   • skips any email that already exists, so re-running is safe
 *
 * It goes through the real provisioning service, not raw SQL, so every account
 * gets the same validation, transaction, invitation, notification and audit
 * rows as one created from the UI.
 *
 * Usage:
 *   node scripts/seed-demo-workforce.js --confirm
 *   node scripts/seed-demo-workforce.js --confirm --activate
 *   node scripts/seed-demo-workforce.js --confirm --activate --links
 *
 * Accounts use @medora.example addresses and are for local development only.
 * They are not real people and must never be loaded into a shared environment.
 */

const crypto = require("crypto");
const pool = require("../config/db");
const adminUsersService = require("../services/adminUsersService");
const invitationService = require("../services/invitationService");

const EMAIL_DOMAIN = "medora.example";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/** Deterministic fixtures: stable emails, licences and employment ids. */
const DOCTORS = [
  {
    name: "Dr. Sarah Mohamed",
    local: "sarah.mohamed",
    specialty: "Dermatology",
    department: "Dermatology",
    title: "Dermatologist",
    license: "MD-DEMO-88412",
    years: 6,
    location: "West Clinic",
    dob: "1992-09-02",
    phone: "+20 100 987 6543",
    about:
      "Dermatologist specialising in medical and cosmetic dermatology, with a patient-first approach to skin health.",
  },
  {
    name: "Dr. Ahmed Hassan",
    local: "ahmed.hassan",
    specialty: "Cardiology",
    department: "Cardiology",
    title: "Consultant Cardiologist",
    license: "MD-DEMO-12345",
    years: 8,
    location: "Main Hospital",
    dob: "1990-04-15",
    phone: "+20 112 345 6789",
    about:
      "Board-certified cardiologist with eight years of experience in interventional and preventive cardiology.",
  },
  {
    name: "Dr. Youssef Ali",
    local: "youssef.ali",
    specialty: "Orthopedics",
    department: "Orthopedics",
    title: "Orthopedic Surgeon",
    license: "MD-DEMO-44910",
    years: 12,
    location: "Main Hospital",
    dob: "1984-01-18",
    phone: "+20 111 222 3333",
    about:
      "Orthopedic surgeon focused on sports injuries and joint reconstruction.",
  },
  {
    name: "Dr. Nourhan Ibrahim",
    local: "nourhan.ibrahim",
    specialty: "Pediatrics",
    department: "Pediatrics",
    title: "Pediatrician",
    license: "MD-DEMO-77319",
    years: 9,
    location: "Children's Clinic",
    dob: "1991-03-30",
    phone: "+20 122 456 7890",
    about:
      "Pediatrician providing preventive and developmental care for infants, children and adolescents.",
  },
  {
    name: "Dr. Tarek Nabil",
    local: "tarek.nabil",
    specialty: "Neurology",
    department: "Neurology",
    title: "Consultant Neurologist",
    license: "MD-DEMO-55201",
    years: 11,
    location: "Main Hospital",
    dob: "1986-07-21",
    phone: "+20 128 334 5566",
    about:
      "Neurologist with a focus on headache disorders and neuromuscular assessment.",
  },
  {
    name: "Dr. Salma Fathy",
    local: "salma.fathy",
    specialty: "Gynecology",
    department: "Gynecology",
    title: "Consultant Gynecologist",
    license: "MD-DEMO-61004",
    years: 7,
    location: "West Clinic",
    dob: "1989-11-05",
    phone: "+20 100 445 8899",
    about:
      "Gynecologist supporting routine and specialist women's health consultations.",
  },
  {
    name: "Dr. Mariam Yasser",
    local: "mariam.yasser",
    specialty: "General Medicine",
    department: "General Medicine",
    title: "General Practitioner",
    license: "MD-DEMO-30217",
    years: 5,
    location: "West Clinic",
    dob: "1994-02-14",
    phone: "+20 109 776 2211",
    about:
      "General practitioner handling first-line assessment and chronic care follow-up.",
  },
];

const STAFF = [
  {
    name: "Omar Hassan",
    local: "omar.hassan",
    jobTitle: "Receptionist",
    department: "Administration",
    employmentId: "EMP-DEMO-2001",
    location: "Main Hospital",
    dob: "1996-03-12",
    phone: "+20 111 987 6543",
    shift: "Mon-Fri, 9:00 AM - 5:00 PM",
    about:
      "Front-desk receptionist managing patient intake, check-in and telephone enquiries.",
  },
  {
    name: "Fatma Adel",
    local: "fatma.adel",
    jobTitle: "Nurse",
    department: "Nursing",
    employmentId: "EMP-DEMO-2002",
    location: "West Clinic",
    dob: "1994-01-25",
    phone: "+20 108 543 2198",
    shift: "Mon-Fri, 8:00 AM - 4:00 PM",
    about:
      "Registered nurse supporting outpatient consultations, triage and patient education.",
  },
  {
    name: "Kareem Mostafa",
    local: "kareem.mostafa",
    jobTitle: "Lab Technician",
    department: "Laboratory",
    employmentId: "EMP-DEMO-2003",
    location: "Main Hospital",
    dob: "1993-09-08",
    phone: "+20 109 878 5432",
    shift: "Mon-Fri, 9:00 AM - 5:00 PM",
    about:
      "Medical laboratory technician handling diagnostic testing and sample processing.",
  },
  {
    name: "Alya Samir",
    local: "alya.samir",
    jobTitle: "Administrator",
    department: "Administration",
    employmentId: "EMP-DEMO-2004",
    location: "Main Hospital",
    dob: "1990-04-02",
    phone: "+20 112 654 3210",
    shift: "Mon-Fri, 9:00 AM - 5:00 PM",
    about:
      "Operations administrator overseeing front-desk staffing and patient coordination.",
  },
  {
    name: "Hoda Kamal",
    local: "hoda.kamal",
    jobTitle: "Clinic Coordinator",
    department: "Administration",
    employmentId: "EMP-DEMO-2005",
    location: "Children's Clinic",
    dob: "1992-06-17",
    phone: "+20 106 221 4477",
    shift: "Mon-Fri, 9:00 AM - 5:00 PM",
    about:
      "Clinic coordinator aligning paediatric schedules with available clinicians.",
  },
];

function usage() {
  console.log(`
Medora — opt-in demo workforce seed

  node scripts/seed-demo-workforce.js --confirm [options]

Options
  --confirm        Required. Acknowledge that rows will be written.
  --activate       Also activate each new account with a generated password
                   and print the credentials once.
  --links          Print one-time activation links for new accounts.
  --allow-remote   Permit a non-local database host (refused by default).
  --help           Show this message.

Without --confirm nothing is written. Existing @medora.example accounts are
skipped, so the command is safe to repeat.
`);
}

function parseArgs(argv) {
  const args = {
    confirm: false,
    activate: false,
    links: false,
    allowRemote: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--confirm" || arg === "--yes") args.confirm = true;
    else if (arg === "--activate") args.activate = true;
    else if (arg === "--links") args.links = true;
    else if (arg === "--allow-remote") args.allowRemote = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else {
      console.error(`Unknown option: ${arg}`);
      args.help = true;
    }
  }

  return args;
}

function fail(message) {
  console.error(`\n[refused] ${message}\n`);
  process.exitCode = 1;
}

function generatePassword() {
  // Guarantees upper, lower and digit while staying readable for a demo.
  const random = crypto.randomBytes(9).toString("base64url");
  return `Medora-${random}-A9`;
}

function toProvisionPayload(fixture, role) {
  const base = {
    full_name: fixture.name,
    email: `${fixture.local}@${EMAIL_DOMAIN}`,
    phone: fixture.phone,
    date_of_birth: fixture.dob,
    role,
    location: fixture.location,
    about: fixture.about,
  };

  if (role === "doctor") {
    base.doctor = {
      specialty: fixture.specialty,
      department: fixture.department,
      license_number: fixture.license,
      professional_title: fixture.title,
      years_of_experience: fixture.years,
    };
  } else {
    base.staff = {
      job_title: fixture.jobTitle,
      department: fixture.department,
      employment_id: fixture.employmentId,
      work_shift: fixture.shift,
    };
  }

  return base;
}

async function findAdmin() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r       ON r.id = ur.role_id
     WHERE r.name = 'admin'
     ORDER BY u.created_at
     LIMIT 1`
  );

  return rows[0] || null;
}

async function emailExists(email) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return rowCount > 0;
}

async function seedOne(fixture, role, actor, options) {
  const email = `${fixture.local}@${EMAIL_DOMAIN}`;

  if (await emailExists(email)) {
    return { status: "skipped", email, role, reason: "already exists" };
  }

  try {
    const { user, invitation } = await adminUsersService.provisionUser(
      toProvisionPayload(fixture, role),
      actor,
      { ip: null, userAgent: "seed-demo-workforce" }
    );

    let password = null;

    if (options.activate) {
      password = generatePassword();
      await invitationService.activate({
        token: invitation.token,
        password,
        context: { ip: null, userAgent: "seed-demo-workforce" },
      });
    }

    return {
      status: "created",
      email,
      role,
      id: user.id,
      password,
      activationPath: `/activate?token=${invitation.token}`,
    };
  } catch (err) {
    // A licence or employment-id collision means a previous run created the
    // record under a different email. Report it instead of failing the batch.
    if (err.statusCode === 409) {
      return { status: "skipped", email, role, reason: err.message };
    }

    return {
      status: "failed",
      email,
      role,
      reason: err.message,
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  if (process.env.NODE_ENV === "production") {
    fail("NODE_ENV=production. Demo accounts must never be seeded outside development.");
    return;
  }

  const host = process.env.DB_HOST || "localhost";
  const database = process.env.DB_NAME || "medora_db";
  const port = process.env.DB_PORT || "5432";

  if (!options.confirm) {
    usage();
    fail(
      `Nothing was written. Re-run with --confirm to seed ${database} on ${host}:${port}.`
    );
    return;
  }

  if (!LOCAL_HOSTS.includes(host) && !options.allowRemote) {
    fail(
      `Refusing to seed a non-local database (${host}). Pass --allow-remote only if you are certain.`
    );
    return;
  }

  console.log("\nMedora — demo workforce seed");
  console.log(`Target : ${host}:${port}/${database}`);
  console.log(`Mode   : ${options.activate ? "provision + activate" : "provision only"}`);

  const admin = await findAdmin();

  if (!admin) {
    console.log("");
    fail(
      "No admin account found. Run `npm run bootstrap:admin` first; the seed uses it as the audit actor."
    );
    return;
  }

  console.log(`Actor  : ${admin.email}\n`);

  const actor = { id: admin.id };
  const results = [];

  for (const fixture of DOCTORS) {
    results.push(await seedOne(fixture, "doctor", actor, options));
  }
  for (const fixture of STAFF) {
    results.push(await seedOne(fixture, "staff", actor, options));
  }

  for (const result of results) {
    const label = result.status.padEnd(8);
    const detail = result.reason ? ` (${result.reason})` : "";
    console.log(`  ${label} ${result.role.padEnd(6)} ${result.email}${detail}`);
  }

  const created = results.filter((r) => r.status === "created");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");

  console.log(
    `\nCreated ${created.length} · skipped ${skipped.length} · failed ${failed.length}`
  );

  if (options.links) {
    const linked = created.filter((r) => r.activationPath);
    if (linked.length > 0) {
      console.log("\nOne-time activation links (shown once, local development only)");
      for (const result of linked) {
        console.log(`  ${result.email}\n    ${result.activationPath}`);
      }
    }
  }

  if (options.activate && created.length > 0) {
    console.log("\nCredentials (shown once — local development only)");
    for (const result of created) {
      console.log(`  ${result.email.padEnd(34)} ${result.password}`);
    }
    console.log(
      "\nThese accounts are active. Sign in at /login. Change or remove them before any shared demo."
    );
  } else if (created.length > 0) {
    console.log(
      "\nAccounts are pending activation. Re-run with --activate, or send the activation links with --links."
    );
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(`\n[seed error] ${err.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { DOCTORS, STAFF, toProvisionPayload };
