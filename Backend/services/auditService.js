const pool = require("../config/db");

/**
 * Administrative audit trail and security event stream.
 *
 * Both accept an optional `client` so they can join the caller's transaction:
 * an audit row must commit or roll back with the change it describes.
 *
 * Never pass passwords, tokens, request bodies or clinical content into
 * `before`, `after` or `metadata`.
 */

function clientOrPool(client) {
  return client || pool;
}

async function record(client, entry) {
  const {
    actorUserId = null,
    actorType = "user",
    action,
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

  await clientOrPool(client).query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_type, action, entity_type, entity_id,
        patient_user_id, outcome, request_id, ip_address, user_agent,
        before_state, after_state, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      actorUserId,
      actorType,
      action,
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
  } = entry;

  await clientOrPool(client).query(
    `INSERT INTO security_events
       (event_type, severity, user_id, session_id, ip_address, user_agent,
        outcome, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      eventType,
      severity,
      userId,
      sessionId,
      ip,
      userAgent,
      outcome,
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
