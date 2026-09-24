/**
 * eisenhower.js — Eisenhower-matrix priority metadata.
 * Priority 1 = urgent & important ... Priority 4 = neither.
 */

export const PRIORITIES = [
  {
    value: 1,
    label: 'Urgent & Important',
    short: 'Do first',
    blurb: 'Deadline-driven, high impact — schedule into your best hours.',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    value: 2,
    label: 'Important, not urgent',
    short: 'Schedule',
    blurb: 'Drives long-term goals — protect deliberate time for these.',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    value: 3,
    label: 'Urgent, not important',
    short: 'Delegate',
    blurb: 'Ask, batch or quickly dispatch — don\u2019t let them eat your day.',
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
  {
    value: 4,
    label: 'Neither',
    short: 'Drop / low energy',
    blurb: 'Fill quiet windows or drop entirely.',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
  },
];

export const getPriority = (value) =>
  PRIORITIES.find((p) => p.value === value) || PRIORITIES[3];

export const CATEGORY_COLORS = {
  Work: '#6366f1',
  Learning: '#34d399',
  Health: '#f59e0b',
  Personal: '#ec4899',
  Reading: '#8b5cf6',
  Admin: '#64748b',
};
export const CATEGORY_LIST = ['Work', 'Learning', 'Health', 'Personal', 'Reading', 'Admin'];

export const categoryColor = (category) =>
  CATEGORY_COLORS[category] || '#64748b';