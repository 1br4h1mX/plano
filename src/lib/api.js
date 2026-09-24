/**
 * api.js — thin fetch wrapper for the Plano backend.
 * The API key never lives in the browser; all AI calls hit the Express server.
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  aiHealth: () => request('/ai/health'),

  generateSchedule: (input) =>
    request('/ai/schedule', { method: 'POST', body: JSON.stringify({ input }) }),

  reschedule: (missedDate, input) =>
    request('/ai/reschedule', { method: 'POST', body: JSON.stringify({ missedDate, input }) }),

  chat: (messages, context = []) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, context }) }),

  weeklyReview: (stats) =>
    request('/ai/review', { method: 'POST', body: JSON.stringify({ stats }) }),
};