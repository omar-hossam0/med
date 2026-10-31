const pool = require("../config/db");
const auditService = require("./auditService");
const { httpError } = require("../utils/httpError");
const { Validator, UUID_REGEX } = require("../utils/validators");
const { serializeDoctor, serializeStaff } = require("../utils/serializers");

/**
 * Doctors & Staff directory.
 *
 * One endpoint returns the union the page renders, because the UI shows both
 * kinds in one grid with one filter bar and derives its four stat cards from
 * the array it receives.
 *
 * `duty`, `nextShift` and `availability` are deliberately empty: their source
 * is the scheduling module (doctor_availability, doctor_time_off, appointments),
 * which is not implemented yet. Inventing values here would be a second source
 * of truth.
 */

const DOCTOR_SELECT = `
  SELECT u.id, u.full_name, u.email, u.status,
         dp.professional_title, dp.license_number, dp.bio, dp.phone,
         dp.date_of_birth, dp.years_of_experience, dp.verification_status,
         s.name AS specialty,
         d.name AS department,
         cl.name AS location_name,
         cl.address_line1, cl.city
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r       ON r.id = ur.role_id AND r.name = 'doctor'
  JOIN doctor_profiles dp ON dp.user_id = u.id
  JOIN specialties s  ON s.id = dp.specialty_id
  LEFT JOIN departments d       ON d.specialty_id = s.id
  LEFT JOIN clinic_locations cl ON cl.id = dp.primary_location_id
`;

const STAFF_SELECT = `
  SELECT u.id, u.full_name, u.email, u.status,
         sp.job_title, sp.bio, sp.phone, sp.date_of_birth, sp.work_shift,
         d.name AS department,
         cl.name AS location_name,
         cl.address_line1, cl.city
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r       ON r.id = ur.role_id AND r.name = 'receptionist'
  JOIN staff_profiles sp ON sp.user_id = u.id
  JOIN departments d     ON d.id = sp.department_id
  LEFT JOIN clinic_locations cl ON cl.id = sp.primary_location_id
`;

const STATUS_FILTER_MAP = {
  active: "active",
  pending: "pending_activation",
  suspended: "suspended",
  inactive: "disabled",
};

function normalizeStatus(value) {
  if (!value) return null;
  return STATUS_FILTER_MAP[String(value).toLowerCase()] || null;
}

function normalizeVerification(value) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  return ["pending", "verified", "rejected"].includes(key) ? key : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

