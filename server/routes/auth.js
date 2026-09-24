/**
 * auth.js — signup / login / logout / me.
 * Sessions are opaque bearer tokens; the client stores them in localStorage
 * and sends `Authorization: Bearer <token>` on every authenticated request.
 */
import { Router } from 'express';
import { store, AuthError } from '../lib/store.js';

const router = Router();

const fail = (res, err) => res.status(err.status || 400).json({ error: err.message });

router.post('/signup', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const user = store.createUser({ name, email, password });
    const token = store.createSession(user.id);
    res.status(201).json({ ok: true, token, user });
  } catch (err) {
    if (err instanceof AuthError) return fail(res, err);
    throw err;
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = store.verifyLogin(email, password);
    const token = store.createSession(user.id);
    res.json({ ok: true, token, user });
  } catch (err) {
    if (err instanceof AuthError) return fail(res, err);
    throw err;
  }
});

router.post('/logout', requireAuth, (req, res) => {
  store.deleteSession(req.token);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/** Reads `Authorization: Bearer <token>` and attaches req.user / req.token. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? store.getSessionUser(token) : null;
  if (!token || !user) return res.status(401).json({ error: 'Please log in again.' });
  req.user = user;
  req.token = token;
  next();
}

export default router;