CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by UUID NULL,
    email_verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_status_check
        CHECK (status IN ('pending_activation', 'active', 'suspended', 'disabled')),
    CONSTRAINT users_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NULL
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT user_roles_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT role_permissions_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_permission_id_fkey
        FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

INSERT INTO roles (name, description)
VALUES
    ('patient', 'Patient account'),
    ('doctor', 'Doctor account'),
    ('receptionist', 'Receptionist and Staff account'),
    ('admin', 'Administrative account');

INSERT INTO permissions (code, description)
VALUES
    ('appointments.create', 'Create appointments'),
    ('appointments.view_own', 'View own appointments'),
    ('appointments.manage', 'Manage appointments'),
    ('consultations.view_authorized', 'View authorized consultations'),
    ('transcripts.review', 'Review transcripts'),
    ('transcripts.approve', 'Approve transcripts'),
    ('reports.view_own', 'View own reports'),
    ('reports.approve', 'Approve reports'),
    ('users.manage', 'Manage users'),
    ('roles.manage', 'Manage roles'),
    ('staff_accounts.create', 'Create doctor and receptionist/staff accounts'),
    ('staff_accounts.view', 'View doctor and receptionist/staff accounts'),
    ('staff_accounts.update', 'Update doctor and receptionist/staff accounts'),
    ('staff_accounts.disable', 'Disable or suspend doctor and receptionist/staff accounts'),
    ('staff_accounts.invite', 'Invite doctor and receptionist/staff accounts to activate securely');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
JOIN permissions AS p
  ON (r.name, p.code) IN (
      ('patient', 'appointments.create'),
      ('patient', 'appointments.view_own'),
      ('patient', 'reports.view_own'),
      ('doctor', 'appointments.view_own'),
      ('doctor', 'consultations.view_authorized'),
      ('doctor', 'transcripts.review'),
      ('doctor', 'transcripts.approve'),
      ('doctor', 'reports.approve'),
      ('receptionist', 'appointments.manage'),
      ('admin', 'users.manage'),
      ('admin', 'roles.manage'),
      ('admin', 'staff_accounts.create'),
      ('admin', 'staff_accounts.view'),
      ('admin', 'staff_accounts.update'),
      ('admin', 'staff_accounts.disable'),
      ('admin', 'staff_accounts.invite')
  );
