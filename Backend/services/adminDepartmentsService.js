/**
 * Admin departments (Phase 10).
 *
 * `departments` has only id/name/slug/kind/specialty_id/is_active/timestamps.
 * Extended UI fields (description, icon, displayOrder, services, head) have no
 * columns, so they are honest empties / derived values. Doctor assignment is
 * represented by doctor_profiles.specialty_id → departments.specialty_id; there
 * is no join table, and unassignment cannot be represented without a schema
 * decision (D-12).
 */
const pool = require("../config/db");
const auditService = require("./auditService");
const { Validator } = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const { assertUuid, iso, withTransaction } = require("../utils/dbHelpers");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function departmentCard(executor, row) {
  const [doctors, stats, activity] = await Promise.all([
    row.specialty_id
      ? executor.query(
          `SELECT user_id FROM doctor_profiles WHERE specialty_id = $1 ORDER BY user_id`,
          [row.specialty_id]
        )
      : Promise.resolve({ rows: [] }),
    row.specialty_id
      ? executor.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status = 'completed')::int AS completed,
                  count(*) FILTER (WHERE status IN ('cancelled','no_show'))::int AS cancelled
             FROM appointments WHERE specialty_id = $1`,
          [row.specialty_id]
        )
      : Promise.resolve({ rows: [{ total: 0, completed: 0, cancelled: 0 }] }),
    executor.query(
      `SELECT id, event_type, occurred_at, actor_user_id
         FROM audit_logs
        WHERE entity_type = 'department' AND entity_id = $1
        ORDER BY occurred_at DESC LIMIT 5`,
      [row.id]
    ),
  ]);

  const location = await executor.query(
    `SELECT name, address_line1, city FROM clinic_locations WHERE is_active ORDER BY name LIMIT 1`
  );
  const loc = location.rows[0];

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    // No description/icon/order/head columns exist (D-12).
    description: "",
    icon: "activity",
    status: row.is_active ? "active" : "inactive",
    displayOrder: 0,
    assignedDoctorIds: doctors.rows.map((doctor) => doctor.user_id),
    services: [],
    headOfDepartment: undefined,
    location: loc?.name || "",
    locationBadge: undefined,
    locationAddress: loc ? [loc.address_line1, loc.city].filter(Boolean).join(", ") : "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    stats: {
      assignedDoctors: doctors.rows.length,
      totalAppointments: stats.rows[0].total,
      completedAppointments: stats.rows[0].completed,
      cancelledAppointments: stats.rows[0].cancelled,
    },
    recentActivity: activity.rows.map((event) => ({
      id: event.id,
      action: event.event_type,
      timestamp: iso(event.occurred_at),
      actor: event.actor_user_id || "system",
      type: "updated",
    })),
  };
}

async function listDepartments() {
  const { rows } = await pool.query(`SELECT * FROM departments ORDER BY name`);
  const departments = [];
  for (const row of rows) departments.push(await departmentCard(pool, row));
  return { departments };
}

async function createDepartment(ctx) {
  const v = new Validator();
  const name = v.text(ctx.body.name, "name", { required: true, min: 2, max: 100, label: "Department name" });
  const slugInput = v.text(ctx.body.slug, "slug", { max: 100, label: "Slug" });
  const description = v.text(ctx.body.description, "description", { max: 500, label: "Description" });
  v.done();
  void description; // no column exists; accepted but intentionally not persisted
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!slug) throw httpError(400, "validation_error", "A valid department slug is required.");

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO departments (name, slug, kind, specialty_id, is_active)
       VALUES ($1, $2, 'support', NULL, TRUE) RETURNING *`,
      [name, slug]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "department.created",
      eventCategory: "configuration",
      entityType: "department",
      entityId: rows[0].id,
      after: { name, slug, kind: "support" },
      metadata: {},
      context: ctx.context,
    });
    return { department: await departmentCard(client, rows[0]) };
  });
}

