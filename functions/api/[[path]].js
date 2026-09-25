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
import { OPS_SYSTEM_PROMPT, scheduleSnapshot, normalizeOps } from '../../src/lib/opsProtocol.js';

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
      return json({ ok: true, aiConfigured: Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY), accounts: true });
    }

    if (path === '/api/ai/health' && request.method === 'GET') {
      return json({ ok: true, aiConfigured: Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY), clientSide: false });
    }

    if (path === '/api/ai/ops' && request.method === 'POST') {
      const { query, tasks, settings, subject } = await readBody(request);
      const geminiKey = env.GEMINI_API_KEY;
      const openaiKey = !geminiKey ? env.OPENAI_API_KEY : null;
      if (!geminiKey && !openaiKey) return json({ error: 'No LLM configured.' }, 503);

      let user = `SCHEDULE SNAPSHOT:\n${scheduleSnapshot({ tasks, settings })}\n\nUSER REQUEST: ${String(query || '')}`;
      if (subject) user += `\n\nCONTEXT: This continues a conversation. The task or activity the user was last talking about is "${subject}". Resolve pronouns ("it", "that", "this") against it.`;
      const raw = geminiKey
        ? await callGemini(geminiKey, env.GEMINI_MODEL, { system: OPS_SYSTEM_PROMPT, user, maxTokens: 1200 })
        : await callOpenAI(openaiKey, { system: OPS_SYSTEM_PROMPT, user, maxTokens: 1200 });
      const parsed = extractOpsJson(raw);
      return json({
        text: typeof parsed?.text === 'string' ? parsed.text : '',
        ops: normalizeOps(parsed?.ops),
      });
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

/* ------------------------------------------------------------------ */
/* LLM passthrough (ops endpoint) — key comes from env only.           */
/* ------------------------------------------------------------------ */

async function callGemini(key, model, { system, user, maxTokens }) {
  const m = model || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') || '';
}

async function callOpenAI(key, { system, user, maxTokens }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await safeText(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Robustly extract a JSON object from an LLM response (fences + prose allowed). */
function extractOpsJson(text) {
  if (!text) throw new Error('Empty response from LLM');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM did not return valid JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function safeText(res) {
  try {
    const t = await res.text();
    return t.length > 300 ? `${t.slice(0, 300)}…` : t;
  } catch {
    return 'unknown error';
  }
}