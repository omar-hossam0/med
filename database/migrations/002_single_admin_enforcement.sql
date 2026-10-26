-- Medora Healthcare — Migration 002: Single Admin Database-Level Enforcement
-- Prevents more than one user from being assigned the 'admin' role.

CREATE OR REPLACE FUNCTION enforce_single_admin()
RETURNS TRIGGER AS $$
DECLARE
    admin_role_id UUID;
    existing_admin_count INT;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';

    IF admin_role_id IS NOT NULL AND NEW.role_id = admin_role_id THEN
        SELECT COUNT(*) INTO existing_admin_count
        FROM user_roles
        WHERE role_id = admin_role_id
          AND user_id <> NEW.user_id;

        IF existing_admin_count > 0 THEN
            RAISE EXCEPTION 'A single Admin account is already configured. Multiple admin accounts are prohibited.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_single_admin ON user_roles;
CREATE TRIGGER trg_enforce_single_admin
BEFORE INSERT OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION enforce_single_admin();
