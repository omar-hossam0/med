const pool = require("../config/db");
const auditService = require("./auditService");
const invitationService = require("./invitationService");
const { httpError } = require("../utils/httpError");
const { Validator, UUID_REGEX } = require("../utils/validators");
const {
  API_TO_DB_ROLE,
  API_TO_DB_STATUS,
  serializeUser,
} = require("../utils/serializers");

/**
 * Admin user directory and account lifecycle.
 *
 * Accounts whose only role is `admin` are excluded from every query here: the
 * UI manages patients, doctors and staff, and exposing the single admin
 * account would create a self-lockout surface with no recovery path.
 */

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 1000;

/**
 * Resolves one primary role per user, matching the UI's single-role model.
 * Precedence: doctor > receptionist > patient > other.
 */
const USER_BASE_CTE = `
  WITH base AS (
    SELECT u.id,
           u.full_name,
           u.email,
           u.status,
           u.created_at,
           COALESCE(pp.phone, dp.phone, sp.phone) AS phone,
           CASE
             WHEN bool_or(r.name = 'doctor')       THEN 'doctor'
             WHEN bool_or(r.name = 'receptionist') THEN 'staff'
             WHEN bool_or(r.name = 'patient')      THEN 'patient'
             ELSE 'other'
           END AS primary_role,
           array_agg(r.name ORDER BY r.name) AS roles
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r       ON r.id = ur.role_id
    LEFT JOIN patient_profiles pp ON pp.user_id = u.id
    LEFT JOIN doctor_profiles  dp ON dp.user_id = u.id
    LEFT JOIN staff_profiles   sp ON sp.user_id = u.id
    GROUP BY u.id, pp.phone, dp.phone, sp.phone
  )
`;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function clampOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

/** A malformed id is a missing record, not a server error. */
function assertUuid(id, message = "Account not found.") {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw httpError(404, "not_found", message);
  }
}

async function listUsers({ search, role, status, limit, offset }) {
  const apiRole = role && role !== "all" ? String(role) : null;
  if (apiRole && !["patient", "doctor", "staff"].includes(apiRole)) {
    throw httpError(400, "validation_error", "Unknown role filter.", [
      { field: "role", message: "Role must be patient, doctor or staff." },
    ]);
  }

  const dbStatus = status && status !== "all" ? API_TO_DB_STATUS[String(status)] : null;
  if (status && status !== "all" && !dbStatus) {
    throw httpError(400, "validation_error", "Unknown status filter.", [
      {
        field: "status",
        message: "Status must be active, pending, suspended or inactive.",
      },
    ]);
  }

  const term = search && String(search).trim() ? String(search).trim() : null;
  const take = clampLimit(limit);
  const skip = clampOffset(offset);

  const filterSql = `
    WHERE primary_role <> 'other'
      AND ($1::text IS NULL OR primary_role = $1)
      AND ($2::text IS NULL OR status = $2)
      AND ($3::text IS NULL
           OR full_name ILIKE '%' || $3 || '%'
           OR email     ILIKE '%' || $3 || '%')
  `;
  const filterParams = [apiRole, dbStatus, term];

  const [rows, total, stats] = await Promise.all([
    pool.query(
      `${USER_BASE_CTE}
       SELECT * FROM base
       ${filterSql}
       ORDER BY created_at DESC, full_name ASC
       LIMIT $4 OFFSET $5`,
      [...filterParams, take, skip]
    ),
    pool.query(
      `${USER_BASE_CTE}
       SELECT count(*)::int AS total FROM base ${filterSql}`,
      filterParams
    ),
    pool.query(
      `${USER_BASE_CTE}
       SELECT count(*) FILTER (WHERE primary_role = 'patient')::int AS patients,
              count(*) FILTER (WHERE primary_role = 'doctor')::int  AS doctors,
              count(*) FILTER (WHERE primary_role = 'staff')::int   AS staff
       FROM base
       WHERE primary_role <> 'other'`
    ),
  ]);

  const counts = stats.rows[0];
  const totalFiltered = total.rows[0].total;

  return {
    users: rows.rows.map(serializeUser),
    stats: {
      total: counts.patients + counts.doctors + counts.staff,
      patients: counts.patients,
      doctors: counts.doctors,
      staff: counts.staff,
    },
    pagination: {
      total: totalFiltered,
      limit: take,
      offset: skip,
      returned: rows.rowCount,
      hasMore: skip + rows.rowCount < totalFiltered,
    },
  };
}

