/**
 * store.js — JSON-file-backed user + session + data store for Plano accounts.
 *
 * Zero dependencies on purpose: passwords are hashed with Node's built-in
 * crypto.scrypt, sessions are random 32-byte tokens stored server-side, and
 * every account's Plano data lives in one snapshot document.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PLANO_DATA_DIR || path.join(__dirname, '..', 'data');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class JsonFile {
  constructor(name) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.file = path.join(DATA_DIR, name);
  }
  read() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return [];
    }
  }
  write(rows) {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

class Store {
  constructor() {
    this.usersFile = new JsonFile('users.json');
    this.sessionsFile = new JsonFile('sessions.json');
    this.dataFile = new JsonFile('data.json');
  }

  /* ------------------------------ users ------------------------------ */

  createUser({ name = '', email, password }) {
    const e = normalizeEmail(email);
    if (!EMAIL_RE.test(e)) throw new AuthError('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8)
      throw new AuthError('Password must be at least 8 characters.');
    const users = this.usersFile.read();
    if (users.some((u) => u.email === e)) throw new AuthError('An account with this email already exists.', 409);

    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    const user = {
      id: crypto.randomUUID(),
      name: (name || '').trim(),
      email: e,
      pwd: { salt: salt.toString('hex'), hash: hash.toString('hex') },
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    this.usersFile.write(users);
    return this.publicUser(user);
  }

  verifyLogin(email, password) {
    const users = this.usersFile.read();
    const user = users.find((u) => u.email === normalizeEmail(email));
    if (!user) throw new AuthError('No account found with this email.', 401);
    const { salt, hash } = user.pwd;
    const expected = Buffer.from(hash, 'hex');
    const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 64);
    const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!ok) throw new AuthError('Incorrect password.', 401);
    return this.publicUser(user);
  }

  /* ---------------------------- sessions ---------------------------- */

  createSession(userId) {
    const sessions = this.sessionsFile.read();
    const token = crypto.randomBytes(32).toString('hex');
    sessions.push({
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    this.sessionsFile.write(this.prune(sessions));
    return token;
  }

  getSessionUser(token) {
    const sessions = this.sessionsFile.read();
    const session = sessions.find((s) => s.token === token && s.expiresAt > Date.now());
    if (!session) return null;
    const users = this.usersFile.read();
    const user = users.find((u) => u.id === session.userId);
    return user ? this.publicUser(user) : null;
  }

  deleteSession(token) {
    this.sessionsFile.write(this.sessionsFile.read().filter((s) => s.token !== token));
  }

  prune(sessions) {
    const now = Date.now();
    return sessions.filter((s) => s.expiresAt > now);
  }

  /* ------------------------------ data ------------------------------ */

  getData(userId) {
    const rows = this.dataFile.read();
    const row = rows.find((r) => r.userId === userId);
    return row ? row.snapshot : null;
  }

  setData(userId, snapshot) {
    let rows = this.dataFile.read();
    const idx = rows.findIndex((r) => r.userId === userId);
    const record = { userId, snapshot, updatedAt: new Date().toISOString() };
    if (idx >= 0) rows[idx] = record;
    else rows.push(record);
    this.dataFile.write(rows);
  }

  deleteUser(userId) {
    this.usersFile.write(this.usersFile.read().filter((u) => u.id !== userId));
    this.sessionsFile.write(this.sessionsFile.read().filter((s) => s.userId !== userId));
    this.dataFile.write(this.dataFile.read().filter((r) => r.userId !== userId));
  }

  publicUser(user) {
    const { pwd, ...rest } = user;
    return rest;
  }
}

export const store = new Store();