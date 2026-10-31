-- =============================================================================
-- Medora Healthcare — Migration 004: Operations, Unified Audit Trail
-- =============================================================================
-- Simplification V2, consolidations 1 and 6 of 6:
--
--   appointment_status_history  ->  audit_logs   (event_type appointment.status_changed)
--   security_events             ->  audit_logs   (event_category security)
--
-- Neither source table has ever been deployed on this database, so this file
-- creates the consolidated form directly instead of creating an obsolete table
-- and dropping it later. See database/PREFLIGHT_REPORT_V2.md §6.
--
-- One append-only trail carries operational, clinical, approval, provisioning
-- and security events. Event-specific detail is modelled two ways:
--   * typed columns for the fields that are queried and indexed
--     (from_status / to_status / change_source for appointment transitions,
--      severity / session_id / resolution_* for security investigations);
--   * validated JSONB (before_state / after_state / metadata) for the rest,
--     never for credentials, tokens or clinical narrative.
--
-- Do NOT add BEGIN/COMMIT: the migration runner wraps this file and its
-- schema_migrations row in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. audit_logs — the single append-only event trail
-- -----------------------------------------------------------------------------
-- Replaces two previously proposed tables:
--   * appointment_status_history — kept as an event_type, not a table, because
--     every column it needed already exists here as a typed column.
--   * security_events — kept as an event_category plus severity, session
--     correlation and investigation columns.
--
-- There is deliberately no FK from audit_logs to appointments: the trail must
-- survive the referenced row and must be able to record events about entities
-- that no longer exist. entity_type + entity_id is the deliberate soft link,
-- exactly as the two retired tables did it.

CREATE TABLE audit_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity of the event. event_type is a stable, namespaced code such as
    -- 'appointment.status_changed', 'report.approved' or 'security.login_failed'.
    -- event_category is the queryable bucket and must match the type's namespace.
    event_type          VARCHAR(60)  NOT NULL,
    event_category      VARCHAR(30)  NOT NULL,
    severity            VARCHAR(20)  NOT NULL DEFAULT 'info',

    actor_user_id       UUID NULL
                            REFERENCES users (id) ON DELETE SET NULL,
    actor_type          VARCHAR(20)  NOT NULL DEFAULT 'user',

    entity_type         VARCHAR(50)  NOT NULL,
    entity_id           UUID NULL,
    patient_user_id     UUID NULL
                            REFERENCES users (id) ON DELETE SET NULL,

    outcome             VARCHAR(20)  NOT NULL DEFAULT 'success',

    -- Appointment status transition (consolidation 1). NULL on every other
    -- event type; enforced below so the timeline can never be ambiguous.
    from_status         VARCHAR(30)  NULL,
    to_status           VARCHAR(30)  NULL,
    change_source       VARCHAR(20)  NULL,
    change_reason       VARCHAR(500) NULL,

    -- Request and session correlation (consolidation 6).
    request_id          VARCHAR(100) NULL,
    session_id          UUID NULL
                            REFERENCES sessions (id) ON DELETE SET NULL,
    ip_address          INET NULL,
    user_agent          TEXT NULL,

    -- Security investigation state (consolidation 6). These three columns are
    -- the ONLY columns the append-only trigger allows to change after insert.
    resolved_at         TIMESTAMPTZ NULL,
    resolved_by_user_id UUID NULL
                            REFERENCES users (id) ON DELETE RESTRICT,
    resolution_notes    TEXT NULL,

    before_state        JSONB NULL,
    after_state         JSONB NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Event vocabulary ------------------------------------------------------
    CONSTRAINT audit_logs_event_category_check
        CHECK (event_category IN (
            'appointment', 'security', 'clinical_access', 'approval',
            'provisioning', 'configuration', 'system'
        )),

    -- Namespaced code: lowercase.segment, e.g. 'appointment.status_changed'.
    CONSTRAINT audit_logs_event_type_format_check
        CHECK (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),

    -- A security event must be in the security namespace and vice versa. This
    -- is what lets the security dashboard filter on one predicate safely.
    CONSTRAINT audit_logs_security_namespace_check
        CHECK ((event_category = 'security') = (event_type LIKE 'security.%')),

    CONSTRAINT audit_logs_severity_check
        CHECK (severity IN ('info', 'warning', 'critical')),

    CONSTRAINT audit_logs_actor_type_check
        CHECK (actor_type IN ('user', 'system', 'service', 'agent')),

    CONSTRAINT audit_logs_outcome_check
        CHECK (outcome IN ('success', 'denied', 'failure', 'blocked')),

    -- Appointment transition integrity (consolidation 1). A transition row
    -- must name its new status, its source and its appointment; it must not
    -- claim a no-op change; and no other event type may carry these columns.
    CONSTRAINT audit_logs_appointment_transition_check
        CHECK ((event_type = 'appointment.status_changed') = (to_status IS NOT NULL)),

    CONSTRAINT audit_logs_appointment_status_change_check
        CHECK (event_type <> 'appointment.status_changed'
               OR from_status IS NULL
               OR from_status <> to_status),

    CONSTRAINT audit_logs_appointment_source_check
        CHECK (event_type <> 'appointment.status_changed'
               OR (change_source IS NOT NULL AND entity_type = 'appointment' AND entity_id IS NOT NULL)),

    CONSTRAINT audit_logs_change_source_check
        CHECK (change_source IS NULL
               OR change_source IN ('patient', 'staff', 'doctor', 'admin', 'system', 'agent')),

    -- Investigation integrity (consolidation 6).
    CONSTRAINT audit_logs_resolution_pair_check
        CHECK ((resolved_at IS NULL) = (resolved_by_user_id IS NULL)),

    CONSTRAINT audit_logs_resolution_note_check
        CHECK (resolution_notes IS NULL OR resolved_at IS NOT NULL)
);

