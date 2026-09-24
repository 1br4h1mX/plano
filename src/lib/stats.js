/**
 * stats.js — pure functions that derive statistics from raw data.
 * Used by the Dashboard, Statistics page and the weekly AI review.
 */
import { todayISO, addDays } from './dateUtils.js';

const dayOf = (iso) => (iso ? iso.slice(0, 10) : null);

export function computeStats({ tasks = [], sessions = [], windowDays = 14 } = {}) {
  const today = todayISO();
  const completed = tasks.filter((t) => t.completed);
  const completedDates = completed.map((t) => dayOf(t.completedAt)).filter(Boolean);
  const sessionDates = sessions.map((s) => dayOf(s.startedAt)).filter(Boolean);

  const activeDates = new Set([...completedDates, ...sessionDates]);
  const focusMinutesByDay = {};
  sessions.forEach((s) => {
    const d = dayOf(s.startedAt);
    focusMinutesByDay[d] = (focusMinutesByDay[d] || 0) + (s.durationMinutes || 0);
  });

  const perDay = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const dayCompleted = completed.filter((t) => dayOf(t.completedAt) === d).length;
    perDay.push({
      date: d,
      completed: dayCompleted,
      focusMinutes: focusMinutesByDay[d] || 0,
    });
  }

  const current = computedStreak(activeDates);
  const best = bestStreak(activeDates);

  // Completion rate over the last 14 days (completed / total touched).
  const totalTouched = tasks.length || 1;
  const completionRate = Math.round((completed.length / totalTouched) * 100);

  const byCategory = {};
  tasks.forEach((t) => {
    const c = t.category || 'Admin';
    byCategory[c] = byCategory[c] || { total: 0, done: 0 };
    byCategory[c].total += 1;
    if (t.completed) byCategory[c].done += 1;
  });

  const thisWeekStart = addDays(today, -((new Date().getDay() + 6) % 7));
  const completedThisWeek = completed.filter((t) => t.completedAt >= `${thisWeekStart}T00:00:00`).length;

  return {
    totalTasks: tasks.length,
    totalCompleted: completed.length,
    pending: tasks.filter((t) => !t.completed).length,
    completedToday: completed.filter((t) => dayOf(t.completedAt) === today).length,
    completedThisWeek,
    focusMinutesToday: focusMinutesByDay[today] || 0,
    focusMinutesThisWeek: Object.entries(focusMinutesByDay)
      .filter(([d]) => d >= thisWeekStart)
      .reduce((s, [, v]) => s + v, 0),
    focusMinutesTotal: sessions.reduce((s, x) => s + (x.durationMinutes || 0), 0),
    sessionsCount: sessions.length,
    activeDays: activeDates.size,
    currentStreak: current,
    bestStreak: best,
    completionRate,
    perDay,
    focusByDay: perDay,
    byCategory,
    overdue: tasks.filter((t) => !t.completed && t.deadline && t.deadline < today).length,
  };
}

/** Consecutive-day streak ending today (or yesterday, if today is quiet). */
function computedStreak(activeDates) {
  let streak = 0;
  let cursor = todayISO();
  if (!activeDates.has(cursor)) cursor = addDays(cursor, -1); // grace for today
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function bestStreak(activeDates) {
  const dates = [...activeDates].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    if (prev && d === addDays(prev, 1)) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Progress 0..100 for a goal across its milestones. */
export function goalProgress(goal) {
  if (!goal || !Array.isArray(goal.milestones) || !goal.milestones.length) return 0;
  const done = goal.milestones.filter((m) => m.achieved).length;
  return Math.round((done / goal.milestones.length) * 100);
}

/** Human "A:B:C" productivity summary for the dashboard header. */
export function summaryLine(stats) {
  return [
    `${stats.completedToday} done today`,
    `${Math.round(stats.focusMinutesToday / 60)}h focus`,
    `${stats.currentStreak}-day streak`,
  ].join('  ·  ');
}