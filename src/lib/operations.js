/**
 * operations.js — the deterministic operation layer that lets the AI actually
 * change the user's schedule.
 *
 * The LLM (or the built-in parser) never touches the data store directly. It
 * returns a list of *operations*; this module resolves them into concrete time
 * slots (checking conflicts and finding free time), renders a human-readable
 * preview, and applies them to the task list as one atomic snapshot so the UI
 * can offer Apply / Cancel / Undo.
 */
import {
  toMinutes,
  fromMinutes,
  addDays,
  dateLabel,
  hhmmTo12,
  todayISO,
} from './dateUtils.js';

export const toMin = toMinutes;
export const fromMin = fromMinutes;

const MIN_DURATION = 15;
const MAX_DURATION = 480;
const DAY_LOOKAHEAD = 7;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const weekdayOf = (date) => new Date(`${date}T12:00:00`).getDay();

export const normalizeTitle = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Clamp a duration into sensible limits. */
export const clampDuration = (minutes) =>
  Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(minutes || 30)));

/** Merge overlapping intervals (minutes-of-day). */
export function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
    else out.push(sorted[i]);
  }
  return out;
}

/** Free [start,end] windows (minutes-of-day) between busy intervals. */
export function freeSlots(dayStart, dayEnd, busy) {
  const merged = mergeIntervals(busy);
  const slots = [];
  let cursor = dayStart;
  for (const [s, e] of merged) {
    if (s > cursor) slots.push([cursor, s]);
    if (e > cursor) cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) slots.push([cursor, dayEnd]);
  return slots;
}

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/* ------------------------------------------------------------------ */
/* Busy windows for a given date                                       */
/* ------------------------------------------------------------------ */

const todayReference = () => todayISO();

/** Fixed commitments active on this date (minutes-of-day), plus their labels. */
function commitmentsForDate(settings, date) {
  const weekday = weekdayOf(date);
  const all = [
    ...(settings?.commitments || []).map((c) => ({ ...c })),
    { title: 'Sleep', days: [0, 1, 2, 3, 4, 5, 6], start: '23:00', end: '07:00' },
  ];
  const busy = [];
  const labels = [];
  for (const c of all) {
    if (c.days?.length && !c.days.includes(weekday)) continue;
    const ws = toMin(settings?.workingHours?.start || '09:00');
    const we = toMin(settings?.workingHours?.end || '18:00');
    let s = Math.max(toMin(c.start), ws);
    const e = Math.min(toMin(c.end), we);
    if (e <= s) continue; // overnight commitments are handled by the planner the same way
    busy.push([s, e]);
    labels.push({ start: fromMin(s), end: fromMin(e), title: c.title });
  }
  return { busy, labels };
}

/** All busy minutes-of-day for a date: commitments + already-scheduled tasks. */
export function busyForDate(tasks, settings, date, excludeTaskIds = []) {
  const { busy } = commitmentsForDate(settings, date);
  for (const t of tasks || []) {
    if (t.scheduledStart && String(t.scheduledStart).slice(0, 10) === date && !excludeTaskIds.includes(t.id)) {
      const s = Math.max(toMin(t.scheduledStart.slice(11, 16)), toMin(settings?.workingHours?.start || '09:00'));
      const e = Math.min(toMin(t.scheduledEnd?.slice(11, 16)), toMin(settings?.workingHours?.end || '18:00'));
      if (e > s) busy.push([s, e]);
    }
  }
  return busy;
}

/**
 * Finds a concrete slot for a duration. `preferred` may be { start, end } —
 * the slot is honoured unless it overlaps; otherwise the earliest fitting free
 * window that day is used, working forwards through `DAY_LOOKAHEAD` days.
 * When a deadline is given (`before`, an ISO date), later days are not used.
 * Returns { date, start, end } or null if nothing fits.
 */