COMMENT ON TABLE audit_logs IS
    'Single append-only trail for operational, clinical, approval, provisioning and security events. Absorbs the proposed appointment_status_history and security_events tables. Never store passwords, session tokens, raw audio, full clinical narrative or unredacted request bodies.';
COMMENT ON COLUMN audit_logs.event_type IS
    'Stable namespaced event code, e.g. appointment.status_changed, report.approved, security.login_failed.';
COMMENT ON COLUMN audit_logs.event_category IS
    'Queryable bucket. Must equal the namespace prefix of event_type for security events.';
COMMENT ON COLUMN audit_logs.from_status IS
    'Previous appointment status. NULL on the first transition of an appointment.';
COMMENT ON COLUMN audit_logs.to_status IS
    'New appointment status. Non-NULL exactly when event_type is appointment.status_changed.';
COMMENT ON COLUMN audit_logs.change_source IS
    'Who initiated the appointment change: patient, staff, doctor, admin, system or agent.';
COMMENT ON COLUMN audit_logs.resolution_notes IS
    'Security investigation outcome. The only writable text after insert.';


-- -----------------------------------------------------------------------------
-- 2. Audit indexes
-- -----------------------------------------------------------------------------
-- Two of these exist specifically to replace the read paths of the retired
-- tables, so a query written against them keeps its performance shape.

-- Appointment timeline: the appointment_status_history replacement.
CREATE INDEX idx_audit_logs_appointment_timeline
    ON audit_logs (entity_id, occurred_at)
    WHERE event_type = 'appointment.status_changed';

-- Security dashboard: the security_events replacement.
CREATE INDEX idx_audit_logs_security
    ON audit_logs (event_category, severity, occurred_at DESC)
    WHERE event_category = 'security';

-- Open security investigations only. Small, and the most frequently polled.
CREATE INDEX idx_audit_logs_security_open
    ON audit_logs (occurred_at)
    WHERE event_category = 'security' AND resolved_at IS NULL;

-- General access-history and correlation paths.
CREATE INDEX idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id, occurred_at DESC);

CREATE INDEX idx_audit_logs_patient
    ON audit_logs (patient_user_id, occurred_at DESC)
    WHERE patient_user_id IS NOT NULL;