/** Full account record used by the mutation paths. */
async function loadAccount(client, id) {
  const { rows } = await client.query(
    `SELECT u.id, u.full_name, u.email, u.status, u.password_hash, u.created_at,
            COALESCE(pp.phone, dp.phone, sp.phone) AS phone,
            CASE
              WHEN bool_or(r.name = 'doctor')       THEN 'doctor'
              WHEN bool_or(r.name = 'receptionist') THEN 'staff'
              WHEN bool_or(r.name = 'patient')      THEN 'patient'
              ELSE 'other'
            END AS primary_role,
            array_agg(r.name ORDER BY r.name) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r       ON r.id = ur.role_id
     LEFT JOIN patient_profiles pp ON pp.user_id = u.id
     LEFT JOIN doctor_profiles  dp ON dp.user_id = u.id
     LEFT JOIN staff_profiles   sp ON sp.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id, pp.phone, dp.phone, sp.phone`,
    [id]
  );

  return rows[0] || null;
}

async function getUser(id) {
  assertUuid(id);

  const { rows } = await pool.query(
    `${USER_BASE_CTE}
     SELECT * FROM base WHERE id = $1 AND primary_role <> 'other'`,
    [id]
  );

  if (rows.length === 0) {
    throw httpError(404, "not_found", "Account not found.");
  }

  return serializeUser(rows[0]);
}

function mapUniqueViolation(err) {
  if (err.code !== "23505") return err;

  const constraint = err.constraint || "";

  if (constraint.includes("email")) {
    return httpError(409, "email_taken", "An account with this email address already exists.");
  }
  if (constraint.includes("license")) {
    return httpError(409, "license_taken", "This licence number is already registered.");
  }
  if (constraint.includes("employment_id")) {
    return httpError(409, "employment_id_taken", "This employment ID is already in use.");
  }

  return httpError(409, "conflict", "This record conflicts with an existing one.");
}

async function resolveSpecialty(client, { id, name }) {
  const { rows } = id
    ? await client.query(
        `SELECT id, name FROM specialties WHERE id = $1 AND is_active`,
        [id]
      )
    : await client.query(
        `SELECT id, name FROM specialties WHERE LOWER(name) = LOWER($1) AND is_active`,
        [name]
      );

  if (rows.length === 0) {
    throw httpError(400, "unknown_specialty", "The selected specialty does not exist.");
  }

  return rows[0];
}

async function resolveDepartment(client, { id, name }) {  const { rows } = id
    ? await client.query(
        `SELECT id, name, specialty_id FROM departments WHERE id = $1 AND is_active`,
        [id]
      )
    : await client.query(
        `SELECT id, name, specialty_id FROM departments WHERE LOWER(name) = LOWER($1) AND is_active`,
        [name]
      );

  if (rows.length === 0) {
    throw httpError(400, "unknown_department", "The selected department does not exist.");
  }

  return rows[0];
}

async function resolveLocation(client, { id, name }) {
  if (!id && !name) return null;

  const { rows } = id
    ? await client.query(
        `SELECT id, name FROM clinic_locations WHERE id = $1 AND is_active`,
        [id]
      )
    : await client.query(
        `SELECT id, name FROM clinic_locations WHERE LOWER(name) = LOWER($1) AND is_active`,
        [name]
      );

  if (rows.length === 0) {
    throw httpError(400, "unknown_location", "The selected work location does not exist.");
  }

  return rows[0];
}

/**
 * Provision a doctor or staff account.
 *
 * One transaction: user, role, profile, invitation, notification and audit row
 * either all exist or none do. The admin never chooses or sees a password.
 */
