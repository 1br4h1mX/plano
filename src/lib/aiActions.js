/**
 * aiActions.js — turns a natural-language request into *schedule operations*.
 *
 * Two backends, one contract:
 *   - LLM  : the configured provider gets a snapshot of the schedule + a JSON
 *            operation schema and returns { text, ops }. It is free to invent
 *            a new task ("add 2h of Python") or reference existing ones by id.
 *   - LOCAL: a deterministic rule parser recognizes the common phrasings
 *            (add / move / resize / delete / complete / priority) so the whole
 *            loop still works offline with zero tokens.
 *
 * Whatever is produced is then handed to operations.js, which re-checks
 * conflicts, finds real free slots, and builds the Apply preview.
 */
import { clientComplete, extractJson } from './llm.js';
import { addDays, todayISO } from './dateUtils.js';
import { findTask, clampDuration, findSlot } from './operations.js';
import { localChatReply } from './offlineAI.js';

const OPS_SYSTEM_PROMPT = `You are "Plano", the AI planning copilot inside a productivity app. You can now ACT on the user's schedule, not just talk about it.

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
/* LLM path                                                            */
/* ------------------------------------------------------------------ */

const ALLOWED_OPS = new Set(['schedule', 'unschedule', 'delete', 'complete', 'priority', 'deadline']);
const OP_ALIASES = {
  create: 'schedule', add: 'schedule', book: 'schedule',
  remove: 'unschedule', clear: 'unschedule',
  done: 'complete', finish: 'complete', mark_done: 'complete', completed: 'complete',
};

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));

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

/**
 * Request operations from the user's own LLM key.
 * Throws on network/parse failure so the caller can fall back to the parser.
 * NOTE: provider/model are filled in by aiClient.resolveAction.
 */
export async function llmOps({ query, tasks, settings, provider, apiKey, model }) {
  const snapshot = scheduleSnapshot({ tasks, settings });
  const user = `SCHEDULE SNAPSHOT:\n${snapshot}\n\nUSER REQUEST: ${query}`;
  const raw = await clientComplete({
    provider,
    apiKey,
    model,
    system: OPS_SYSTEM_PROMPT,
    user,
    maxTokens: 1000,
  });
  const parsed = extractJson(raw);
  return {
    text: typeof parsed?.text === 'string' ? parsed.text : '',
    ops: normalizeOps(parsed?.ops) || [],
  };
}

/* ------------------------------------------------------------------ */
/* Offline rule parser                                                 */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DAY_RE = /\b((?:next|this|last)\s+)?(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const DEADLINE_RE = /\b(?:before|by|ahead\s+of)\s+((?:this|next|last)\s+)?(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today|this\s+week|next\s+week|weekend)\b/i;

/** Resolve a deadline phrase ("by friday", "before next week"…) to a date, or null. */
function resolveDeadline(lower) {
  const m = lower.match(DEADLINE_RE);
  if (!m) return null;
  const phrase = `${m[1] || ''}${m[2]}`;
  const date = resolveDate(phrase) || (/\b(tomorrow)\b/.test(phrase) ? addDays(todayISO(), 1) : null);
  return date;
}

const fullName = (name) => {
  const i = WEEKDAYS_SHORT.indexOf(name.toLowerCase());
  return i >= 0 ? WEEKDAYS[i] : name.toLowerCase();
};

/** Resolves a day mention ("today", "tomorrow", "this tuesday", "next week"…) to a date. */
function resolveDate(lower) {
  const today = todayISO();
  if (/\b(today|tonight)\b/.test(lower)) return addDays(today, 0);
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  /* "this/next week" without a weekday -> let the resolver pick the first free slot */
  const dw = lower.match(DAY_RE);
  if (dw) {
    const idx = WEEKDAYS.indexOf(fullName(dw[2]));
    const now = new Date(`${today}T12:00:00`);
    let delta = (idx - now.getDay() + 7) % 7;
    const q = (dw[1] || '').trim().toLowerCase();
    if (q === 'next') delta = delta === 0 ? 7 : delta + 7;
    else if (q !== 'this' && delta === 0) delta = 7; // a bare weekday on the same day means next week
    return addDays(today, delta);
  }
  return null;
}

function removeDayWords(s) {
  return s
    .replace(DAY_RE, ' ')
    .replace(/\b(this week|next week|this weekend|this week|weekend)\b/gi, ' ')
    .replace(/\b(today|tonight|tomorrow)\b/gi, ' ');
}

function parseTime(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const suffix = m[3] ? String(m[3]).toLowerCase() : null;
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const DUR_RE = /(?:for\s+|of\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi;
const DUR_RE_CAP = /(?:for\s+|of\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;

function extractDuration(lower) {
  const m = lower.match(DUR_RE_CAP);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const minutes = /^h$/i.test(unit) || /hours?|hrs?/i.test(unit) ? n * 60 : n;
  return clampDuration(minutes);
}

function endAfter(start, duration) {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.round(duration);
  const H = Math.floor(total / 60);
  const M = total % 60;
  if (H > 23) return '23:59';
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
}

/** Extract a clean task title out of the verb-remainder by removing time/date tokens. */
function cleanTitle(src) {
  return String(src || '')
    .replace(removeLeader, ' ')
    .replace(DUR_RE, ' ')
    .replace(DEADLINE_RE, ' ')
    .replace(/from\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, ' ')
    .replace(/(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, ' ')
    .replace(/\b(next|this|last)\s+(?:on\s+)?(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
    .replace(/\b(on|this|next|last)\s+(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
    .replace(/\b(this week|next week|this weekend|weekend|today|tonight|tomorrow)\b/gi, ' ')
    .replace(/^\s*(a|an|the|of|for|some|a little|a bit)\s+/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/["'.,!?]+$/g, '');
}

const removeLeader = /^(add|schedule|create|book|put|block|plan|set up|find time for|find|grab|make room for|give me|get me|make me|set|could you|could|please|let's|lets)\s+/i;

function localContextText(query, { tasks, settings }) {
  const lines = [];
  lines.push(`Today's date: ${todayISO()}.`);
  const pending = (tasks || []).filter((t) => !t.completed);
  if (pending.length) lines.push(`Pending tasks: ${pending.slice(0, 8).map((t) => `"${t.title}" (p${t.priority})`).join(', ')}${pending.length > 8 ? ', …' : ''}`);
  if (settings?.workingHours) lines.push(`Working hours ${settings.workingHours.start}\u2013${settings.workingHours.end}.`);
  return localChatReply(query, lines);
}