async function updateDepartment(ctx) {
  const id = assertUuid(ctx.params.id, "Department");
  const v = new Validator();
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(ctx.body, "name")) {
    patch.name = v.text(ctx.body.name, "name", { required: true, min: 2, max: 100, label: "Department name" });
  }
  if (Object.prototype.hasOwnProperty.call(ctx.body, "slug")) {
    patch.slug = slugify(v.text(ctx.body.slug, "slug", { required: true, max: 100, label: "Slug" }));
  }
  if (Object.prototype.hasOwnProperty.call(ctx.body, "status")) {
    const status = v.oneOf(ctx.body.status, "status", ["active", "inactive"], { label: "Status" });
    patch.is_active = status === "active";
  }
  v.done();
  if (Object.keys(patch).length === 0) {
    throw httpError(400, "validation_error", "No editable department fields were supplied.");
  }

  return withTransaction(async (client) => {
    const columns = Object.keys(patch);
    const values = columns.map((column) => patch[column]);
    values.push(id);
    const { rows } = await client.query(
      `UPDATE departments SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}
        WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) throw httpError(404, "not_found", "Department not found.");
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "department.updated",
      eventCategory: "configuration",
      entityType: "department",
      entityId: id,
      after: patch,
      metadata: {},
      context: ctx.context,
    });
    return { department: await departmentCard(client, rows[0]) };
  });
}

async function setDepartmentDoctors(ctx) {
  const id = assertUuid(ctx.params.id, "Department");
  const v = new Validator();
  const doctorIds = v.array(ctx.body.doctorIds, "doctorIds", { required: true, max: 200 });
  const removalIds = v.array(ctx.body.removeDoctorIds, "removeDoctorIds", { max: 200 });
  v.done();

  return withTransaction(async (client) => {
    const current = await client.query(`SELECT * FROM departments WHERE id = $1 FOR UPDATE`, [id]);
    if (current.rowCount === 0) throw httpError(404, "not_found", "Department not found.");
    const department = current.rows[0];
    if (!department.specialty_id) {
      throw httpError(409, "dependency_conflict", "Support departments are not linked to a specialty, so doctors cannot be assigned without a schema decision (D-12).");
    }
    if (removalIds && removalIds.length > 0) {
      throw httpError(409, "dependency_conflict", "Unassigning a doctor requires a department-doctor mapping table; no approved migration exists (D-12).");
    }

    const idValidator = new Validator();
    const validatedIds = doctorIds.map((doctorId) =>
      idValidator.uuid(doctorId, "doctorIds", { required: true })
    );
    idValidator.done();

    let assigned = 0;
    for (const validated of validatedIds) {
      const result = await client.query(
        `UPDATE doctor_profiles SET specialty_id = $1
          WHERE user_id = $2 AND EXISTS (
            SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $2 AND r.name = 'doctor'
          )`,
        [department.specialty_id, validated]
      );
      assigned += result.rowCount;
    }
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "department.doctors_assigned",
      eventCategory: "configuration",
      entityType: "department",
      entityId: id,
      after: { assigned },
      metadata: { requested: doctorIds.length },
      context: ctx.context,
    });
    return { department: await departmentCard(client, department), assigned };
  });
}

async function setDepartmentServices(ctx) {
  const id = assertUuid(ctx.params.id, "Department");
  const { rows } = await pool.query(`SELECT id FROM departments WHERE id = $1`, [id]);
  if (rows.length === 0) throw httpError(404, "not_found", "Department not found.");
  // No services column/table exists. Persisting an arbitrary list would create
  // a second source of truth; require an approved 014 migration first.
  throw httpError(409, "dependency_conflict", "Department services have no backing column or table. An approved migration (D-12) is required before this endpoint can persist data.");
}

module.exports = {
  slugify,
  listDepartments,
  createDepartment,
  updateDepartment,
  setDepartmentDoctors,
  setDepartmentServices,
};
