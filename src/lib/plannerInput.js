import { todayISO } from './dateUtils.js';

/**
 * Builds the exact input payload that the AI / local planner engine expects,
 * straight from the user's live app state.
 */
export function buildPlannerInput({ tasks, goals, settings, days = 7, missedDate = null }) {
  return {
    startDate: todayISO(),
    days,
    missedDate,
    tasks: (tasks || [])
      .filter((t) => t && t.title && !t.completed)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority ?? 2,
        deadline: t.deadline,
        durationMinutes: t.estimatedMinutes || 30,
        category: t.category || 'Work',
      })),
    goals: (goals || [])
      .filter((g) => g && g.title)
      .map((g) => ({ id: g.id, title: g.title, targetDate: g.targetDate })),
    workingHours: settings.workingHours || { start: '09:00', end: '18:00' },
    workDays: settings.workDays?.length ? settings.workDays : [1, 2, 3, 4, 5],
    energy: settings.energy || 'balanced',
    commitments: [
      ...(settings.commitments || []).map((c) => ({ ...c })),
      // Sleep is a fixed commitment — informs the AI about the real day.
      { title: 'Sleep', days: [0, 1, 2, 3, 4, 5, 6], start: '23:00', end: '07:00' },
    ],
    bufferMinutes: 10,
    includeGoalBlocks: true,
  };
}

/** Human-readable snapshot of the user's current state (for the chat assistant). */
export function contextLines(state) {
  const { tasks, goals, settings, stats } = state;
  const pending = (tasks || []).filter((t) => !t.completed);
  const lines = [];
  lines.push(`Today's date: ${todayISO()}`);
  if (stats) {
    lines.push(`Today: ${stats.completedToday} tasks done, ${Math.round(stats.focusMinutesToday / 60)}h ${stats.focusMinutesToday % 60}m of focus logged, ${stats.currentStreak}-day active streak.`);
  }
  lines.push(`Working hours ${settings.workingHours?.start}–${settings.workingHours?.end}, ${settings.workDays?.length || 5} workday(s), energy profile: ${settings.energy || 'balanced'}.`);
  if (pending.length) lines.push(`Pending tasks: ${pending.slice(0, 8).map((t) => `"${t.title}" (p${t.priority})`).join(', ')}${pending.length > 8 ? ', …' : ''}`);
  if (goals?.length) lines.push(`Goals: ${goals.map((g) => `"${g.title}"`).join(', ')}`);
  return lines;
}