export function findSlot({ tasks, settings, durationMinutes, preferred = null, startDate = null, excludeTaskIds = [], windowDays = DAY_LOOKAHEAD, before = null }) {
  const duration = clampDuration(durationMinutes);
  const ws = toMin(settings?.workingHours?.start || '09:00');
  const we = toMin(settings?.workingHours?.end || '18:00');
  const start = startDate && startDate >= todayReference() ? startDate : todayReference();

  const deadline = before ? Math.max(before, start) : null;
  const last = deadline || addDays(start, windowDays - 1);
  const withinRange = (d) => d <= last;
  const defaultDays = Array.from({ length: windowDays }, (_, i) => addDays(start, i)).filter(withinRange);

  // A requested date in the past must never be honoured — fall back to "soon".
  const pref = preferred && preferred.date >= start ? preferred : null;

  let dateCandidates = pref?.date
    ? [pref.date].filter(withinRange)
    : defaultDays;
  if (!dateCandidates.length) dateCandidates = defaultDays;
  const candidatesFor = (arr) =>
    arr
      .map((date) => {
        const busy = busyForDate(tasks, settings, date, excludeTaskIds);
        for (const [s, e] of freeSlots(ws, we, busy)) {
          if (e - s >= duration) return { date, start: fromMin(s), end: fromMin(s + duration) };
        }
        return null;
      })
      .find(Boolean);

  // Exact requested window (time honoured unless it overlaps something).
  if (pref?.date && pref.start !== undefined && pref.end !== undefined) {
    const busy = busyForDate(tasks, settings, pref.date, excludeTaskIds);
    const ps = Math.max(toMin(pref.start), ws);
    const pe = Math.min(toMin(pref.end), we);
    const fits = pe - ps >= duration && !busy.some(([s, e]) => overlaps(ps, pe, s, e));
    if (fits) return { date: pref.date, start: fromMin(ps), end: fromMin(ps + duration) };

    // Busy -> prefer the first gap at/after the requested start, same day.
    const slots = freeSlots(ws, we, busy);
    for (const [s, e] of slots) {
      const st = Math.max(s, ps);
      if (e - st >= duration) return { date: pref.date, start: fromMin(st), end: fromMin(st + duration) };
    }
    // Otherwise the best-fitting gap before the requested start, same day.
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      const [s, e] = slots[i];
      if (Math.min(e, pe) - s >= duration) return { date: pref.date, start: fromMin(s), end: fromMin(s + duration) };
    }

    // Nothing that day -> try the following days (still subject to deadline).
    const later = candidatesFor(defaultDays.filter((d) => d > pref.date));
    if (later) return later;
  }

  return candidatesFor(dateCandidates);
}

/* ------------------------------------------------------------------ */
/* Task lookup                                                         */
/* ------------------------------------------------------------------ */

export function findTask(tasks, taskId, title) {
  if (taskId) {
    const byId = (tasks || []).find((t) => t.id === taskId);
    if (byId) return byId;
  }
  const norm = normalizeTitle(title);
  if (!norm) return null;
  const list = tasks || [];
  const exact = list.find((t) => normalizeTitle(t.title) === norm);
  if (exact) return exact;
  const partial = list.find((t) => normalizeTitle(t.title).includes(norm) || norm.includes(normalizeTitle(t.title)));
  if (partial && norm.length >= 3) return partial;
  return null;
}

/* ------------------------------------------------------------------ */
/* Resolution: validate ops, pick real slots, build preview labels     */
/* ------------------------------------------------------------------ */

const HOURS_LABELS = {
  1: 'urgent',
  2: 'important',
  3: 'delegate',
  4: 'drop',
};

const slotLabel = (date, start, end) =>
  `${dateLabel(date)}, ${hhmmTo12(start)} \u2013 ${hhmmTo12(end)}`;

/** Earliest fitting window on a date whose start is >= cursorMin. */
function slotAfter(tasks, settings, date, cursorMin, duration, exclude) {
  const ws = toMin(settings?.workingHours?.start || '09:00');
  const we = toMin(settings?.workingHours?.end || '18:00');
  const busy = busyForDate(tasks, settings, date, exclude);
  for (const [s, e] of freeSlots(ws, we, busy)) {
    const st = Math.max(s, cursorMin);
    if (e - st >= duration) return { start: fromMin(st), end: fromMin(st + duration) };
  }
  return null;
}

