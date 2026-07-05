import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Base schema PMH ID (E0-S5) — dựng đủ bảng theo addendum. Các epic sau chỉ
 * ALTER/thêm index, không sửa migration này. UUID dùng gen_random_uuid()
 * (core từ PG13). Trạng thái enum bằng CHECK để tránh migrate enum về sau.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
  -- ============ USERS (soft-delete, break-glass) ============
  CREATE TABLE users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 text NOT NULL,
    employee_code         text NOT NULL,
    full_name             text NOT NULL,
    password_hash         text,
    status                text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','locked','disabled')),
    must_change_password  boolean NOT NULL DEFAULT false,
    password_updated_at   timestamptz,
    temp_password_expires_at timestamptz,
    expires_at            timestamptz,               -- auto-lock (FR-18)
    is_breakglass         boolean NOT NULL DEFAULT false,
    deleted_at            timestamptz,               -- soft-delete (FR-17)
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
  );
  -- UNIQUE toàn bảng (kể cả bản soft-deleted) để reactivate giữ định danh
  CREATE UNIQUE INDEX users_email_key ON users (lower(email));
  CREATE UNIQUE INDEX users_employee_code_key ON users (employee_code);
  CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;

  -- ============ GROUPS ============
  CREATE TABLE groups (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE user_groups (
    user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, group_id)
  );

  -- ============ PROJECTS / CLIENTS ============
  CREATE TABLE projects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE clients (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    client_id         text NOT NULL UNIQUE,
    name              text NOT NULL,
    env               text NOT NULL CHECK (env IN ('dev','prod')),
    redirect_uris     text[] NOT NULL DEFAULT '{}',
    app_url           text,
    allow_all_groups  boolean NOT NULL DEFAULT false,
    disabled          boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX clients_project_idx ON clients (project_id);

  CREATE TABLE client_secrets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    secret_hash text NOT NULL,
    status      text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','retiring','revoked')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    retiring_at timestamptz,
    expires_at  timestamptz,        -- hạn ân hạn khi rotate (AD-12)
    revoked_at  timestamptz
  );
  CREATE INDEX client_secrets_client_idx ON client_secrets (client_id);

  -- client_groups = NGUỒN quyền đăng nhập (AD-11)
  CREATE TABLE client_groups (
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    group_id  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (client_id, group_id)
  );

  -- ============ ADMIN (SSA / project_admin) ============
  CREATE TABLE admin_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    text NOT NULL CHECK (role IN ('ssa','project_admin')),
    PRIMARY KEY (user_id, role)
  );

  CREATE TABLE admin_projects (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, project_id)
  );

  -- ============ MFA (TOTP cho SSA) ============
  CREATE TABLE mfa_totp (
    user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    totp_secret_enc  bytea NOT NULL,   -- mã hóa bằng KEK (AD-15)
    enabled          boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE mfa_recovery (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    used_at   timestamptz
  );
  CREATE INDEX mfa_recovery_user_idx ON mfa_recovery (user_id);

  -- ============ SESSIONS (projection từ oidc_payloads — AD-7) ============
  CREATE TABLE sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    oidc_session_uid text,               -- nối về nguồn sự thật oidc_payloads
    auth_time        timestamptz NOT NULL,
    last_activity    timestamptz NOT NULL DEFAULT now(),
    ip               inet,
    user_agent       text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    revoked_at       timestamptz
  );
  CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
  CREATE INDEX sessions_oidc_uid_idx ON sessions (oidc_session_uid);

  -- ============ LOGIN ATTEMPTS (chống dò — AD-9) ============
  CREATE TABLE login_attempts (
    id         bigserial PRIMARY KEY,
    identifier text NOT NULL,          -- email/username thử
    client_id  text,                   -- phủ cả /oidc/token (brute secret)
    ip         inet,
    success    boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX login_attempts_ident_idx ON login_attempts (identifier, created_at);
  CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at);

  -- ============ OIDC PAYLOADS (NGUỒN sự thật token/grant/session — AD-6) ==
  CREATE TABLE oidc_payloads (
    id          text NOT NULL,
    type        text NOT NULL,          -- Session, AccessToken, Grant...
    payload     jsonb NOT NULL,
    grant_id    text,
    user_code   text,
    uid         text,
    client_id   text,
    expires_at  timestamptz,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (type, id)
  );
  CREATE INDEX oidc_payloads_grant_idx ON oidc_payloads (grant_id);
  CREATE INDEX oidc_payloads_uid_idx ON oidc_payloads (uid);
  CREATE INDEX oidc_payloads_user_code_idx ON oidc_payloads (user_code);
  CREATE INDEX oidc_payloads_client_idx ON oidc_payloads (client_id);
  CREATE INDEX oidc_payloads_expires_idx ON oidc_payloads (expires_at);

  -- ============ AUDIT (scope theo project_id — FR-30) ============
  CREATE TABLE audit_logs (
    id            bigserial PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action        text NOT NULL,
    target_type   text,
    target_id     text,
    project_id    uuid REFERENCES projects(id) ON DELETE SET NULL, -- NULL=toàn cục
    ip            inet,
    detail        jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX audit_logs_project_idx ON audit_logs (project_id, created_at);
  CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, created_at);

  -- ============ USER EVENTS (feed Directory — FR-27) ============
  CREATE TABLE user_events (
    seq        bigserial PRIMARY KEY,   -- con tro since cho project ngoai
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    detail     jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX user_events_user_idx ON user_events (user_id);

  -- ============ EMAIL QUEUE (Postgres queue — AD-13) ============
  CREATE TABLE email_queue (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    to_addr    text NOT NULL,
    subject    text NOT NULL,
    body_html  text NOT NULL,
    status     text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sending','sent','failed')),
    attempts   int NOT NULL DEFAULT 0,
    locked_at  timestamptz,             -- claim qua SKIP LOCKED
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at    timestamptz
  );
  CREATE INDEX email_queue_pending_idx ON email_queue (status, created_at)
    WHERE status = 'pending';

  -- ============ WEBHOOK DELIVERIES (queue + retry — AD-14) ============
  CREATE TABLE webhook_deliveries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
    project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
    event           text NOT NULL,
    payload         jsonb NOT NULL,
    target_url      text NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','sending','delivered','failed')),
    attempts        int NOT NULL DEFAULT 0,
    locked_at       timestamptz,
    next_attempt_at timestamptz,
    last_error      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    delivered_at    timestamptz
  );
  CREATE INDEX webhook_deliveries_pending_idx
    ON webhook_deliveries (status, next_attempt_at)
    WHERE status IN ('pending','failed');

  -- ============ SETTINGS (tham số vận hành runtime — AD-15) ============
  CREATE TABLE settings (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  `);

  // Seed tham số vận hành mặc định (SSA chỉnh sau qua Settings — E6-S5)
  pgm.sql(`
  INSERT INTO settings (key, value) VALUES
    ('access_token_ttl_seconds', '300'),
    ('session_idle_seconds', '900'),
    ('session_absolute_cap_seconds', '43200'),
    ('password_min_length', '8'),
    ('password_max_age_days', '90'),
    ('temp_password_ttl_hours', '24'),
    ('client_secret_grace_hours', '48'),
    ('bruteforce_account_threshold', '5'),
    ('bruteforce_backoff_seconds', '900'),
    ('smtp_host', 'mailpit'),
    ('smtp_port', '1025'),
    ('backup_path', '/backups')
  ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS
      webhook_deliveries, email_queue, user_events, audit_logs,
      oidc_payloads, login_attempts, sessions, mfa_recovery, mfa_totp,
      admin_projects, admin_roles, client_groups, client_secrets, clients,
      projects, user_groups, groups, users, settings
    CASCADE;
  `);
}
