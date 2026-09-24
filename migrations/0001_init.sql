-- Plano accounts — Cloudflare D1 schema.
-- Users are indexed by (normalized lowercase) email; sessions store the
-- SHA-256 of the bearer token; each account owns one JSON snapshot.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL UNIQUE,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS data (
  user_id    TEXT PRIMARY KEY,
  snapshot   TEXT NOT NULL,
  updated_at TEXT NOT NULL
);