/** Last fitting window on a date that ends <= cursorMin. */
function slotBefore(tasks, settings, date, cursorMin, duration, exclude) {
  const ws = toMin(settings?.workingHours?.start || '09:00');
  const we = toMin(settings?.workingHours?.end || '18:00');
  const busy = busyForDate(tasks, settings, date, exclude);
  const slots = freeSlots(ws, we, busy);
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const [s, e] = slots[i];
    if (Math.min(e, cursorMin) - s >= duration) return { start: fromMin(s), end: fromMin(s + duration) };
  }
  return null;
}

/** Scheduled tasks overlapping a requested window on a given date. */
function blockersOn(tasks, date, startMin, endMin, exclude) {
  return (tasks || []).filter(
    (t) =>
      t.scheduledStart &&
      String(t.scheduledStart).slice(0, 10) === date &&
      !exclude.includes(t.id) &&
      overlaps(startMin, endMin, toMin(t.scheduledStart.slice(11, 16)), toMin((t.scheduledEnd || t.scheduledStart).slice(11, 16))),
  );
}

/** Turns raw ops into resolved ops (final times + labels + status notes). */
export function resolveOps({ tasks, settings, ops, windowDays = DAY_LOOKAHEAD }) {
  const conflicts = [];
  const resolved = [];

  for (const raw of ops || []) {
    const op = { ...raw };
    const list = tasks || [];

    // -- schedule / create ------------------------------------------------
    if (op.op === 'schedule') {
      const existing = findTask(list, op.taskId, op.title);
      if (op.taskId && !existing && !op.title) {
        conflicts.push(`Could not find a task matching id "${op.taskId}".`);
        resolved.push({ ...op, status: 'conflict', label: `Unknown task "${op.taskId}"`, taskId: op.taskId });
        continue;
      }
      const duration = clampDuration(op.durationMinutes || existing?.estimatedMinutes || 30);
      const wasScheduled = Boolean(existing?.scheduledStart);
      const preferred = op.date ? { date: op.date, start: op.start, end: op.end } : null;
      const exclude = existing ? [existing.id] : [];
      const slot = findSlot({
        tasks: list,
        settings,
        durationMinutes: duration,
        preferred,
        excludeTaskIds: exclude,
        startDate: op.date || todayReference(),
        before: op.deadline || op.before,
        windowDays,
      });

      if (!slot) {
        conflicts.push(`No free time found for "${op.title || existing?.title}" in the next ${windowDays} days.`);
        resolved.push({ ...op, status: 'conflict', label: `Could not schedule "${op.title || existing?.title}" \u2014 no free slot.` });
        continue;
      }

      const sameSlotAsNow =
        existing?.scheduledStart &&
        String(existing.scheduledStart).slice(0, 10) === slot.date &&
        existing.scheduledStart.slice(11, 16) === slot.start &&
        existing.scheduledEnd?.slice(11, 16) === slot.end;

      const moved = Boolean(existing?.scheduledStart && !sameSlotAsNow);
      const resized =
        Boolean(existing?.scheduledStart) &&
        String(existing.scheduledStart).slice(0, 10) === slot.date &&
        existing.scheduledStart.slice(11, 16) === slot.start &&
        slot.end !== existing.scheduledEnd?.slice(11, 16);

      const became = !existing
        ? 'create'
        : !existing.scheduledStart
          ? 'schedule'
          : resized
            ? 'resize'
            : moved
              ? 'move'
              : 'keep';

      const requested = preferred?.start !== undefined;
      let note = '';
      let status = 'ok';
      if (requested && (slot.start !== op.start || slot.end !== op.end)) {
        status = 'adjusted';
        const wsInner = toMin(settings?.workingHours?.start || '09:00');
        const weInner = toMin(settings?.workingHours?.end || '18:00');
        const blocker = blockersOn(
          list,
          op.date || String(existing?.scheduledStart || '').slice(0, 10),
          Math.max(toMin(op.start), wsInner),
          Math.min(toMin(op.end), weInner),
          exclude,
        )[0];
        note = blocker
          ? `${hhmmTo12(op.start)} \u2013 ${hhmmTo12(op.end)} is taken by "${blocker.title}" \u2014 moved to ${hhmmTo12(slot.start)} \u2013 ${hhmmTo12(slot.end)}.`
          : `Moved to ${hhmmTo12(slot.start)} \u2013 ${hhmmTo12(slot.end)} because your requested window was busy.`;
      } else if (!requested && !existing?.scheduledStart) {
        note = 'Found the first free slot.';
      }

      // When a specific window was requested and it was busy, offer
      // deterministic alternatives so the user can pick before applying.
      let alternatives;
      if (requested && status === 'adjusted' && op.date) {
        const ws = toMin(settings?.workingHours?.start || '09:00');
        const we = toMin(settings?.workingHours?.end || '18:00');
        alternatives = [];
        const later = slotAfter(list, settings, op.date, toMin(op.end), duration, exclude);
        if (later && (later.start !== slot.start || later.end !== slot.end)) {
          alternatives.push({
            date: op.date,
            start: later.start,
            end: later.end,
            status: 'adjusted',
            label: `${hhmmTo12(later.start)} \u2013 ${hhmmTo12(later.end)} (same day, later)`,
            note: 'A free gap later in the same working window.',
          });
        }
        const earlier = slotBefore(list, settings, op.date, toMin(op.start), duration, exclude);
        if (earlier && (earlier.start !== slot.start || earlier.end !== slot.end)) {
          alternatives.push({
            date: op.date,
            start: earlier.start,
            end: earlier.end,
            status: 'adjusted',
            label: `${hhmmTo12(earlier.start)} \u2013 ${hhmmTo12(earlier.end)} (same day, earlier)`,
            note: 'A free gap earlier in the same working window.',
          });
        }
        const bs = Math.max(toMin(op.start), ws);
        const be = Math.min(toMin(op.end), we);
        const blocker = blockersOn(list, op.date, bs, be, exclude)[0];
        if (blocker) {
          const bDur = clampDuration(blocker.estimatedMinutes || 30);
          const bSlot = findSlot({
            tasks: list,
            settings,
            durationMinutes: bDur,
            startDate: op.date,
            excludeTaskIds: [...exclude, blocker.id],
            windowDays,
          });
          if (bSlot) {
            alternatives.push({
              keepRequest: true,
              date: op.date,
              start: op.start,
              end: op.end,
              status: 'ok',
              label: `${hhmmTo12(op.start)} \u2013 ${hhmmTo12(op.end)} \u2022 move "${blocker.title}" instead`,
              note: `Keep your requested time; "${blocker.title}" moves to a free slot${
                bSlot.date === op.date ? ' elsewhere' : ` on ${dateLabel(bSlot.date)}`
              }.`,
              extraOps: [
                {
                  op: 'schedule',
                  taskId: blocker.id,
                  title: blocker.title,
                  date: bSlot.date,
                  start: bSlot.start,
                  end: bSlot.end,
                  durationMinutes: bDur,
                  status: 'ok',
                  label: `Move "${blocker.title}" \u2192 ${slotLabel(bSlot.date, bSlot.start, bSlot.end)}`,
                },
              ],
            });
          }
        }
      }

      resolved.push({
        ...op,
        taskId: existing?.id || null,
        title: op.title || existing?.title,
        date: slot.date,
        start: slot.start,
        end: slot.end,
        durationMinutes: duration,
        displayKind: became,
        status,
        note,
        alternatives,
        label:
          became === 'create'
            ? `Add "${op.title}" \u2014 ${slotLabel(slot.date, slot.start, slot.end)}`
            : became === 'schedule'
              ? `Schedule "${existing.title}" \u2014 ${slotLabel(slot.date, slot.start, slot.end)}`
              : became === 'resize'
                ? `Resize "${existing.title}" \u2014 ${slotLabel(slot.date, slot.start, slot.end)} (${duration} min)`
                : became === 'keep'
                  ? `Keep "${existing.title}" at ${slotLabel(slot.date, slot.start, slot.end)}`
                  : `Move "${existing.title}" \u2192 ${slotLabel(slot.date, slot.start, slot.end)}`,
      });
      continue;
    }

    // -- single-task ops (found by id or fuzzy title) ---------------------
    const target = findTask(list, op.taskId, op.title);
    if (op.op !== 'schedule' && !target) {
      conflicts.push(`Could not find a task matching "${op.title || op.taskId}".`);
      resolved.push({ ...op, status: 'conflict', label: `Unknown task "${op.title || op.taskId}"`, taskId: null });
      continue;
    }

    if (op.op === 'unschedule') {
      resolved.push({ ...op, taskId: target.id, status: 'ok', label: `Remove "${target.title}" from the calendar` });
    } else if (op.op === 'delete') {
      resolved.push({ ...op, taskId: target.id, status: 'ok', label: `Delete "${target.title}"` });
    } else if (op.op === 'complete') {
      resolved.push({ ...op, taskId: target.id, status: 'ok', label: `Complete "${target.title}"` });
    } else if (op.op === 'priority') {
      const p = Math.min(4, Math.max(1, Math.round(Number(op.priority) || 2)));
      resolved.push({
        ...op,
        taskId: target.id,
        priority: p,
        status: 'ok',
        label: `Priority of "${target.title}" \u2192 ${p} (${HOURS_LABELS[p]})`,
      });
    } else if (op.op === 'deadline') {
      resolved.push({
        ...op,
        taskId: target.id,
        deadline: orNull(op.deadline),
        status: 'ok',
        label: `Deadline for "${target.title}" \u2192 ${op.deadline || 'removed'}`,
      });
    } else {
      conflicts.push(`Unknown operation "${op.op}".`);
    }
  }

  return { ops: resolved, conflicts };
}

