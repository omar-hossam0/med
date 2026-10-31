const crypto = require("crypto");
const pool = require("../config/db");
const { hashPassword } = require("./authService");
const auditService = require("./auditService");
const { httpError } = require("../utils/httpError");
const { Validator } = require("../utils/validators");

/**
 * Invitation and password-reset tokens.
 *
 * Only a SHA-256 hash is stored. The plaintext token is returned once, to the
 * authenticated administrator who created it, and is never logged. There is no
 * mailer in this project yet, so the notification row records the intent while
 * the token itself is handed over out of band.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a token, revoking any previous live token of the same purpose so the
 * partial unique index can never be violated.
 */
async function createInvitation(client, { userId, purpose = "invite", createdBy = null }) {
  await client.query(
    `UPDATE user_invitations
     SET revoked_at = now()
     WHERE user_id = $1
       AND purpose = $2
       AND used_at IS NULL
       AND revoked_at IS NULL`,
    [userId, purpose]
  );

  const token = generateToken();
  const tokenHash = hashToken(token);
  const ttl = purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);

  await client.query(
    `INSERT INTO user_invitations (user_id, token_hash, purpose, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, purpose, expiresAt, createdBy]
  );

  return { token, expiresAt, purpose };
}

async function revokeLiveInvitations(client, userId) {
  await client.query(
    `UPDATE user_invitations
     SET revoked_at = now()
     WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Consume a token and set the account password.
 *
 * `invite` activates a pending account; `password_reset` keeps the current
 * status and revokes existing sessions.
 */
async function activate({ token, password, context = {} }) {
  const validator = new Validator();
  const plainToken = validator.text(token, "token", {
    required: true,
    min: 32,
    max: 200,
    label: "Activation token",
  });
  const newPassword = validator.password(password);
  validator.done();

  const tokenHash = hashToken(plainToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT i.id, i.user_id, i.purpose, i.expires_at, i.used_at, i.revoked_at,
              u.email, u.status
       FROM user_invitations i
       JOIN users u ON u.id = i.user_id
       WHERE i.token_hash = $1
       FOR UPDATE OF i`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw httpError(
        400,
        "token_invalid",
        "This activation link is not valid. Ask an administrator to send a new one."
      );
    }

    const invitation = result.rows[0];

    if (invitation.used_at || invitation.revoked_at) {
      throw httpError(
        400,
        "token_invalid",
        "This activation link has already been used. Ask an administrator to send a new one."
      );
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw httpError(
        400,
        "token_expired",
        "This activation link has expired. Ask an administrator to send a new one."
      );
    }

    if (invitation.status === "disabled") {
      throw httpError(
        409,
        "invitation_not_applicable",
        "This account is disabled. Contact clinic administration."
      );
    }

    if (invitation.purpose === "invite" && invitation.status !== "pending_activation") {
      throw httpError(
        409,
        "invitation_not_applicable",
        "This account has already been activated."
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const nextStatus =
      invitation.purpose === "invite" ? "active" : invitation.status;

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           status = $2,
           email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $3`,
      [passwordHash, nextStatus, invitation.user_id]
    );

    await client.query(
      `UPDATE user_invitations SET used_at = now() WHERE id = $1`,
      [invitation.id]
    );

    // A reset must not leave an attacker's session alive.
    if (invitation.purpose === "password_reset") {
      await client.query(
        `UPDATE sessions
         SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [invitation.user_id]
      );
    }

    await auditService.record(client, {
      actorUserId: invitation.user_id,
      eventType:
        invitation.purpose === "invite"
          ? "user.activated"
          : "user.password_reset_completed",
      eventCategory: "provisioning",
      entityType: "user",
      entityId: invitation.user_id,
      before: { status: invitation.status },
      after: { status: nextStatus },
      metadata: { purpose: invitation.purpose },
      ip: context.ip || null,
      userAgent: context.userAgent || null,
    });

    await client.query("COMMIT");

    return {
      id: invitation.user_id,
      email: invitation.email,
      status: nextStatus,
      purpose: invitation.purpose,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  INVITE_TTL_MS,
  RESET_TTL_MS,
  generateToken,
  hashToken,
  createInvitation,
  revokeLiveInvitations,
  activate,
};