CREATE INDEX idx_audit_logs_actor
    ON audit_logs (actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;

CREATE INDEX idx_audit_logs_event_type
    ON audit_logs (event_type, occurred_at DESC);

CREATE INDEX idx_audit_logs_occurred
    ON audit_logs (occurred_at DESC);

CREATE INDEX idx_audit_logs_session
    ON audit_logs (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX idx_audit_logs_request
    ON audit_logs (request_id)
    WHERE request_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. Append-only enforcement
-- -----------------------------------------------------------------------------
-- UPDATE and DELETE are refused at the database level, not only in the service.
-- The single exception is recording a security investigation outcome, and that
-- is allowed exactly once per event. Comparing to_jsonb(OLD) with to_jsonb(NEW)
-- minus the three resolution columns means a future column is protected by
-- default instead of having to be added to a list here.

CREATE OR REPLACE FUNCTION enforce_audit_logs_append_only()
RETURNS TRIGGER AS $$
DECLARE
    resolution_columns TEXT[] := ARRAY['resolved_at', 'resolved_by_user_id', 'resolution_notes'];
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_logs is append-only: event % cannot be deleted', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD.resolved_at IS NOT NULL THEN
        RAISE EXCEPTION 'audit_logs event % is already resolved and is now immutable', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF (to_jsonb(NEW) - resolution_columns) IS DISTINCT FROM (to_jsonb(OLD) - resolution_columns) THEN
        RAISE EXCEPTION 'audit_logs is append-only: only the resolution columns of event % may change', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.resolved_at IS NOT NULL AND OLD.event_category <> 'security' THEN
        RAISE EXCEPTION 'audit_logs event % is not a security event and cannot be resolved', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_audit_logs_append_only() IS
    'BEFORE UPDATE OR DELETE on audit_logs: refuses edits and deletes; allows a single security resolution.';

CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_append_only();


-- -----------------------------------------------------------------------------
-- 4. Read views for the two retired tables
-- -----------------------------------------------------------------------------
-- These reproduce the retired tables' read shape, so the API contract that was
-- planned for them survives the consolidation. Views are not base tables and
-- do not affect the physical table count.

CREATE VIEW v_appointment_status_timeline AS
SELECT
    l.id            AS id,
    l.entity_id     AS appointment_id,
    l.from_status,
    l.to_status,
    l.actor_user_id AS changed_by_user_id,
    l.change_source,
    l.change_reason AS reason,
    l.occurred_at   AS changed_at
FROM audit_logs AS l
WHERE l.event_type = 'appointment.status_changed';

COMMENT ON VIEW v_appointment_status_timeline IS
    'Appointment status timeline read model over audit_logs. Replaces the retired appointment_status_history table.';

CREATE VIEW v_security_events AS
SELECT
    l.id,
    l.event_type,
    l.severity,
    l.actor_user_id     AS user_id,
    l.session_id,
    l.ip_address,
    l.user_agent,
    l.outcome,
    l.metadata,
    l.occurred_at,
    l.resolved_at,
    l.resolved_by_user_id,
    l.resolution_notes
FROM audit_logs AS l
WHERE l.event_category = 'security';

COMMENT ON VIEW v_security_events IS
    'Security event read model over audit_logs. Replaces the retired security_events table. Access is restricted to admin-scoped endpoints.';


-- -----------------------------------------------------------------------------
-- 5. notifications
-- -----------------------------------------------------------------------------
-- Unchanged in shape from the ERD. It is created here because it is the only
-- other Operations table and shares this module's lifecycle.

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id   UUID NOT NULL
                            REFERENCES users (id) ON DELETE CASCADE,
    category            VARCHAR(40) NOT NULL,
    channel             VARCHAR(20) NOT NULL DEFAULT 'in_app',
    title               VARCHAR(200) NOT NULL,
    body                TEXT NOT NULL,
    related_entity_type VARCHAR(40) NULL,
    related_entity_id   UUID NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_for       TIMESTAMPTZ NULL,
    sent_at             TIMESTAMPTZ NULL,
    read_at             TIMESTAMPTZ NULL,
    failure_reason      VARCHAR(500) NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT notifications_category_check
        CHECK (category IN ('appointment', 'report_ready', 'account', 'system', 'security')),

    CONSTRAINT notifications_channel_check
        CHECK (channel IN ('in_app', 'email', 'sms')),

    CONSTRAINT notifications_status_check
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),

    -- A notification must have a title and a minimum-necessary body. The body
    -- must never carry diagnosis, report content, tokens or secrets.
    CONSTRAINT notifications_title_check
        CHECK (char_length(btrim(title)) > 0),

    CONSTRAINT notifications_sent_at_check
        CHECK (sent_at IS NULL OR status <> 'pending'),

    CONSTRAINT notifications_read_at_check
        CHECK (read_at IS NULL OR status = 'read'),

    CONSTRAINT notifications_failure_reason_check
        CHECK (failure_reason IS NULL OR status = 'failed')
);

COMMENT ON TABLE notifications IS
    'User-facing notification record. Not a clinical record and not a substitute for report approval or publication.';
COMMENT ON COLUMN notifications.body IS
    'Minimum-necessary message text. Never diagnosis, report content, tokens or secrets.';

CREATE INDEX idx_notifications_recipient_status
    ON notifications (recipient_user_id, status, created_at DESC);

CREATE INDEX idx_notifications_scheduled
    ON notifications (scheduled_for, status)
    WHERE scheduled_for IS NOT NULL;
