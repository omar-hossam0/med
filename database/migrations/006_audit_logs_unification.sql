-- =============================================================================
-- Medora Healthcare — Migration 006: Audit Log Unification
-- =============================================================================
-- Completes Simplification V2 consolidations 1 and 6 of 6 on a database that
-- ALREADY has the Admin backend's audit layer from migrations 004 and 005:
--
--   appointment_status_history  ->  audit_logs   (event_type appointment.status_changed)
--   security_events             ->  audit_logs   (event_category security)
--
-- WHY THIS FILE ALTERS INSTEAD OF CREATES
-- ---------------------------------------
-- 005_admin_account_lifecycle.sql created `audit_logs` with a single opaque
-- `action` column and a separate `security_events` table. Those two migrations
-- are published and are already applied on the teammate's database, so they
-- must never be edited. This migration therefore transforms the existing
-- tables into the V2 shape, in place, and carries every existing row across:
--
--   audit_logs.action        -> event_type (namespaced) + event_category
--   security_events.*        -> audit_logs rows with event_category = 'security'
--
-- No audit row is discarded, no timestamp is rewritten, and the table is only
-- dropped after its rows have been copied.
--
-- Do NOT add BEGIN/COMMIT: the migration runner wraps this file and its
-- schema_migrations row in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. audit_logs — add the V2 event columns
-- -----------------------------------------------------------------------------
-- Added nullable first so the backfill below can run, then tightened to
-- NOT NULL. Adding them as NOT NULL immediately would fail on existing rows.

ALTER TABLE audit_logs
    ADD COLUMN event_type          VARCHAR(60),
    ADD COLUMN event_category      VARCHAR(30),
    ADD COLUMN severity            VARCHAR(20) NOT NULL DEFAULT 'info',
    ADD COLUMN from_status         VARCHAR(30),
    ADD COLUMN to_status           VARCHAR(30),
    ADD COLUMN change_source       VARCHAR(20),
    ADD COLUMN change_reason       VARCHAR(500),
    ADD COLUMN session_id          UUID REFERENCES sessions (id) ON DELETE SET NULL,
    ADD COLUMN resolved_at         TIMESTAMPTZ,
    ADD COLUMN resolved_by_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    ADD COLUMN resolution_notes    TEXT;


-- -----------------------------------------------------------------------------
-- 2. Backfill from `action`
-- -----------------------------------------------------------------------------
-- The Admin backend already writes namespaced codes (user.provisioned,
-- user.status_changed, doctor.verification_changed, member.profile_updated,
-- user.invitation_resent, user.password_reset_issued), so `action` is promoted
-- to `event_type` unchanged. Anything that does not match the V2 namespace
-- format is normalised under `system.` rather than rejected, because refusing
-- to migrate an old audit row would lose evidence.

UPDATE audit_logs
   SET event_type = CASE
           WHEN action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$' THEN action
           ELSE 'system.' || COALESCE(
                    NULLIF(regexp_replace(lower(action), '[^a-z0-9]+', '_', 'g'), ''),
                    'unknown')
       END,
       event_category = CASE
           WHEN action LIKE 'security.%' THEN 'security'
           WHEN action IN ('user.provisioned', 'user.invitation_resent',
                           'user.password_reset_issued', 'user.status_changed')
               THEN 'provisioning'
           WHEN action = 'doctor.verification_changed' THEN 'approval'
           ELSE 'configuration'
       END;

ALTER TABLE audit_logs
    ALTER COLUMN event_type     SET NOT NULL,
    ALTER COLUMN event_category SET NOT NULL;

COMMENT ON COLUMN audit_logs.event_type IS
    'Stable namespaced event code, e.g. appointment.status_changed, report.approved, security.login_failed, user.provisioned. Replaces the pre-unification `action` column.';
COMMENT ON COLUMN audit_logs.event_category IS
    'Queryable bucket. Must equal the namespace prefix for security events.';

-- The old column is dropped only after every row has been mapped.
ALTER TABLE audit_logs DROP COLUMN action;


-- -----------------------------------------------------------------------------
-- 3. Replace the pre-unification constraints with the V2 set
-- -----------------------------------------------------------------------------
-- The old checks are narrower than V2 needs: actor_type had no 'agent' and
-- outcome had no 'blocked'.

