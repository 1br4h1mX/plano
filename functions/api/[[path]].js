/**
 * functions/api/[[path]].js — Plano's account API on Cloudflare Pages.
 *
 * Serves the same /api/auth + /api/data contract as the Express server, backed
 * by D1 instead of JSON files. Same-origin on the Pages site, so the client
 * needs no API base config; CORS is open for optional static-host usage.
 */
import {
  HttpError,
  createUser,
  verifyLogin,
  createSession,
  sessionUser,
  deleteSession,
  getData,
  setData,
} from '../lib/store-d1.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'content-type': 'application/json',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });

async function readBody(request) {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === 'object' ? body : {};
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function requireUser(request, db) {
  const token = bearerToken(request);
  const user = token ? await sessionUser(db, token) : null;
  if (!user) throw new HttpError('Please log in again.', 401);
  return { user, token };
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.PLANO_DB;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const path = url.pathname;

    if (path === '/api/health' && request.method === 'GET') {
      return json({ ok: true, aiConfigured: false, accounts: true });
    }

    if (path === '/api/auth/signup' && request.method === 'POST') {
      const { name, email, password } = await readBody(request);
      const user = await createUser(db, { name, email, password });
      const token = await createSession(db, user.id);
      return json({ ok: true, token, user }, 201);
    }

    if (path === '/api/auth/login' && request.method === 'POST') {
      const { email, password } = await readBody(request);
      const user = await verifyLogin(db, { email, password });
      const token = await createSession(db, user.id);
      return json({ ok: true, token, user });
    }

    if (path === '/api/auth/logout' && request.method === 'POST') {
      const token = bearerToken(request);
      if (token) await deleteSession(db, token);
      return json({ ok: true });
    }

    if (path === '/api/auth/me' && request.method === 'GET') {
      const { user } = await requireUser(request, db);
      return json({ ok: true, user });
    }

    if (path === '/api/data') {
      if (request.method === 'GET') {
        const { user } = await requireUser(request, db);
        const snapshot = await getData(db, user.id);
        if (!snapshot) return json({ error: 'No data yet.' }, 404);
        return json({ ok: true, snapshot });
      }
      if (request.method === 'PUT') {
        const { user } = await requireUser(request, db);
        const snapshot = await readBody(request);
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
          return json({ error: 'Invalid snapshot.' }, 400);
        await setData(db, user.id, snapshot);
        return json({ ok: true });
      }
    }

    return json({ error: 'Not found.' }, 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('[plano] error:', err);
    return json({ error: 'Internal server error.' }, 500);
  }
}