async function provisionUser(payload, actor, context = {}) {
  const body = payload || {};
  const v = new Validator();

  const fullName = v.text(body.full_name, "full_name", {
    required: true,
    min: 2,
    max: 150,
    label: "Full name",
  });
  const email = v.email(body.email);
  const phone = v.phone(body.phone);
  const dateOfBirth = v.date(body.date_of_birth);
  const role = v.oneOf(body.role, "role", ["doctor", "staff"], { label: "Role" });
  const locationId = v.uuid(body.location_id, "location_id");
  const locationName = v.text(body.location, "location", {
    max: 150,
    label: "Work location",
  });
  const about = v.text(body.about, "about", { max: 2000, label: "About" });

  let doctor = null;
  let staff = null;

  if (role === "doctor") {
    const input = body.doctor || {};
    const specialtyId = v.uuid(input.specialty_id, "doctor.specialty_id");
    const specialtyName = v.text(input.specialty, "doctor.specialty", {
      max: 100,
      label: "Specialty",
    });

    if (!specialtyId && !specialtyName) {
      v.fail("doctor.specialty_id", "Select a specialty.");
    }

    const departmentId = v.uuid(input.department_id, "doctor.department_id");
    const departmentName = v.text(input.department, "doctor.department", {
      max: 100,
      label: "Department",
    });

    doctor = {
      specialtyId,
      specialtyName,
      departmentId,
      departmentName,
      licenseNumber: v.text(input.license_number, "doctor.license_number", {
        required: true,
        max: 64,
        label: "License number",
      }),
      professionalTitle: v.text(input.professional_title, "doctor.professional_title", {
        max: 120,
        label: "Professional title",
      }),
      yearsOfExperience: v.integer(input.years_of_experience, "doctor.years_of_experience", {
        min: 0,
        max: 70,
        label: "Years of experience",
      }),
    };
  }

  if (role === "staff") {
    const input = body.staff || {};
    const departmentId = v.uuid(input.department_id, "staff.department_id");
    const departmentName = v.text(input.department, "staff.department", {
      max: 100,
      label: "Department",
    });

    if (!departmentId && !departmentName) {
      v.fail("staff.department_id", "Select a department.");
    }

    staff = {
      departmentId,
      departmentName,
      jobTitle: v.text(input.job_title, "staff.job_title", {
        required: true,
        max: 120,
        label: "Job title",
      }),
      employmentId: v.text(input.employment_id, "staff.employment_id", {
        max: 64,
        label: "Employment ID",
      }),
      workShift: v.text(input.work_shift, "staff.work_shift", {
        max: 120,
        label: "Work shift",
      }),
    };
  }

  v.done();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const duplicate = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (duplicate.rows.length > 0) {
      throw httpError(409, "email_taken", "An account with this email address already exists.");
    }

    const dbRole = API_TO_DB_ROLE[role];
    const roleRow = await client.query("SELECT id FROM roles WHERE name = $1", [dbRole]);
    if (roleRow.rows.length === 0) {
      throw httpError(500, "role_missing", "The role is not configured. Run the database migrations.");
    }

    let specialty = null;
    let department = null;

    if (role === "doctor") {
      specialty = await resolveSpecialty(client, {
        id: doctor.specialtyId,
        name: doctor.specialtyName,
      });

      if (doctor.departmentId || doctor.departmentName) {
        department = await resolveDepartment(client, {
          id: doctor.departmentId,
          name: doctor.departmentName,
        });

        if (department.specialty_id !== specialty.id) {
          throw httpError(
            400,
            "department_specialty_mismatch",
            `The department "${department.name}" does not belong to the selected specialty.`
          );
        }
      } else {
        const derived = await client.query(
          "SELECT id, name FROM departments WHERE specialty_id = $1",
          [specialty.id]
        );
        department = derived.rows[0] || null;
      }
    }

    if (role === "staff") {
      department = await resolveDepartment(client, {
        id: staff.departmentId,
        name: staff.departmentName,
      });
    }

    // Accepts either a location id or the display name the form sends.
    const location = await resolveLocation(client, {
      id: locationId,
      name: locationName,
    });
    const primaryLocationId = location ? location.id : null;

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password_hash, status, created_by)
       VALUES ($1, $2, NULL, 'pending_activation', $3)
       RETURNING id, full_name, email, status, created_at`,
      [fullName, email, actor.id]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [user.id, roleRow.rows[0].id]
    );

    if (role === "doctor") {
      await client.query(
        `INSERT INTO doctor_profiles
           (user_id, specialty_id, license_number, phone, bio, professional_title,
            date_of_birth, years_of_experience, primary_location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.id,
          specialty.id,
          doctor.licenseNumber,
          phone,
          about,
          doctor.professionalTitle,
          dateOfBirth,
          doctor.yearsOfExperience,
          primaryLocationId,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO staff_profiles
           (user_id, department_id, job_title, employment_id, phone, date_of_birth,
            bio, work_shift, primary_location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.id,
          department.id,
          staff.jobTitle,
          staff.employmentId,
          phone,
          dateOfBirth,
          about,
          staff.workShift,
          primaryLocationId,
        ]
      );
    }

    const invitation = await invitationService.createInvitation(client, {
      userId: user.id,
      purpose: "invite",
      createdBy: actor.id,
    });

    // Delivery record only. The token itself is never written here.
    await client.query(
      `INSERT INTO notifications
         (recipient_user_id, category, channel, title, body,
          related_entity_type, related_entity_id, status)
       VALUES ($1, 'account', 'email', $2, $3, 'user', $1, 'pending')`,
      [
        user.id,
        "Activate your Medora account",
        "An administrator created your account. Use the activation link provided by the clinic to set your password.",
      ]
    );

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType: "user.provisioned",
      eventCategory: "provisioning",
      entityType: "user",
      entityId: user.id,
      after: {
        role: dbRole,
        email: user.email,
        status: "pending_activation",
      },
      metadata: {
        role: dbRole,
        specialty_id: specialty ? specialty.id : null,
        department_id: department ? department.id : null,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");

    return {
      user: serializeUser({
        ...user,
        phone,
        primary_role: dbRole,
        roles: [dbRole],
      }),
      invitation,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw mapUniqueViolation(err);
  } finally {
    client.release();
  }
}

