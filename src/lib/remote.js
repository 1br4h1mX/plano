/**
 * remote.js — the browser client for Plano's account backend.
 *
 * The backend runs on the same origin in production (`npm start`) or is
 * proxied by Vite in dev. It is OPTIONAL: when it cannot be reached the rest
 * of Plano keeps working entirely in localStorage (the db adapter falls back),
 * and every 401 here clears the stored session automatically.
 */
const API_BASE = import.meta.env.VITE_API_BASE || window.PLANO_API_BASE || '';
const SESSION_KEY = 'plano:auth:v1';

/* ------------------------------ session ------------------------------ */
export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
export const hasSession = () => Boolean(getSession()?.token);

async function json(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    err.offline = true;
    err.message = 'Cannot reach the Plano backend. Is the server running?';
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Server error (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function withToken(token, fn) {
  try {
    return await fn(token);
  } catch (err) {
    if (err.status === 401) clearSession();
    throw err;
  }
}

/* ------------------------------- auth -------------------------------- */
async function authFlow(path, payload) {
  const { token, user } = await json(path, { method: 'POST', body: payload });
  setSession({ token, user });
  return user;
}

export const signup = ({ name, email, password }) => authFlow('/api/auth/signup', { name, email, password });
export const login = ({ email, password }) => authFlow('/api/auth/login', { email, password });

export const logout = async () => {
  const session = getSession();
  if (!session) return;
  try {
    await json('/api/auth/logout', { method: 'POST', token: session.token });
  } catch {
    /* backend unreachable — still drop the local session */
  } finally {
    clearSession();
  }
};

// Confirms the stored session is still valid; null (or session cleared) means signed out.
export const me = () =>
  withToken(getSession()?.token, async (token) => {
    if (!token) return null;
    const { user } = await json('/api/auth/me', { token });
    return user;
  });

/* ------------------------------- data -------------------------------- */
// Returns the account snapshot, or null when the account has none yet.
export const loadData = () =>
  withToken(getSession()?.token, async (token) => {
    if (!token) return null;
    try {
      const { snapshot } = await json('/api/data', { token });
      return snapshot ?? null;
    } catch (err) {
      if (err.status === 404) return null; // account exists but has no data yet
      throw err;
    }
  });

export const saveData = (snapshot) =>
  withToken(getSession()?.token, async (token) => {
    if (!token) return false;
    await json('/api/data', { method: 'PUT', token, body: snapshot });
    return true;
  });