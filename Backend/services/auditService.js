const pool = require("../config/db");

/**
 * Administrative audit trail and security event stream.
 *
 * Both accept an optional `client` so they can join the caller's transaction:
 * an audit row must commit or roll back with the change it describes.
 *
 * Database simplification V2 consolidated the former `security_events` table
 * into `audit_logs`: a security event is now an audit row with
 * `event_category = 'security'` and a `security.*` event type. Both writers
 * therefore target one table. Read models: `v_security_events` and
 * `v_appointment_status_timeline`.
 *
 * Never pass passwords, tokens, request bodies or clinical content into
 * `before`, `after` or `metadata`.
 */

/** Event codes are namespaced: `domain.thing_happened`. */
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

const EVENT_CATEGORIES = new Set([
  "appointment",
  "security",
  "clinical_access",
  "approval",
  "provisioning",
  "configuration",
  "system",
]);

function clientOrPool(client) {
  return client || pool;
}

function assertEventType(eventType) {
  if (typeof eventType !== "string" || !EVENT_TYPE_PATTERN.test(eventType)) {
    throw new Error(
      `auditService: eventType "${eventType}" must be namespaced, e.g. "user.provisioned".`
    );
  }
}

function assertCategory(eventCategory) {
  if (!EVENT_CATEGORIES.has(eventCategory)) {
    throw new Error(
      `auditService: eventCategory "${eventCategory}" is not one of ${[...EVENT_CATEGORIES].join(", ")}.`
    );
  }
}

async function record(client, entry) {
  const {
    actorUserId = null,
    actorType = "user",
    eventType,
    eventCategory = "provisioning",
    entityType,
    entityId = null,
    patientUserId = null,
    outcome = "success",
    before = null,
    after = null,
    metadata = {},
    ip = null,
    userAgent = null,
    requestId = null,
  } = entry;

  assertEventType(eventType);
  assertCategory(eventCategory);

  // The database binds the security category to the security namespace.
  if ((eventCategory === "security") !== eventType.startsWith("security.")) {
    throw new Error(
      `auditService: eventType "${eventType}" and eventCategory "${eventCategory}" disagree about the security namespace.`
    );
  }

  await clientOrPool(client).query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_type, event_type, event_category, entity_type,
        entity_id, patient_user_id, outcome, request_id, ip_address,
        user_agent, before_state, after_state, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      actorUserId,
      actorType,
      eventType,
      eventCategory,
      entityType,
      entityId,
      patientUserId,
      outcome,
      requestId,
      ip,
      userAgent,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      JSON.stringify(metadata),
    ]
  );
}

/**
 * Security event writer.
 *
 * Kept as a separate function because callers think in "security event" terms,
 * but it now writes the consolidated `audit_logs` row. The `security.` prefix is
 * added when the caller supplies a bare code such as `privilege_changed`, so
 * existing call sites keep working and the stored code is always namespaced.
 */
async function recordSecurityEvent(client, entry) {
  const {
    eventType,
    severity = "info",
    userId = null,
    sessionId = null,
    ip = null,
    userAgent = null,
    outcome = null,
    metadata = {},
    requestId = null,
  } = entry;

  const namespaced = String(eventType).startsWith("security.")
    ? eventType
    : `security.${String(eventType).replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;

  assertEventType(namespaced);

  // entity_type is NOT NULL in V2: point at what the event is actually about.
  const entityType = userId ? "user" : sessionId ? "session" : "system";
  const entityId = userId || sessionId || null;

  await clientOrPool(client).query(
    `INSERT INTO audit_logs
       (event_type, event_category, severity, actor_user_id, actor_type,
        entity_type, entity_id, session_id, outcome, request_id,
        ip_address, user_agent, metadata)
     VALUES ($1, 'security', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      namespaced,
      severity,
      userId,
      userId ? "user" : "system",
      entityType,
      entityId,
      sessionId,
      outcome || "success",
      requestId,
      ip,
      userAgent,
      JSON.stringify(metadata),
    ]
  );
}

/** Request context for audit rows, without logging headers wholesale. */
function requestContext(req) {
  return {
    ip: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };
}

module.exports = { record, recordSecurityEvent, requestContext };
