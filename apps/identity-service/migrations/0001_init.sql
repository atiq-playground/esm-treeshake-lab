-- Identity service schema (auth + account). Passwords: PBKDF2-SHA256 "saltHex$hashHex".
-- Opaque tokens: only SHA-256 hashes stored. No MFA in this migration.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')) DEFAULT 'active',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  rvn INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  password_changed_at TEXT NOT NULL,
  last_login_at TEXT,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);

CREATE INDEX users_deleted_at_idx ON users(deleted_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES users(id),
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  family_id TEXT NOT NULL,
  replaced_by_session_id TEXT,
  revoked_at INTEGER,
  ip TEXT,
  user_agent TEXT,
  -- AES-GCM sealed TokenResponse for short concurrent-refresh replay (never plaintext).
  rotation_response_json TEXT,
  rotation_replay_until INTEGER
);

CREATE INDEX sessions_account_id_idx ON sessions(account_id);
CREATE INDEX sessions_family_id_idx ON sessions(family_id);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Append-only. Never UPDATE/DELETE in app code. Never store secrets here.
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);

INSERT INTO roles (id, name, created_at) VALUES
  ('role_user', 'user', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('role_admin', 'admin', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Demo user: demo@example.com / password (PBKDF2-SHA256, 210k iters — see src/lib/password.ts).
INSERT INTO users (
  id, email, display_name, date_of_birth, status, password_hash,
  created_at, updated_at, deleted_at, rvn, email_verified_at,
  password_changed_at, last_login_at, failed_login_count, locked_until
) VALUES (
  '123',
  'demo@example.com',
  'Demo User',
  '1990-01-01',
  'active',
  '01951d27426da8d9e4aad625eaa83f08$2c645c67160f2012cf7c6ee53699cd40522fd25d3aed150257e8363d62993873',
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  NULL,
  1,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  NULL,
  0,
  NULL
);

INSERT INTO user_roles (user_id, role_id, created_at) VALUES
  ('123', 'role_user', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('123', 'role_admin', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
