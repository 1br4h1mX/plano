/**
 * store-d1.js — Plano account store for Cloudflare D1.
 *
 * Port of server/lib/store.js to the Workers runtime: passwords use the same
 * Node crypto (with nodejs_compat) scrypt hashing, sessions are opaque bearer
 * tokens stored as their SHA-256, and each account owns one JSON snapshot doc.
 */
import crypto from 'node:crypto';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

export async function createUser(db, { name = '', email, password }) {
  const e = normalizeEmail(email);
  if (!EMAIL_RE.test(e)) throw new HttpError('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 8)
    throw new HttpError('Password must be at least 8 characters.');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(e).first();
  if (existing) throw new HttpError('An account with this email already exists.', 409);

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  const user = {
    id: crypto.randomUUID(),
    name: (name || '').trim(),
    email: e,
    createdAt: now(),
  };
  await db
    .prepare('INSERT INTO users (id, name, email, salt, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(user.id, user.name, e, salt.toString('hex'), hash.toString('hex'), user.createdAt)
    .run();
  return user;
}

export async function verifyLogin(db, { email, password }) {
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(normalizeEmail(email))
    .first();
  if (!user) throw new HttpError('No account found with this email.', 401);

  const expected = Buffer.from(user.hash, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(user.salt, 'hex'), 64);
  const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!ok) throw new HttpError('Incorrect password.', 401);

  return publicUser(user);
}

export async function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db
    .prepare('INSERT OR REPLACE INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sha256(token), userId, now(), Date.now() + SESSION_TTL_MS)
    .run();
  return token;
}

export async function sessionUser(db, token) {
  const row = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .bind(sha256(token))
    .first();
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    await deleteSession(db, token);
    return null;
  }
  return publicUser(row);
}

export async function deleteSession(db, token) {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(sha256(token)).run();
}

export async function getData(db, userId) {
  const row = await db.prepare('SELECT snapshot FROM data WHERE user_id = ?').bind(userId).first();
  return row ? JSON.parse(row.snapshot) : null;
}

export async function setData(db, userId, snapshot) {
  await db
    .prepare(
      `INSERT INTO data (user_id, snapshot, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
    )
    .bind(userId, JSON.stringify(snapshot), now())
    .run();
}

function publicUser(user) {
  const { salt, hash, token_hash, user_id, expires_at, ...rest } = user;
  return rest;
}