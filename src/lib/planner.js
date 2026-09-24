/**
 * planner.js — the core scheduling engine (client-side copy).
 *
 * This is the exact same engine used by server/planner.js for the offline
 * fallback and as the LLM's validator. It ships in the browser bundle so the
 * AI assistant keeps working on static hosts (e.g. GitHub Pages) that have
 * no backend. Keep this file in sync with server/planner.js.
 *
 * Logic:
 *   - Eisenhower-inspired priority weighting (urgency x importance)
 *   - fixed commitments carved out first, tasks scheduled into free slots
 *   - automatic breaks, buffer time, lunch, and per-goal daily focus steps
 *   - energy-profile aware placement (morning/evening person)
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PRIORITY_WEIGHT = { 1: 100, 2: 80, 3: 55, 4: 30 };

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fromMin = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const diffDays = (a, b) => {
  const x = new Date(`${a}T12:00:00`); // a - b
  const y = new Date(`${b}T12:00:00`);
  return Math.round((x - y) / 86400000);
};

/** Merge overlapping commitments into a list of busy intervals (minutes-of-day). */
function mergeIntervals(intervals) {
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

function freeSlots(dayStart, dayEnd, busy) {
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

/** Score a task for scheduling priority: higher is scheduled earlier. */
function scoreTask(task, startDate, windowDays) {
  let score = PRIORITY_WEIGHT[task.priority] ?? 40;
  if (task.deadline) {
    const d = diffDays(task.deadline, startDate);
    if (d < 0) score += 300; // overdue: handle immediately
    else if (d <= 1) score += 150;
    else if (d <= 3) score += 90;
    else if (d <= windowDays) score += 40;
  }
  return score;
}

function defaultInput(input = {}) {
  return {
    startDate: input.startDate || addDays(new Date().toISOString().slice(0, 10), 0),
    days: Math.min(Math.max(input.days || 7, 1), 21),
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    goals: Array.isArray(input.goals) ? input.goals : [],
    workingHours: { start: '09:00', end: '18:00', ...(input.workingHours || {}) },
    workDays: input.workDays || [1, 2, 3, 4, 5],
    commitments: input.commitments || [],
    energy: input.energy || 'balanced',
    bufferMinutes: input.bufferMinutes ?? 10,
    includeGoalBlocks: input.includeGoalBlocks !== false,
    missedDate: input.missedDate || null,
  };
}

/**
 * Builds a fully-realized schedule. Returns:
 * { days: [{date, weekday, blocks: [...]}], summary: {...}, overflow: [...] }
 */
export function buildPlan(rawInput) {
  const input = defaultInput(rawInput);
  const start = input.missedDate || input.startDate;
  const dates = Array.from({ length: input.days }, (_, i) => addDays(start, i));
  const ws = toMin(input.workingHours.start);
  const we = toMin(input.workingHours.end);
  const isEnergyMorning = input.energy === 'morning';

  // ----- per-day fixed commitments -----
  const dayFixed = dates.map((date, i) => {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const busy = [];
    const blocks = [];
    for (const c of input.commitments || []) {
      const triggered = !c.days || c.days.length === 0 || c.days.includes(weekday);
      if (!triggered) continue;
      const s = toMin(c.start);
      const e = Math.min(toMin(c.end), we);
      if (e <= s) continue;
      busy.push([s, e]);
      blocks.push({
        title: c.title, start: fromMin(s), end: fromMin(e),
        type: 'commitment', notes: c.notes || '', fixed: true,
      });
    }
    return { date, weekday, weekdayName: DAY_NAMES[weekday], busy, blocks, isWorkday: input.workDays.includes(weekday) };
  });

  // ----- task ranking -----
  const tasks = input.tasks
    .filter((t) => t && t.title && !t.completed)
    .map((t) => ({ ...t, score: scoreTask(t, start, input.days), placed: false }))
    .sort((a, b) => b.score - a.score || (a.durationMinutes || 30) - (b.durationMinutes || 30));

  // ----- per-day free slots for tasks -----
  const getSlots = (i) => freeSlots(ws, we, dayFixed[i].busy);

  // Place each task greedily into the earliest-fitting slot.
  const overflow = [];
  const placed = [];
  for (const task of tasks) {
    const duration = Math.max(Math.min(task.durationMinutes || 30, 240), 15);
    const latestDateIndex =
      task.deadline
        ? Math.min(Math.max(diffDays(task.deadline, start), 0), input.days - 1)
        : input.days - 1;

    let placedAt = null;
    for (let i = 0; i <= latestDateIndex; i += 1) {
      const slots = getSlots(i);
      for (const [s, e] of slots) {
        if (e - s < duration) continue;
        // Energy preference: morning focused blocks land before 13:00, evening after.
        const noon = toMin('13:00');
        const hourMean = (s + e) / 2;
        const preference = isEnergyMorning
          ? (noon - hourMean) * 0.05
          : (hourMean - noon) * 0.05;
        const nextBlockStart = s + duration + preference;
        if (nextBlockStart <= e) {
          placedAt = { i, start: s, end: s + duration };
          break;
        }
      }
      if (placedAt) break;
    }

    if (placedAt) {
      const { i, start: s, end: e } = placedAt;
      dayFixed[i].busy.push([s, e]);
      dayFixed[i].blocks.push({
        title: task.title, start: fromMin(s), end: fromMin(e),
        type: 'task', taskId: task.id, category: task.category || null,
      });
      placed.push({ date: dayFixed[i].date, title: task.title, start: fromMin(s), end: fromMin(e), taskId: task.id });
      task.placed = true;
    } else {
      overflow.push({ title: task.title, taskId: task.id, reason: 'no available slot in planning window' });
    }
  }

  // ----- goal daily focus steps -----
  if (input.includeGoalBlocks) {
    for (const goal of input.goals || []) {
      if (!goal || !goal.title) continue;
      for (let i = 0; i < dayFixed.length; i += 1) {
        // Only plan steps for active goals (not past their target).
        if (goal.targetDate && diffDays(goal.targetDate, dayFixed[i].date) < 0) continue;
        const slots = getSlots(i);
        if (!slots.length) continue;
        const [s, e] = slots[0];
        const duration = 25;
        if (e - s < duration) continue;
        const startTime = isEnergyMorning ? s : Math.min(toMin('17:00'), we - duration);
        const sOk = startTime >= s && startTime + duration <= e;
        const finalStart = sOk ? startTime : s;
        dayFixed[i].busy.push([finalStart, finalStart + duration]);
        dayFixed[i].blocks.push({
          title: `Goal focus: ${goal.title}`,
          start: fromMin(finalStart), end: fromMin(finalStart + duration),
          type: 'goal', goalId: goal.id || null,
          notes: isEnergyMorning ? 'High-focus window — do deep work first.' : 'Deep-work block in the afternoon.',
        });
      }
    }
  }

  // ----- breaks, buffer and lunch -----
  for (const day of dayFixed) {
    day.blocks = day.blocks
      .sort((a, b) => toMin(a.start) - toMin(b.start))
      .reduce((acc, block) => {
        if (block.type !== 'commitment') {
          const last = acc[acc.length - 1];
          if (last && last.type !== 'commitment') {
            let gap = toMin(block.start) - toMin(last.end);
            if (gap > 5) {
              const buf = Math.min(gap, input.bufferMinutes);
              acc.push({
                title: 'Buffer', start: fromMin(toMin(last.end)),
                end: fromMin(toMin(last.end) + buf), type: 'buffer',
              });
              gap -= buf;
              if (gap >= 10) {
                acc.push({
                  title: 'Recharge', start: fromMin(toMin(block.start) - gap),
                  end: fromMin(toMin(block.start)), type: 'break',
                });
              }
            }
          }
          if (block.type === 'task' || block.type === 'goal') {
            acc.push({ title: 'Short break', start: fromMin(toMin(block.end)),
              end: fromMin(toMin(block.end) + 10), type: 'break' });
          }
        }
        acc.push(block);
        return acc;
      }, [])
      .filter((b) => toMin(b.end) <= we);

    const lunchAt = toMin('12:30');
    const hasLunch = day.blocks.some(
      (b) => b.type !== 'commitment' && b.start <= '13:00' && b.end >= '12:00',
    );
    if (!hasLunch && day.isWorkday) {
      day.blocks.push({ title: 'Lunch', start: '12:30', end: '13:15', type: 'break' });
      day.blocks.sort((a, b) => toMin(a.start) - toMin(b.start));
    }
  }

  // ----- summary & tips -----
  const totalHours = dayFixed.reduce((sum, d) => {
    return sum + d.blocks.filter((b) => b.type === 'task' || b.type === 'goal').reduce((s, b) => s + (toMin(b.end) - toMin(b.start)), 0);
  }, 0);

  const tips = buildTips({ input, placedCount: placed.length, overflowCount: overflow.length, totalHours });

  return {
    days: dayFixed.map((d) => ({
      date: d.date,
      weekdayName: d.weekdayName,
      blocks: d.blocks.map((b) => ({ ...b, notes: b.notes || '' })),
    })),
    summary: {
      windowStart: start,
      windowDays: input.days,
      minutesPlanned: Math.round(totalHours),
      tasksPlanned: placed.length,
      tasksOverflow: overflow.length,
      insights: buildInsights(input),
      tips,
    },
    overflow,
  };
}

function buildInsights(input) {
  const out = [];
  const overdue = (input.tasks || []).filter((t) => t.deadline && diffDays(t.deadline, input.startDate) < 0);
  const p1 = (input.tasks || []).filter((t) => t.priority === 1);
  if (overdue.length) out.push(`${overdue.length} overdue task(s) — scheduled them first.`);
  if (p1.length) out.push(`You have ${p1.length} high-priority task(s); they got first pick of your best hours.`);
  if ((input.goals || []).length) out.push(`A daily 25-minute focus step was reserved for each active goal.`);
  out.push(`Buffer time was added between blocks so real life won't derail the whole day.`);
  return out.slice(0, 4);
}

function buildTips({ input, placedCount, overflowCount, totalHours }) {
  const tips = [];
  if (overflowCount > 0) {
    tips.push(`${overflowCount} task(s) don't fit your available hours — try trimming scope or extending the planning window.`);
  }
  const hoursPerDay = totalHours / Math.max(input.days, 1) / 60;
  if (hoursPerDay > 6) tips.push('Days look heavy (>6h planned). Consider dropping low-priority items.');
  if (hoursPerDay < 2) tips.push('Days look light. This is a great week to bank extra progress on your goals.');
  if (input.energy === 'morning') tips.push('Your hardest work is scheduled before 1pm when your energy peaks.');
  if (input.energy === 'evening') tips.push('Deep work is scheduled in the afternoon/evening to match your natural rhythm.');
  if (placedCount > 0) tips.push(`Blocked ${placedCount} task(s) into protected time slots.`);
  tips.push('Review each evening and let the AI rebuild tomorrow if life happens.');
  return tips.slice(0, 4);
}

/**
 * Validates + repairs a schedule produced by the LLM so it can be rendered safely.
 * Returns { plan, warnings }.
 */
export function validateSchedule(llmObject) {
  const warnings = [];
  const days = Array.isArray(llmObject?.days) ? llmObject.days : [];
  if (!days.length) warnings.push('LLM returned no days; falling back to empty schedule.');

  const ALLOWED = new Set(['task', 'goal', 'commitment', 'break', 'buffer', 'focus']);
  const cleaned = days.slice(0, 21).map((day, i) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(day?.date) ? day.date : addDays(new Date().toISOString().slice(0, 10), i);
    const blocks = (Array.isArray(day?.blocks) ? day.blocks : [])
      .map((b) => ({
        title: String(b?.title || 'Untitled').slice(0, 120),
        start: fromMin(Math.max(0, Math.min(toMin(b?.start || '09:00'), 1439))),
        end: fromMin(Math.max(0, Math.min(toMin(b?.end || '10:00'), 1439))),
        type: ALLOWED.has(b?.type) ? b.type : 'task',
        taskId: b?.taskId || null,
        goalId: b?.goalId || null,
        notes: String(b?.notes || ''),
      }))
      .filter((b) => toMin(b.end) > toMin(b.start))
      .sort((a, b) => toMin(a.start) - toMin(b.start));
    return { date, weekdayName: day?.weekdayName || 'Weekday', blocks };
  });

  const summary = {
    windowStart: cleaned[0]?.date || null,
    windowDays: cleaned.length,
    minutesPlanned: cleaned.reduce(
      (s, d) => s + d.blocks.filter((b) => b.type === 'task' || b.type === 'goal' || b.type === 'focus')
        .reduce((a, b) => a + (toMin(b.end) - toMin(b.start)), 0),
      0,
    ),
    tasksPlanned: cleaned.reduce((s, d) => s + d.blocks.filter((b) => b.type === 'task').length, 0),
    tasksOverflow: 0,
    insights: Array.isArray(llmObject?.summary?.insights) ? llmObject.summary.insights.slice(0, 5).map(String) : [],
    tips: Array.isArray(llmObject?.summary?.tips) ? llmObject.summary.tips.slice(0, 5).map(String) : [],
  };

  return { plan: { days: cleaned, summary }, warnings };
}