function shortDateLabel(date) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${names[dt.getDay()]} ${months[dt.getMonth()]} ${d}`;
}

/**
 * Deterministic intent parser. Returns { text, ops } where ops are raw ops
 * (to be resolved by operations.resolveOps) or [] when it was a question.
 */
export function offlineOps(query, { tasks = [], settings = {} }) {
  const original = String(query || '').trim();
  const lower = original.toLowerCase();
  const ops = [];
  const text = (lit) => ({ text: lit, ops });
  const miss = () => text(localContextText(original, { tasks, settings }));

  // ---- priority -----------------------------------------------------
  const prio = lower.match(/(?:make|set|change|mark)\s+(?:the\s+)?["']?([^"']+?)["']?\s+(urgent|top|highest|high|medium\s*low|medium|normal|low)\s+priority/);
  if (prio) {
    const task = findTask(tasks, null, prio[1]);
    if (task) ops.push({ op: 'priority', taskId: task.id, priority: /urgent|top|highest|high/.test(prio[2]) ? 1 : /medium|normal/.test(prio[2]) ? 2 : 4 });
    return ops.length ? text('I\u2019ll adjust that task\u2019s priority for you.') : miss();
  }
  const prio2 = lower.match(/priorit(?:ize|ise)\s+(?:the\s+)?["']?([^"']+?)["']?\s*$/);
  if (prio2) {
    const task = findTask(tasks, null, prio2[1]);
    if (task) ops.push({ op: 'priority', taskId: task.id, priority: 1 });
    return ops.length ? text('Marked it as your top priority.') : miss();
  }

  // ---- complete -----------------------------------------------------
  const done = lower.match(/(?:mark\s+)?["']?([^"']+?)["']?\s+(?:as\s+)?(done|finished|complete|completed)\b\s*$/);
  if (done) {
    const task = findTask(tasks, null, done[1]);
    if (task) ops.push({ op: 'complete', taskId: task.id });
    return ops.length ? text('Done \u2014 marked as complete.') : miss();
  }
  const done2 = lower.match(/\b(?:complete|finish)\s+(?:the\s+)?["']?([^"']+?)["']?\s*$/);
  if (done2 && !/(complete|finish)\s+(my|the)\s+(day|week|plan|schedule|review)\b/.test(lower)) {
    const task = findTask(tasks, null, done2[1]);
    if (task) ops.push({ op: 'complete', taskId: task.id });
    return ops.length ? text('Done \u2014 marked as complete.') : miss();
  }

  // ---- delete -------------------------------------------------------
  const del = lower.match(/\b(?:delete|drop)\s+(?:the\s+)?["']?([^"']+?)["']?\s*$/);
  if (del) {
    const task = findTask(tasks, null, del[1]);
    if (task) ops.push({ op: 'delete', taskId: task.id });
    return ops.length ? text('Removed it.') : miss();
  }

  // ---- cancel -> unschedule (drop from calendar, keep the task) -----
  const cancel = lower.match(/\b(?:cancel|skip)\s+(?:the\s+)?["']?([^"']+?)["']?\s*(?:for\s+)?(?:today|tomorrow|tonight|this|next|last)?\s*$/i);
  if (cancel) {
    const task = findTask(tasks, null, cancel[1]);
    if (task?.scheduledStart) ops.push({ op: 'unschedule', taskId: task.id });
    return ops.length ? text('Cancelled \u2014 removed it from the calendar, the task is still saved.') : miss();
  }

  // ---- unschedule (calendar only) -----------------------------------
  const unsch = lower.match(/remove\s+(?:the\s+)?["']?([^"']+?)["']?\s+from\s+(?:the\s+)?calendar/);
  if (unsch) {
    const task = findTask(tasks, null, unsch[1]);
    if (task) ops.push({ op: 'unschedule', taskId: task.id });
    return ops.length ? text('Cleared it from the calendar \u2014 the task is still saved.') : miss();
  }

  // ---- next free slot ---------------------------------------------
  const nfs = lower.match(/\b(?:move|reschedule|shift|schedule|put|find)\s+(?:the\s+)?["']?([^"']+?)["']?\s+(?:to|in|into)\s+(?:my\s+|the\s+|your\s+)?(?:next|first|earliest|nearest)\s+(?:free|open|available)\s+slot\b/);
  if (nfs) {
    const task = findTask(tasks, null, nfs[1]);
    if (task?.scheduledStart || task) {
      ops.push({ op: 'schedule', taskId: task.id });
      return text('I\u2019ll put it in your next genuinely free slot.');
    }
    return miss();
  }

  // ---- move ---------------------------------------------------------
  const move = lower.match(/\b(?:move|reschedule|shift|push|schedule)\s+(?:the\s+)?["']?([^"']+?)["']?\s+to\s+(.+)$/);
  if (move && DAY_RE.test(move[2]) || (move && /\b(today|tomorrow|this|next)\b/.test(move[2]))) {
    const task = findTask(tasks, null, move[1]);
    if (task) {
      const where = move[2].toLowerCase();
      const date = resolveDate(where);
      const fromTo = where.match(/from\s+(.+?)\s+(?:to|-)\s+(.+)/i);
      const at = where.match(/(?:at|@)\s+(.+)/i);
      const op = { op: 'schedule', taskId: task.id };
      if (date) op.date = date;
      if (fromTo) {
        const s = parseTime(fromTo[1]);
        const e = parseTime(fromTo[2]);
        if (s) op.start = s;
        if (e) op.end = e;
      } else if (at) {
        const s = parseTime(at[1]);
        if (s) {
          op.start = s;
          op.end = endAfter(s, task.estimatedMinutes || 30);
        }
      }
      ops.push(op);
      return text(`I\u2019ll move that to a free slot${date ? ` on ${shortDateLabel(date)}` : ''}.`);
    }
    return miss();
  }

  // ---- resize -------------------------------------------------------
  const resizeTo = lower.match(/(?:make|set)\s+(?:the\s+)?["']?([^"']+?)["']?\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?!\s*of)/);
  const resizeBy = lower.match(/(extend|shorten)\s+(?:the\s+)?["']?([^"']+?)["']?\s+by\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|h|hrs?)/);
  if (resizeTo || resizeBy) {
    const m = resizeTo ? resizeTo : resizeBy;
    const title = resizeTo ? m[1] : m[2];
    const task = findTask(tasks, null, title);
    if (task) {
      const n = Number(resizeTo ? m[2] : m[3]);
      const unit = resizeTo ? m[3] : m[4];
      const deltaMin = /hours?|hrs?|h/.test(unit) ? n * 60 : n;
      const duration = resizeTo
        ? clampDuration(deltaMin)
        : clampDuration((task.estimatedMinutes || 30) + (/extend/.test(m[0]) ? deltaMin : -deltaMin));
      if (task.scheduledStart) {
        ops.push({
          op: 'schedule',
          taskId: task.id,
          date: String(task.scheduledStart).slice(0, 10),
          start: task.scheduledStart.slice(11, 16),
          end: endAfter(task.scheduledStart.slice(11, 16), duration),
        });
      } else {
        ops.push({ op: 'schedule', taskId: task.id, durationMinutes: duration });
      }
      return text('Resized it on the calendar.');
    }
    return miss();
  }

  // ---- make <day> less busy ---------------------------------------
  const lb = lower.match(/\b(?:make|keep|get)\s+(.+?)\s+less busy\b|\bless busy\s+(today|tomorrow|tonight|(?:this|next)\s+(?:mon|tue|wed|thu|fri|sat|sun)|(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?)/);
  if (lb) {
    const phrase = (lb[1] || lb[2] || '').trim();
    const date = resolveDate(phrase) || (/\btomorrow\b/.test(phrase) ? addDays(todayISO(), 1) : null);
    if (date) {
      const dayTasks = (tasks || [])
        .filter((t) => t.scheduledStart && !t.completed && String(t.scheduledStart).slice(0, 10) === date && (t.priority || 2) >= 3)
        .sort((a, b) => (b.priority || 2) - (a.priority || 2) || (a.estimatedMinutes || 30) - (b.estimatedMinutes || 30));
      const movable = dayTasks.slice(0, 2);
      for (const t of movable) {
        const slot = findSlot({
          tasks,
          settings,
          durationMinutes: t.estimatedMinutes || 30,
          startDate: addDays(date, 1),
          excludeTaskIds: [t.id],
          windowDays: 7,
        });
        if (slot) {
          ops.push({ op: 'schedule', taskId: t.id, date: slot.date, start: slot.start, end: slot.end });
        }
      }
      if (ops.length) {
        return text(`Found a calmer plan for ${shortDateLabel(date)} \u2014 I\u2019ll move the least-important tasks to free slots.`);
      }
      return miss();
    }
  }

  // ---- organize around a focus ------------------------------------
  const org = lower.match(/\b(?:organi[sz]e|plan|arrange)\s+(?:my\s+|your\s+|the\s+)?(?:week|schedule|calendar|day)?\s*(?:around|based on)\s+(?:my\s+|your\s+|the\s+)?(.+)$/);
  if (org) {
    const topic = String(org[1]).replace(/["']/g, '').trim().toLowerCase();
    const words = topic.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter((w) => w.length > 3);
    const needles = [...new Set([...(words || []), ...(words || []).map((w) => (w.endsWith('s') ? w.slice(0, -1) : w))])];
    const open = (tasks || []).filter((t) => !t.completed && !t.scheduledStart);
    let matches = needles.length
      ? open.filter((t) => (needles || []).some((n) => (t.title || '').toLowerCase().includes(n) || (t.notes || '').toLowerCase().includes(n)))
      : [];
    if (!matches.length) matches = open.filter((t) => t.deadline); // focus without a direct match -> anything with a deadline
    matches
      .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
      .slice(0, 3)
      .forEach((t) => {
        ops.push({ op: 'schedule', taskId: t.id, before: t.deadline, durationMinutes: clampDuration(t.estimatedMinutes || 30) });
      });
    if (ops.length) return text(`I\u2019ll fit those around your ${topic} before their deadlines.`);
    return miss();
  }

  // ---- create / schedule -------------------------------------------
  const created = original.match(/\b(?:add|schedule|create|book|put|block|plan|set up|find time for|grab|make room for|give me|get me|make me)\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (created) {
    const day = resolveDate(lower);
    const fromTo = lower.match(/from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const at = lower.match(/(?:at|@)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

    const title = cleanTitle(created[1]);
    if (!title) return miss();

    const duration = extractDuration(lower);
    const deadline = resolveDeadline(lower);
    const existing = findTask(tasks, null, title);
    const op = { op: 'schedule' };
    if (existing) op.taskId = existing.id;
    else op.title = title;
    if (duration) op.durationMinutes = duration;
    if (day) op.date = day;
    if (deadline) {
      op.deadline = deadline;
      // A deadline with no explicit day means "fit it in *before* then".
      if (!day) op.before = deadline;
    }
    if (fromTo) {
      op.start = parseTime(fromTo[1]);
      op.end = parseTime(fromTo[2]);
    } else if (at) {
      const s = parseTime(at[1]);
      if (s) {
        op.start = s;
        op.end = endAfter(s, duration || existing?.estimatedMinutes || 30);
      }
    }
    ops.push(op);
    return text('I checked your calendar and found a spot. Here\u2019s what I propose:');
  }

  // ---- plain question ----------------------------------------------
  return miss();
}