async function getStats() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'doctor')::int AS doctors,
       (SELECT count(*) FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'receptionist')::int AS staff,
       (SELECT count(*) FROM doctor_profiles
         WHERE verification_status = 'pending')::int AS pending_verification`
  );

  const row = rows[0];

  return {
    doctors: row.doctors,
    staff: row.staff,
    pendingVerification: row.pending_verification,
    // No scheduling module yet; every member is "off" until it exists.
    onDuty: 0,
    total: row.doctors + row.staff,
  };
}

async function listMembers(filters = {}) {
  const search = normalizeText(filters.search);
  const specialty = normalizeText(filters.specialty);
  const department = normalizeText(filters.department);
  const location = normalizeText(filters.location);
  const verification = normalizeVerification(filters.verification);
  const accountStatus = normalizeStatus(filters.accountStatus);
  const kind = normalizeText(filters.kind);

  const limit = Math.min(
    Math.max(Number(filters.limit) || 2000, 1),
    2000
  );
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const includeDoctors = kind !== "staff";
  const includeStaff = kind !== "doctor" && !verification;

  const params = [search, specialty, department, verification, accountStatus, location];
  // The staff query has no specialty or verification predicate, so it uses its
  // own placeholders. Passing unused parameters leaves PostgreSQL unable to
  // infer their type ("could not determine data type of parameter $2").
  const staffParams = [search, department, accountStatus, location];

  const [doctors, staff, stats] = await Promise.all([
    includeDoctors
      ? pool.query(
          `${DOCTOR_SELECT}
           WHERE ($1::text IS NULL
                  OR u.full_name ILIKE '%' || $1 || '%'
                  OR u.email     ILIKE '%' || $1 || '%'
                  OR s.name      ILIKE '%' || $1 || '%'
                  OR COALESCE(d.name, '') ILIKE '%' || $1 || '%')
             AND ($2::text IS NULL OR s.name = $2)
             AND ($3::text IS NULL OR d.name = $3)
             AND ($4::text IS NULL OR dp.verification_status = $4)
             AND ($5::text IS NULL OR u.status = $5)
             AND ($6::text IS NULL OR cl.name = $6)
           ORDER BY u.full_name`,
          params
        )
      : Promise.resolve({ rows: [] }),
    includeStaff
      ? pool.query(
          `${STAFF_SELECT}
           WHERE ($1::text IS NULL
                  OR u.full_name   ILIKE '%' || $1 || '%'
                  OR u.email       ILIKE '%' || $1 || '%'
                  OR sp.job_title  ILIKE '%' || $1 || '%'
                  OR d.name        ILIKE '%' || $1 || '%')
             AND ($2::text IS NULL OR d.name = $2)
             AND ($3::text IS NULL OR u.status = $3)
             AND ($4::text IS NULL OR cl.name = $4)
           ORDER BY u.full_name`,
          staffParams
        )
      : Promise.resolve({ rows: [] }),
    getStats(),
  ]);

  const merged = [
    ...doctors.rows.map(serializeDoctor),
    ...staff.rows.map(serializeStaff),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const page = merged.slice(offset, offset + limit);

  return {
    members: page,
    stats,
    pagination: {
      total: merged.length,
      limit,
      offset,
      returned: page.length,
      hasMore: offset + page.length < merged.length,
    },
  };
}

async function getMember(id) {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw httpError(404, "not_found", "Member not found.");
  }

  const doctor = await pool.query(`${DOCTOR_SELECT} WHERE u.id = $1`, [id]);
  if (doctor.rows.length > 0) {
    return serializeDoctor(doctor.rows[0]);
  }

  const staff = await pool.query(`${STAFF_SELECT} WHERE u.id = $1`, [id]);
  if (staff.rows.length > 0) {
    return serializeStaff(staff.rows[0]);
  }

  throw httpError(404, "not_found", "Member not found.");
}

/**
 * Record a credential decision. Verification is an administrative act, so the
 * timestamp and the actor are written together with the status; "rejected"
 * clears both rather than leaving stale evidence behind.
 */
async function setVerification(id, payload, actor, context = {}) {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw httpError(404, "not_found", "Doctor not found.");
  }

  const body = payload || {};
  const v = new Validator();
  const status = v.oneOf(body.status, "status", ["pending", "verified", "rejected"], {
    label: "Verification status",
  });
  const note = v.text(body.note, "note", { max: 500, label: "Note" });
  v.done();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT user_id, verification_status, license_number
       FROM doctor_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [id]
    );

    if (current.rows.length === 0) {
      throw httpError(404, "not_found", "Doctor not found.");
    }

    // Compute the evidence in JS rather than reusing $1 in a CASE expression:
    // PostgreSQL cannot deduce one type for a parameter used both as varchar
    // and in a text comparison.
    const verifiedAt = status === "verified" ? new Date() : null;
    const verifiedBy = status === "verified" ? actor.id : null;

    await client.query(
      `UPDATE doctor_profiles
       SET verification_status = $1,
           license_verified_at = $2,
           license_verified_by = $3
       WHERE user_id = $4`,
      [status, verifiedAt, verifiedBy, id]
    );

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType: "doctor.verification_changed",
      eventCategory: "approval",
      entityType: "user",
      entityId: id,
      before: { verification_status: current.rows[0].verification_status },
      after: { verification_status: status },
      metadata: {
        license_number: current.rows[0].license_number,
        note: note || null,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getMember(id);
}

/**
 * Edit the professional / employment fields of a doctor or staff member.
 * Role-specific fields are rejected when they do not match the member's kind,
 * so a doctor cannot silently acquire a job title (or vice versa).
 */
async function updateMember(id, payload, actor, context = {}) {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw httpError(404, "not_found", "Member not found.");
  }

  const body = payload || {};
  const v = new Validator();

  const phone = body.phone !== undefined ? v.phone(body.phone) : null;
  const dateOfBirth = body.date_of_birth !== undefined ? v.date(body.date_of_birth) : null;
  const bio = body.bio !== undefined ? v.text(body.bio, "bio", { max: 2000, label: "About" }) : null;
  const locationId =
    body.primary_location_id !== undefined
      ? v.uuid(body.primary_location_id, "primary_location_id")
      : null;

  const doctorFields = {};
  const staffFields = {};

  if (body.professional_title !== undefined) {
    doctorFields.professional_title = v.text(body.professional_title, "professional_title", {
      max: 120,
      label: "Professional title",
    });
  }
  if (body.license_number !== undefined) {
    doctorFields.license_number = v.text(body.license_number, "license_number", {
      required: true,
      max: 64,
      label: "License number",
    });
  }
  if (body.years_of_experience !== undefined) {
    doctorFields.years_of_experience = v.integer(
      body.years_of_experience,
      "years_of_experience",
      { min: 0, max: 70, label: "Years of experience" }
    );
  }
  if (body.specialty_id !== undefined) {
    doctorFields.specialty_id = v.uuid(body.specialty_id, "specialty_id", { required: true });
  }

  if (body.job_title !== undefined) {
    staffFields.job_title = v.text(body.job_title, "job_title", {
      required: true,
      max: 120,
      label: "Job title",
    });
  }
  if (body.employment_id !== undefined) {
    staffFields.employment_id = v.text(body.employment_id, "employment_id", {
      max: 64,
      label: "Employment ID",
    });
  }
  if (body.work_shift !== undefined) {
    staffFields.work_shift = v.text(body.work_shift, "work_shift", {
      max: 120,
      label: "Work shift",
    });
  }
  if (body.department_id !== undefined) {
    staffFields.department_id = v.uuid(body.department_id, "department_id", { required: true });
  }

  v.done();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const kindResult = await client.query(
      `SELECT CASE
                WHEN EXISTS (SELECT 1 FROM doctor_profiles WHERE user_id = $1) THEN 'doctor'
                WHEN EXISTS (SELECT 1 FROM staff_profiles  WHERE user_id = $1) THEN 'staff'
                ELSE NULL
              END AS kind`,
      [id]
    );
    const kind = kindResult.rows[0].kind;

    if (!kind) {
      throw httpError(404, "not_found", "Member not found.");
    }
    if (kind === "staff" && Object.keys(doctorFields).length > 0) {
      throw httpError(400, "validation_error", "Doctor fields cannot be applied to a staff member.");
    }
    if (kind === "doctor" && Object.keys(staffFields).length > 0) {
      throw httpError(400, "validation_error", "Staff fields cannot be applied to a doctor.");
    }

    if (doctorFields.specialty_id) {
      const specialty = await client.query(
        "SELECT id FROM specialties WHERE id = $1 AND is_active",
        [doctorFields.specialty_id]
      );
      if (specialty.rows.length === 0) {
        throw httpError(400, "unknown_specialty", "The selected specialty does not exist.");
      }
    }

    if (staffFields.department_id) {
      const department = await client.query(
        "SELECT id FROM departments WHERE id = $1 AND is_active",
        [staffFields.department_id]
      );
      if (department.rows.length === 0) {
        throw httpError(400, "unknown_department", "The selected department does not exist.");
      }
    }

    const table = kind === "doctor" ? "doctor_profiles" : "staff_profiles";
    const roleFields = kind === "doctor" ? doctorFields : staffFields;

    const beforeResult = await client.query(
      `SELECT * FROM ${table} WHERE user_id = $1`,
      [id]
    );
    const beforeRow = beforeResult.rows[0];

    const sets = [];
    const values = [];
    let index = 1;

    for (const [column, value] of Object.entries(roleFields)) {
      if (value === null) continue;
      sets.push(`${column} = $${index++}`);
      values.push(value);
    }
    if (phone !== null) {
      sets.push(`phone = $${index++}`);
      values.push(phone);
    }
    if (dateOfBirth !== null) {
      sets.push(`date_of_birth = $${index++}`);
      values.push(dateOfBirth);
    }
    if (bio !== null) {
      sets.push(`bio = $${index++}`);
      values.push(bio);
    }
    if (locationId !== null) {
      sets.push(`primary_location_id = $${index++}`);
      values.push(locationId);
    }

    if (sets.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE ${table} SET ${sets.join(", ")} WHERE user_id = $${index}`,
        values
      );
    }

    const after = { ...roleFields };
    if (phone !== null) after.phone = phone;
    if (dateOfBirth !== null) after.date_of_birth = dateOfBirth;
    if (bio !== null) after.bio = bio;
    if (locationId !== null) after.primary_location_id = locationId;

    const before = Object.fromEntries(
      Object.keys(after).map((key) => [key, beforeRow[key] ?? null])
    );

    await auditService.record(client, {
      actorUserId: actor.id,
      eventType: "member.profile_updated",
      eventCategory: "configuration",
      entityType: "user",
      entityId: id,
      before,
      after,
      metadata: { kind },
      ip: context.ip,
      userAgent: context.userAgent,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      const constraint = err.constraint || "";
      if (constraint.includes("license")) {
        throw httpError(409, "license_taken", "This licence number is already registered.");
      }
      if (constraint.includes("employment_id")) {
        throw httpError(409, "employment_id_taken", "This employment ID is already in use.");
      }
      throw httpError(409, "conflict", "This record conflicts with an existing one.");
    }

    throw err;
  } finally {
    client.release();
  }

  return getMember(id);
}

module.exports = { listMembers, getMember, setVerification, updateMember };
