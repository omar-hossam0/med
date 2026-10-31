-- =============================================================================
-- Medora Healthcare — Migration 013: Audit Trail and Account Deletion
-- =============================================================================
-- Fixes a conflict between two rules that are both correct on their own:
--
--   1. audit_logs is append-only (migration 006).
--   2. audit_logs.actor_user_id is ON DELETE SET NULL, so deleting an account
--      must not destroy the trail that mentions it.
--
-- Rule 2 is implemented by PostgreSQL as an UPDATE on audit_logs. Rule 1
-- refused every UPDATE, so deleting any user who had ever been audited failed
-- with "audit_logs is append-only". That broke account deletion, and it broke
-- the Admin test suite's cleanup, which is how it was found.
--
-- Resolution: the *content* of an event stays immutable forever, but the two
-- identity pointers (actor_user_id, patient_user_id) may be cleared when the
-- account they point at is deleted. They may never be repointed at a different
-- live account — that would rewrite history rather than anonymise it.
--
-- Do NOT add BEGIN/COMMIT: the migration runner owns the transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_audit_logs_append_only()
RETURNS TRIGGER AS $$
DECLARE
    -- Columns that may change after insert: the identity pointers (only ever
    -- to NULL) and the security-investigation outcome (only ever once).
    identity_columns TEXT[] := ARRAY['actor_user_id', 'patient_user_id'];
    mutable_columns  TEXT[] := ARRAY[
        'actor_user_id', 'patient_user_id',
        'resolved_at', 'resolved_by_user_id', 'resolution_notes'
    ];
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_logs is append-only: event % cannot be deleted', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    -- An identity pointer may be cleared, never redirected.
    IF NEW.actor_user_id IS NOT NULL
       AND NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id THEN
        RAISE EXCEPTION 'audit_logs is append-only: the actor of event % cannot be reassigned', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.patient_user_id IS NOT NULL
       AND NEW.patient_user_id IS DISTINCT FROM OLD.patient_user_id THEN
        RAISE EXCEPTION 'audit_logs is append-only: the subject patient of event % cannot be reassigned', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    -- Everything except the identity pointers and the resolution trio is frozen.
    IF (to_jsonb(NEW) - mutable_columns) IS DISTINCT FROM (to_jsonb(OLD) - mutable_columns) THEN
        RAISE EXCEPTION 'audit_logs is append-only: only the resolution columns of event % may change', OLD.id
            USING ERRCODE = 'restrict_violation';
    END IF;

    -- A resolution may be recorded once, and never edited afterwards. Clearing
    -- an identity pointer is still allowed on an already resolved event.
    IF OLD.resolved_at IS NOT NULL
       AND (to_jsonb(NEW) - identity_columns) IS DISTINCT FROM (to_jsonb(OLD) - identity_columns) THEN
        RAISE EXCEPTION 'audit_logs event % is already resolved and is now immutable', OLD.id
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
    'BEFORE UPDATE OR DELETE on audit_logs: refuses deletes, freezes event content, allows a single security resolution, and allows actor_user_id/patient_user_id to be cleared (never reassigned) when the referenced account is deleted.';

COMMENT ON COLUMN audit_logs.actor_user_id IS
    'Actor of the event. ON DELETE SET NULL so deleting an account cannot destroy the trail; the trigger permits only NULL-ing, never reassignment.';

-- Evidence for the fix, kept as a permanent check rather than a one-off test.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = 'audit_logs'
           AND c.contype = 'f'
           AND pg_get_constraintdef(c.oid) LIKE '%actor_user_id%ON DELETE SET NULL%'
    ) THEN
        RAISE EXCEPTION 'audit_logs.actor_user_id must keep ON DELETE SET NULL, otherwise account deletion destroys audit evidence';
    END IF;
END;
$$;