/**
 * Patch the account fields the admin is allowed to edit.
 * Role changes are deliberately not supported: moving a doctor to staff would
 * require migrating the professional profile.
 */
async function updateUser(id, payload, actor, context = {}) {
  assertUuid(id);

  const body = payload || {};
  const v = new Validator();

  const fullName = body.full_name !== undefined
    ? v.text(body.full_name, "full_name", { required: true, min: 2, max: 150, label: "Full name" })
    : null;
  const email = body.email !== undefined ? v.email(body.email) : null;
  const phone = body.phone !== undefined ? v.phone(body.phone) : null;
  const dateOfBirth = body.date_of_birth !== undefined ? v.date(body.date_of_birth) : null;

  v.done();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const account = await loadAccount(client, id);
    if (!account) {
      throw httpError(404, "not_found", "Account not found.");
    }
    if (account.roles.includes("admin")) {
      throw httpError(403, "admin_protected", "The administrator account cannot be modified here.");
    }
    if (account.primary_role === "other") {
      throw httpError(404, "not_found", "Account not found.");
    }

    const sets = [];
    const values = [];
    let index = 1;

    if (fullName !== null) {
      sets.push(`full_name = $${index++}`);
      values.push(fullName);
    }
    if (email !== null) {
      sets.push(`email = $${index++}`);
      values.push(email);
    }

    if (sets.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${index}`,
        values
      );
    }

    if (phone !== null || dateOfBirth !== null) {
      const profileTable =
        account.primary_role === "doctor"
          ? "doctor_profiles"
          : account.primary_role === "staff"
            ? "staff_profiles"
            : "patient_profiles";

      const profileSets = [];
      const profileValues = [];
      let profileIndex = 1;

      if (phone !== null) {
        profileSets.push(`phone = $${profileIndex++}`);
        profileValues.push(phone);
      }
      if (dateOfBirth !== null) {
        profileSets.push(`date_of_birth = $${profileIndex++}`);
        profileValues.push(dateOfBirth);
      }

      profileValues.push(id);
      await client.query(
        `UPDATE ${profileTable} SET ${profileSets.join(", ")} WHERE user_id = $${profileIndex}`,
        profileValues
      );
    }

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType: "user.updated",
      eventCategory: "configuration",
      entityType: "user",
      entityId: id,
      before: {
        full_name: account.full_name,
        email: account.email,
        phone: account.phone,
      },
      after: {
        full_name: fullName ?? account.full_name,
        email: email ?? account.email,
        phone: phone ?? account.phone,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");

    return getUser(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw mapUniqueViolation(err);
  } finally {
    client.release();
  }
}

const ALLOWED_TRANSITIONS = {
  active: ["suspended", "disabled"],
  suspended: ["active", "disabled"],
  disabled: ["active"],
  pending_activation: ["disabled"],
};

/**
 * Change account status. Requires a written reason, which lands in the audit
 * row, and refuses any target that is the caller or holds the admin role.
 */
async function updateStatus(id, payload, actor, context = {}) {
  assertUuid(id);

  const body = payload || {};
  const v = new Validator();

  const nextApiStatus = v.oneOf(
    body.status,
    "status",
    ["active", "pending", "suspended", "inactive"],
    { label: "Status" }
  );
  const reason = v.text(body.reason, "reason", {
    required: true,
    min: 3,
    max: 500,
    label: "Reason",
  });

  v.done();

  const nextStatus = API_TO_DB_STATUS[nextApiStatus];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const account = await loadAccount(client, id);
    if (!account) {
      throw httpError(404, "not_found", "Account not found.");
    }
    if (account.id === actor.id) {
      throw httpError(403, "self_lockout", "You cannot change your own account status.");
    }
    if (account.roles.includes("admin")) {
      throw httpError(403, "admin_protected", "The administrator account cannot be modified here.");
    }
    if (account.primary_role === "other") {
      throw httpError(404, "not_found", "Account not found.");
    }
    if (account.status === nextStatus) {
      throw httpError(409, "status_unchanged", "The account already has this status.");
    }

    const allowed = ALLOWED_TRANSITIONS[account.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw httpError(
        409,
        "invalid_status_transition",
        `An account cannot move from ${account.status} to ${nextStatus}.`
      );
    }

    if (nextStatus === "active" && !account.password_hash) {
      throw httpError(
        409,
        "pending_activation_incomplete",
        "This account has not set a password yet. Send an activation invitation first."
      );
    }

    await client.query("UPDATE users SET status = $1 WHERE id = $2", [nextStatus, id]);

    if (nextStatus === "disabled") {
      await invitationService.revokeLiveInvitations(client, id);
    }

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType: "user.status_changed",
      eventCategory: "provisioning",
      entityType: "user",
      entityId: id,
      before: { status: account.status },
      after: { status: nextStatus },
      metadata: { reason, role: account.primary_role },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await auditService.recordSecurityEvent(client, {
      eventType: "privilege_changed",
      severity: nextStatus === "active" ? "info" : "warning",
      userId: id,
      outcome: "success",
      metadata: {
        from: account.status,
        to: nextStatus,
        changed_by: actor.id,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");

    return getUser(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Issue a new invitation or password-reset token for an existing account.
 */
async function issueInvitation(id, payload, actor, context = {}) {
  assertUuid(id);

  const body = payload || {};
  const v = new Validator();
  const purpose = v.oneOf(body.purpose, "purpose", ["invite", "password_reset"], {
    label: "Purpose",
    required: false,
  });
  v.done();

  const resolvedPurpose = purpose || "invite";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const account = await loadAccount(client, id);
    if (!account) {
      throw httpError(404, "not_found", "Account not found.");
    }
    if (account.roles.includes("admin")) {
      throw httpError(403, "admin_protected", "The administrator account cannot be modified here.");
    }
    if (account.primary_role === "other") {
      throw httpError(404, "not_found", "Account not found.");
    }

    if (resolvedPurpose === "invite" && account.status !== "pending_activation") {
      throw httpError(
        409,
        "invitation_not_applicable",
        "Only an account that is pending activation can receive an invitation."
      );
    }

    const invitation = await invitationService.createInvitation(client, {
      userId: id,
      purpose: resolvedPurpose,
      createdBy: actor.id,
    });

    await client.query(
      `INSERT INTO notifications
         (recipient_user_id, category, channel, title, body,
          related_entity_type, related_entity_id, status)
       VALUES ($1, 'account', 'email', $2, $3, 'user', $1, 'pending')`,
      [
        id,
        resolvedPurpose === "invite"
          ? "Your Medora activation link"
          : "Your Medora password reset link",
        resolvedPurpose === "invite"
          ? "A new activation link was issued for your account. Ask the clinic administrator if you did not receive it."
          : "A password reset was requested for your account. Ask the clinic administrator if this was not you.",
      ]
    );

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType:
        resolvedPurpose === "invite"
          ? "user.invitation_resent"
          : "user.password_reset_issued",
      eventCategory: "provisioning",
      entityType: "user",
      entityId: id,
      metadata: { purpose: resolvedPurpose },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");

    return invitation;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  getUser,
  provisionUser,
  updateUser,
  updateStatus,
  issueInvitation,
};
