/**
 * Shared, database-agnostic helpers for the endpoint services.
 *
 * Keeps transaction ownership, identifier validation and PostgreSQL error →
 * stable API error mapping in one place so every clinical mutation follows the
 * same rules. No SQL statement in this module contains user input: every value
 * is passed as a parameter by the caller.
 */

const crypto = require("crypto");
const pool = require("../config/db");
const { httpError } = require("./httpError");
const { UUID_REGEX } = require("./validators");

function assertUuid(value, label = "id") {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    // A 404 (not a 400) deliberately does not distinguish "does not exist"
    // from "not yours" for clinical resources.
    throw httpError(404, "not_found", `${label} not found.`);
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/** ISO-8601 string, or null. Accepts pg DATE (string) and TIMESTAMPTZ (Date). */
function iso(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const text = String(value);
  const parsed = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** YYYY-MM-DD, or null. */
function dateOnly(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function timeLabel(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(11, 16);
}

function pagination(query = {}, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : defaultLimit, 1),
    maxLimit
  );
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

function page(rows, { limit, offset }) {
  return {
    rows: rows.slice(offset, offset + limit),
    pagination: {
      total: rows.length,
      limit,
      offset,
      returned: Math.min(limit, Math.max(rows.length - offset, 0)),
      hasMore: offset + limit < rows.length,
    },
  };
}

function optionalText(value, max = 200) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === "") return null;
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Translate PostgreSQL / trigger failures into the stable codes listed in
 * Appendix C. Raw driver messages never reach the client (errorHandler hides
 * 500s), but deliberate constraint violations become actionable 4xx responses.
 */
function mapDbError(err) {
  if (!err || err.statusCode) return err;

  const message = String(err.message || "");
  switch (err.code) {
    case "23505": {
      const constraint = String(err.constraint || "");
      if (constraint.includes("appointment_proposals_live_slot")) {
        return httpError(409, "slot_taken", "That slot already has a live proposal.");
      }
      if (constraint.includes("agent_executions_idempotency")) {
        return httpError(409, "agent_execution_conflict", "This agent execution was already registered.");
      }
      if (constraint.includes("consultation_consents_scope")) {
        return httpError(409, "consent_exists", "Consent for this scope already exists; revoke it instead.");
      }
      if (constraint.includes("medical_reports_consultation_type")) {
        return httpError(409, "dependency_conflict", "A report of this type already exists for the consultation.");
      }
      if (constraint.includes("reference_document_versions")) {
        return httpError(409, "dependency_conflict", "That storage key or version label is already registered.");
      }
      return httpError(409, "slot_taken", "This record conflicts with an existing one.");
    }
    case "23503":
      return httpError(409, "dependency_conflict", "A referenced record does not exist or is still in use.");
    case "23502":
      return httpError(400, "validation_error", "A required field is missing.");
    case "23514": {
      if (/transcript version .*has not been reviewed|transcript version .*was rejected/i.test(message)) {
        return httpError(409, "transcript_not_approved", "Only a doctor-approved transcript version may be consumed.");
      }
      if (/report version .*has not been reviewed|report version .*was rejected/i.test(message)) {
        return httpError(409, "report_not_approved", "Only a doctor-approved report version may be consumed.");
      }
      if (/may be published|is not doctor-approved|published_version_id/i.test(message)) {
        return httpError(409, "publication_not_allowed", "This report cannot be published.");
      }
      if (/requires an approved record_update_proposals|proposal .* is /i.test(message)) {
        return httpError(409, "dependency_conflict", "This clinical fact requires an approved proposal.");
      }
      return httpError(400, "validation_error", "The request violates a data integrity rule.");
    }
    case "23001":
      return httpError(409, "version_conflict", "This version is immutable; create a new version instead.");
    case "42501":
      return httpError(403, "clinical_access_denied", "You are not authorized for this clinical record.");
    case "42P01":
      return httpError(500, "schema_out_of_date", "Database schema is out of date. Run `npm run db:migrate` in Backend/.");
    default:
      return err;
  }
}

/**
 * Own the transaction. The callback receives a pooled client and must never
 * call res.* — it returns plain data. Every mutation + audit row commits or
 * rolls back together.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original error is the useful one.
    }
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

/**
 * Convert a local wall-clock time in an IANA timezone into a UTC instant.
 * Used for slot generation: availability windows are stored as local TIME,
 * while appointments are stored as TIMESTAMPTZ.
 */
function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);

  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()));
}

function localDateIn(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return parts.slice(0, 10);
}

module.exports = {
  assertUuid,
  sha256,
  isPlainObject,
  iso,
  dateOnly,
  timeLabel,
  pagination,
  page,
  optionalText,
  mapDbError,
  withTransaction,
  zonedTimeToUtc,
  localDateIn,
};