const orNull = (v) => (v ? String(v) : null);

/* ------------------------------------------------------------------ */
/* Apply                                                               */
/* ------------------------------------------------------------------ */

const freshId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Applies resolved ops to the task list. Returns a NEW array (the old one is
 * untouched) plus the count of newly created tasks.
 */
export function applyOpTasks(originalTasks, resolvedOps) {
  let tasks = (originalTasks || []).map((t) => ({ ...t }));
  let created = 0;
  let mutated = false;

  for (const op of resolvedOps || []) {
    if (op.status === 'conflict') continue;
    mutated = true;
    switch (op.op) {
      case 'schedule': {
        const isoFor = (t) => `${op.date}T${t}:00`;
        if (op.taskId) {
          tasks = tasks.map((t) =>
            t.id === op.taskId
              ? { ...t, scheduledStart: isoFor(op.start), scheduledEnd: isoFor(op.end) }
              : t,
          );
        } else {
          tasks = [
            ...tasks,
            {
              id: freshId(),
              title: op.title || 'New item',
              completed: false,
              priority: op.priority ?? 2,
              deadline: op.deadline || null,
              estimatedMinutes: op.durationMinutes || 30,
              category: op.category || 'Work',
              notes: op.notes || '',
              recurring: null,
              scheduledStart: isoFor(op.start),
              scheduledEnd: isoFor(op.end),
              completedAt: null,
              createdAt: new Date().toISOString(),
            },
          ];
          created += 1;
        }
        break;
      }
      case 'unschedule':
        tasks = tasks.map((t) => (t.id === op.taskId ? { ...t, scheduledStart: null, scheduledEnd: null } : t));
        break;
      case 'delete':
        tasks = tasks.filter((t) => t.id !== op.taskId);
        break;
      case 'complete':
        tasks = tasks.map((t) =>
          t.id === op.taskId
            ? { ...t, completed: true, completedAt: t.completedAt || new Date().toISOString() }
            : t,
        );
        break;
      case 'priority':
        tasks = tasks.map((t) => (t.id === op.taskId ? { ...t, priority: op.priority } : t));
        break;
      case 'deadline':
        tasks = tasks.map((t) => (t.id === op.taskId ? { ...t, deadline: op.deadline } : t));
        break;
      default:
        break;
    }
  }

  return { tasks, created, mutated };
}