ALTER TABLE audit_logs
    DROP CONSTRAINT audit_logs_actor_type_check,
    DROP CONSTRAINT audit_logs_outcome_check;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_event_category_check
        CHECK (event_category IN (
            'appointment', 'security', 'clinical_access', 'approval',
            'provisioning', 'configuration', 'system'
        )),

    ADD CONSTRAINT audit_logs_event_type_format_check
        CHECK (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),

    -- A security event must be in the security namespace and vice versa.
    ADD CONSTRAINT audit_logs_security_namespace_check
        CHECK ((event_category = 'security') = (event_type LIKE 'security.%')),

    ADD CONSTRAINT audit_logs_severity_check
        CHECK (severity IN ('info', 'warning', 'critical')),

    ADD CONSTRAINT audit_logs_actor_type_check
        CHECK (actor_type IN ('user', 'system', 'service', 'agent')),

    ADD CONSTRAINT audit_logs_outcome_check
        CHECK (outcome IN ('success', 'denied', 'failure', 'blocked')),

    -- Appointment transition integrity (consolidation 1).
    ADD CONSTRAINT audit_logs_appointment_transition_check
        CHECK ((event_type = 'appointment.status_changed') = (to_status IS NOT NULL)),

    ADD CONSTRAINT audit_logs_appointment_status_change_check
        CHECK (event_type <> 'appointment.status_changed'
               OR from_status IS NULL
               OR from_status <> to_status),

    ADD CONSTRAINT audit_logs_appointment_source_check
        CHECK (event_type <> 'appointment.status_changed'
               OR (change_source IS NOT NULL AND entity_type = 'appointment' AND entity_id IS NOT NULL)),

    ADD CONSTRAINT audit_logs_change_source_check
        CHECK (change_source IS NULL
               OR change_source IN ('patient', 'staff', 'doctor', 'admin', 'system', 'agent')),

    -- Investigation integrity (consolidation 6).
    ADD CONSTRAINT audit_logs_resolution_pair_check
        CHECK ((resolved_at IS NULL) = (resolved_by_user_id IS NULL)),

    ADD CONSTRAINT audit_logs_resolution_note_check
        CHECK (resolution_notes IS NULL OR resolved_at IS NOT NULL);


-- -----------------------------------------------------------------------------
-- 4. Replace the index set
-- -----------------------------------------------------------------------------
-- Two of these indexes exist specifically to replace the read paths of the two
-- consolidated tables, so a query written against them keeps its shape.

DROP INDEX idx_audit_logs_patient_occurred;
DROP INDEX idx_audit_logs_actor_occurred;
DROP INDEX idx_audit_logs_entity;
DROP INDEX idx_audit_logs_occurred;

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
-- 5. Migrate security_events rows into audit_logs (consolidation 6)
-- -----------------------------------------------------------------------------
-- The Admin backend's only security writer emits `privilege_changed`; the
-- namespace is added so the V2 format check holds. `outcome` is nullable in the
-- old table and NOT NULL in V2, so a missing outcome is recorded as 'success'
-- rather than dropped — the row is evidence even when the outcome is unknown.
-- The old table had no entity reference; it is derived from what the row
-- actually pointed at.

INSERT INTO audit_logs (
    event_type, event_category, severity,
    actor_user_id, actor_type, entity_type, entity_id,
    patient_user_id, outcome,
    request_id, session_id, ip_address, user_agent,
    resolved_at, resolved_by_user_id, resolution_notes,
    metadata, occurred_at
)
SELECT
    CASE
        WHEN se.event_type LIKE 'security.%' THEN se.event_type
        ELSE 'security.' || COALESCE(
                 NULLIF(regexp_replace(lower(se.event_type), '[^a-z0-9]+', '_', 'g'), ''),
                 'other')
    END,
    'security',
    se.severity,
    se.user_id,
    CASE WHEN se.user_id IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN se.user_id    IS NOT NULL THEN 'user'
         WHEN se.session_id IS NOT NULL THEN 'session'
         ELSE 'system'
    END,
    COALESCE(se.user_id, se.session_id),
    NULL,
    COALESCE(se.outcome, 'success'),
    NULL,
    se.session_id,
    se.ip_address,
    se.user_agent,
    se.resolved_at,
    se.resolved_by_user_id,
    se.resolution_notes,
    se.metadata,
    se.occurred_at
FROM security_events AS se;

COMMENT ON TABLE audit_logs IS
    'Single append-only trail for operational, clinical, approval, provisioning and security events. Absorbs the retired appointment_status_history and security_events tables. Never store passwords, session tokens, raw audio, full clinical narrative or unredacted request bodies.';

-- Retired only now that every row has been copied above.
DROP TABLE security_events;


-- -----------------------------------------------------------------------------
-- 6. Append-only enforcement
-- -----------------------------------------------------------------------------
-- UPDATE and DELETE are refused at the database level, not only in the service.
-- The single exception is recording a security investigation outcome, and that
-- is allowed exactly once per event. Comparing to_jsonb(OLD) with to_jsonb(NEW)
-- minus the three resolution columns means a future column is protected by
-- default instead of having to be added to a list here.
--
-- Installed AFTER the backfills above so it cannot block them.

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

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_append_only();


-- -----------------------------------------------------------------------------
-- 7. Read views for the two retired tables
-- -----------------------------------------------------------------------------
-- These reproduce the retired tables' read shape, so the API contract planned
-- for them survives the consolidation. Views are not base tables and do not
-- affect the physical table count.

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
-- 8. notifications — tighten the delivery contract
-- -----------------------------------------------------------------------------
-- The table itself is created by 005 and is reused unchanged. These four CHECKs
-- are additive and hold for every row the Admin backend writes (all inserts use
-- status 'pending' with NULL timestamps and a non-empty title).

ALTER TABLE notifications
    ADD CONSTRAINT notifications_title_check
        CHECK (char_length(btrim(title)) > 0),

    ADD CONSTRAINT notifications_sent_at_check
        CHECK (sent_at IS NULL OR status <> 'pending'),

    ADD CONSTRAINT notifications_read_at_check
        CHECK (read_at IS NULL OR status = 'read'),

    ADD CONSTRAINT notifications_failure_reason_check
        CHECK (failure_reason IS NULL OR status = 'failed');

COMMENT ON COLUMN notifications.body IS
    'Minimum-necessary message text. Never diagnosis, report content, tokens or secrets.';
