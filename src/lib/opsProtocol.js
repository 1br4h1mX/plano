/**
 * opsProtocol.js — the shared contract between the AI and the operation layer.
 *
 * This module is intentionally dependency-light (date math + clamping only) so
 * it can be imported by BOTH:
 *   - the browser client (aiActions.js) and
 *   - the server-side LLM backends (Cloudflare Pages function + Express),
 *
 * guaranteeing the LLM's JSON output is validated exactly the same everywhere:
 * unknown op names are dropped/aliased, insane times and dates are discarded,
 * and every `schedule` op must name a target (taskId or title). The LLM request
 * therefore never reaches room to create junk — whatever pipe it came through.
 */
import { todayISO, addDays } from './dateUtils.js';
import { clampDuration } from './operations.js';

export const OPS_SYSTEM_PROMPT = `You are "Plano", the AI planning copilot inside a productivity app. You can now ACT on the user's schedule, not just talk about it.

You are given a snapshot of the user's calendar (fixed commitments, scheduled tasks, unscheduled tasks) and a request. Decide whether the request asks you to CHANGE the schedule.

If it does, return STRICT JSON ONLY (no markdown, no fences) matching exactly:

{
  "text": "1-2 sentence reply to the user summarising what you propose or answering their question.",
  "ops": [
    {
      "op": "schedule",
      "taskId": "an existing task id from the snapshot (omit if creating a new task)",
      "title": "task title (required when creating a new task)",
      "date": "YYYY-MM-DD (optional - omit to let the app find the first free slot)",
      "start": "HH:MM 24h (optional)",
      "end": "HH:MM 24h (optional)",
      "durationMinutes": 120,
      "priority": 2,
      "deadline": "YYYY-MM-DD (optional)"
    }
  ]
}

OTHER OPERATIONS:
- "unschedule" { "op": "unschedule", "taskId" } — remove task from the calendar, keep the task
- "delete"    { "op": "delete", "taskId" } — delete the task entirely
- "complete"  { "op": "complete", "taskId" } — mark completed
- "priority"  { "op": "priority", "taskId", "priority": 1-4 } — change Eisenhower priority (1 urgent+important, 2 important, 3 urgent, 4 optional)
- "deadline"  { "op": "deadline", "taskId", "deadline": "YYYY-MM-DD" } — change the deadline
- A "resize" is expressed as a "schedule" op with the SAME date+start but a new "end" or "durationMinutes"

RULES:
- Use the taskId from the snapshot whenever the user means an existing task. Use title only for brand-new tasks.
- "Move" / "reschedule" / "find time for X" = a "schedule" op (optionally with the target date/start/end; omitting them lets the app pick the first free slot).
- When you choose a concrete time, respect working hours and commitments in the snapshot. If the requested slot is busy, shift it — the app verifies anyway.
- Prefer the first free fitting slot before moving existing tasks around.
- If the user is only asking a question or chatting (no schedule change requested), return "ops": [] and answer in "text".
- Never invent field names outside the schema above. Never use "op" values outside the list.`;

/* ------------------------------------------------------------------ */
/* Schedule snapshot for the LLM                                       */
/* ------------------------------------------------------------------ */

const DAY_N = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];

export function scheduleSnapshot({ tasks, settings }) {
  const lines = [];
  lines.push(`Today's date: ${todayISO()}.`);
  const workDays = settings?.workDays?.length ? settings.workDays : [1, 2, 3, 4, 5];
  lines.push(`Working hours: ${settings?.workingHours?.start || '09:00'}\u2013${settings?.workingHours?.end || '18:00'}, workdays: [${workDays.map(DAY_N).join(', ')}].`);

  const commitments = (settings?.commitments || []).map((c) => `${c.title} on ${c.days?.length ? c.days.map(DAY_N).join(',') : 'all days'} ${c.start}\u2013${c.end}`);
  lines.push(commitments.length ? `Fixed commitments:\n${commitments.map((c) => `- ${c}`).join('\n')}` : 'Fixed commitments: none');

  const scheduled = (tasks || []).filter((t) => t.scheduledStart && !t.completed);
  lines.push(scheduled.length
    ? `Scheduled tasks:\n${scheduled.map((t) => `- "${t.title}" ${String(t.scheduledStart).slice(0, 10)} ${t.scheduledStart.slice(11, 16)}\u2013${t.scheduledEnd?.slice(11, 16)} (id: ${t.id})`).join('\n')}`
    : 'Scheduled tasks: none');

  const open = (tasks || []).filter((t) => !t.scheduledStart && !t.completed);
  lines.push(open.length
    ? `Unscheduled open tasks:\n${open.map((t) => `- "${t.title}" (priority ${t.priority}, ~${t.estimatedMinutes || 30} min${t.deadline ? `, deadline ${t.deadline}` : ''}, id: ${t.id})`).join('\n')}`
    : 'Unscheduled open tasks: none');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Op validation                                                       */
/* ------------------------------------------------------------------ */

const ALLOWED_OPS = new Set(['schedule', 'unschedule', 'delete', 'complete', 'priority', 'deadline']);
const OP_ALIASES = {
  create: 'schedule', add: 'schedule', book: 'schedule',
  remove: 'unschedule', clear: 'unschedule',
  done: 'complete', finish: 'complete', mark_done: 'complete', completed: 'complete',
};

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));

/** Coerce raw LLM ops into a strictly-typed op list. Invalid entries are dropped. */
export function normalizeOps(rawOps) {
  if (!Array.isArray(rawOps)) return [];
  const out = [];
  for (const raw of rawOps || []) {
    if (!raw || typeof raw !== 'object') continue;
    let op = String(raw.op || '').toLowerCase().replace(/\s+/g, '_');
    if (!ALLOWED_OPS.has(op)) op = OP_ALIASES[op];
    if (!op || !ALLOWED_OPS.has(op)) continue;
    const clean = { op };
    if (raw.taskId) clean.taskId = String(raw.taskId);
    if (raw.title) clean.title = String(raw.title).trim().slice(0, 120);
    if (raw.date && /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date))) clean.date = String(raw.date);
    if (raw.start && /^(([01]?\d|2[0-3]):[0-5]\d)$/.test(String(raw.start))) clean.start = String(raw.start);
    if (raw.end && /^(([01]?\d|2[0-3]):[0-5]\d)$/.test(String(raw.end))) clean.end = String(raw.end);
    const d = num(raw.durationMinutes);
    if (d) clean.durationMinutes = clampDuration(d);
    const p = num(raw.priority);
    if (p) clean.priority = Math.min(4, Math.max(1, Math.round(p)));
    if (raw.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(raw.deadline))) clean.deadline = String(raw.deadline);
    if (raw.notes) clean.notes = String(raw.notes).slice(0, 300);
    if (raw.category) clean.category = String(raw.category).slice(0, 60);
    if (clean.op === 'schedule' && !clean.taskId && !clean.title) continue; // a schedule must target something
    out.push(clean);
  }
  return out;
}

export { addDays, todayISO };