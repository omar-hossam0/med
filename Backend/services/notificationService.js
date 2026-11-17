/** Own-notification reads and the read transition (Phase 8). */
const pool = require("../config/db");
const auditService = require("./auditService");
const { httpError } = require("../utils/httpError");
const { assertUuid, pagination, withTransaction } = require("../utils/dbHelpers");
const { serializeNotification } = require("../utils/patientSerializers");

async function listNotifications({ actorId, query }) {
  const { limit, offset } = pagination(query, { defaultLimit: 50 });
  const { rows } = await pool.query(
    `SELECT * FROM notifications
      WHERE recipient_user_id = $1
        AND ($2::boolean IS FALSE OR status <> 'read')
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4`,
    [actorId, query.unread === "true", limit, offset]
  );
  const { rows: counts } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status <> 'read')::int AS unread
       FROM notifications WHERE recipient_user_id = $1`,
    [actorId]
  );
  return {
    notifications: rows.map(serializeNotification),
    unreadCount: counts[0].unread,
    pagination: {
      total: counts[0].total,
      limit,
      offset,
      returned: rows.length,
      hasMore: offset + rows.length < counts[0].total,
    },
  };
}

async function getUnreadCount({ actorId }) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS unread FROM notifications
      WHERE recipient_user_id = $1 AND status <> 'read'`,
    [actorId]
  );
  return { unreadCount: rows[0].unread };
}

async function markRead(ctx) {
  const id = assertUuid(ctx.params.id, "Notification");
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT id FROM notifications WHERE id = $1 AND recipient_user_id = $2 FOR UPDATE`,
      [id, ctx.actorId]
    );
    if (current.rowCount === 0) throw httpError(404, "not_found", "Notification not found.");

    const { rows } = await client.query(
      `UPDATE notifications SET status = 'read', read_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    await auditService.recordMutation(client, {
      actorUserId: ctx.actorId,
      eventType: "notification.read",
      eventCategory: "system",
      entityType: "notification",
      entityId: id,
      metadata: {},
      context: ctx.context,
    });
    return { notification: serializeNotification(rows[0]) };
  });
}

module.exports = { listNotifications, getUnreadCount, markRead };
