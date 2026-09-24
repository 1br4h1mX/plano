/**
 * api.js — thin fetch wrapper for the Plano backend.
 * Every call is network-first: if a backend responds it is used (server-side
 * LLM or the server's local engine). When no backend is reachable (e.g. the
 * static GitHub Pages host), the client instantly falls back to the built-in
 * engine in ./planner.js and ./offlineAI.js, so the AI assistant always works.
 * The API key never lives in the browser.
 */

import { buildPlan } from './planner.js';
import { localChatReply, localReview } from './offlineAI.js';

const BASE = '/api';

async function tryRequest(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false };
  }
}

function offlineSchedule(input, reason) {
  return {
    source: 'local',
    plan: buildPlan(input),
    warnings: [reason],
  };
}

export const api = {
  health: async () => {
    const r = await tryRequest('/health');
    return r.ok ? r.body : { ok: false, reachable: false };
  },

  aiHealth: async () => {
    const r = await tryRequest('/ai/health');
    return r.ok ? r.body : { aiConfigured: false, clientSide: true };
  },

  generateSchedule: async (input) => {
    const r = await tryRequest('/ai/schedule', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
    if (r.ok) return r.body;
    return offlineSchedule(input, 'Running on the built-in planner — works fully in your browser. Connect a backend for the LLM experience.');
  },

  reschedule: async (missedDate, input) => {
    const r = await tryRequest('/ai/reschedule', {
      method: 'POST',
      body: JSON.stringify({ missedDate, input }),
    });
    if (r.ok) return r.body;
    return offlineSchedule(
      { ...(input || {}), missedDate: missedDate || input?.missedDate },
      'Rebuilt on-device by the built-in planner.',
    );
  },

  chat: async (messages, context = []) => {
    const r = await tryRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, context }),
    });
    if (r.ok) return r.body;
    const lastUser = [...(messages || [])].reverse().find((m) => m?.role === 'user');
    return { reply: localChatReply(lastUser?.content || '', context) };
  },

  weeklyReview: async (stats) => {
    const r = await tryRequest('/ai/review', {
      method: 'POST',
      body: JSON.stringify({ stats }),
    });
    if (r.ok) return r.body;
    return { review: localReview(stats) };
  },
};

export { buildPlan };