-- =============================================================================
-- Medora Healthcare — Migration 005: Admin Account Lifecycle
-- =============================================================================
-- Adds the account-lifecycle and audit layer the Admin modules need.
--
-- New objects:
--   user_invitations  — hashed, single-use, expiring invite/reset tokens
--   notifications     — the designed delivery record (no tokens in the body)
--   audit_logs        — append-only administrative audit trail
--   security_events   — authentication / privilege / CSRF event stream
--
-- These four tables are moved forward from the staged plan (they were
-- documented as stage 012). The admin modules cannot provision an account or
-- justify a status change without them.
--
-- Design notes:
--   * Tokens are stored only as SHA-256 hashes. Plaintext is returned once to
--     the authenticated administrator and never logged.
--   * audit_logs has NO cascade from users: the actor reference is SET NULL so
--     deleting an account cannot erase the trail. This matches the DBML
--     relationship list.
--   * No clinical content, request bodies, passwords or tokens in any JSONB
--     column here.
--
-- Do NOT add BEGIN/COMMIT: the migration runner wraps this file and its
-- schema_migrations row in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. user_invitations — activation and password-reset tokens
-- -----------------------------------------------------------------------------

CREATE TABLE user_invitations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose    VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_invitations_purpose_check
        CHECK (purpose IN ('invite', 'password_reset')),

    CONSTRAINT user_invitations_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX idx_user_invitations_user
    ON user_invitations (user_id, purpose, used_at);

-- At most one live invitation per user. Issuing a new one must revoke the old.
CREATE UNIQUE INDEX uq_user_invitations_live_invite
    ON user_invitations (user_id)
    WHERE purpose = 'invite' AND used_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE user_invitations IS
    'Single-use, expiring activation and password-reset tokens. Only the SHA-256 hash is stored.';
COMMENT ON COLUMN user_invitations.token_hash IS
    'SHA-256 of the opaque token. The plaintext is shown once to the administrator and never persisted.';


-- -----------------------------------------------------------------------------
-- 2. notifications — user-facing delivery record
-- -----------------------------------------------------------------------------

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category            VARCHAR(40) NOT NULL,
    channel             VARCHAR(20) NOT NULL DEFAULT 'in_app',
    title               VARCHAR(200) NOT NULL,
    body                TEXT NOT NULL,
    related_entity_type VARCHAR(40),
    related_entity_id   UUID,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_for       TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    failure_reason      VARCHAR(500),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT notifications_category_check
        CHECK (category IN ('appointment', 'report_ready', 'account', 'system', 'security')),

    CONSTRAINT notifications_channel_check
        CHECK (channel IN ('in_app', 'email', 'sms')),

    CONSTRAINT notifications_status_check
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);

CREATE INDEX idx_notifications_recipient_status
    ON notifications (recipient_user_id, status, created_at);
CREATE INDEX idx_notifications_scheduled
    ON notifications (scheduled_for, status);

COMMENT ON TABLE notifications IS
    'User-facing notification record. Not a clinical record and never a carrier for tokens or report content.';


-- -----------------------------------------------------------------------------
-- 3. audit_logs — append-only administrative audit trail
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID REFERENCES users (id) ON DELETE SET NULL,
    actor_type      VARCHAR(20) NOT NULL DEFAULT 'user',
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID,
    patient_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    outcome         VARCHAR(20) NOT NULL DEFAULT 'success',
    request_id      VARCHAR(100),
    ip_address      INET,
    user_agent      TEXT,
    before_state    JSONB,
    after_state     JSONB,
    metadata        JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_actor_type_check
        CHECK (actor_type IN ('user', 'system', 'service')),

    CONSTRAINT audit_logs_outcome_check
        CHECK (outcome IN ('success', 'denied', 'failure'))
);

CREATE INDEX idx_audit_logs_patient_occurred ON audit_logs (patient_user_id, occurred_at);
CREATE INDEX idx_audit_logs_actor_occurred   ON audit_logs (actor_user_id, occurred_at);
CREATE INDEX idx_audit_logs_entity           ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_occurred         ON audit_logs (occurred_at);

COMMENT ON TABLE audit_logs IS
    'Append-only audit trail for provisioning, status changes and configuration. Never store passwords, tokens, clinical narratives or unredacted request bodies.';
COMMENT ON COLUMN audit_logs.before_state IS
    'Redacted snapshot before the change. No secrets, no clinical content.';


-- -----------------------------------------------------------------------------
-- 4. security_events — authentication and privilege event stream
-- -----------------------------------------------------------------------------

CREATE TABLE security_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          VARCHAR(60) NOT NULL,
    severity            VARCHAR(20) NOT NULL DEFAULT 'info',
    user_id             UUID REFERENCES users (id) ON DELETE SET NULL,
    session_id          UUID REFERENCES sessions (id) ON DELETE SET NULL,
    ip_address          INET,
    user_agent          TEXT,
    outcome             VARCHAR(20),
    metadata            JSONB NOT NULL DEFAULT '{}',
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ,
    resolved_by_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    resolution_notes    TEXT,

    CONSTRAINT security_events_severity_check
        CHECK (severity IN ('info', 'warning', 'critical')),

    CONSTRAINT security_events_outcome_check
        CHECK (outcome IS NULL OR outcome IN ('success', 'failure', 'blocked')),

    CONSTRAINT security_events_resolution_check
        CHECK (resolved_at IS NULL OR resolved_by_user_id IS NOT NULL)
);

CREATE INDEX idx_security_events_type_occurred
    ON security_events (event_type, occurred_at);
CREATE INDEX idx_security_events_severity_occurred
    ON security_events (severity, occurred_at);
CREATE INDEX idx_security_events_user_occurred
    ON security_events (user_id, occurred_at);

COMMENT ON TABLE security_events IS
    'Operational and security event stream, separate from the administrative audit trail. No credentials, tokens or clinical content.';
