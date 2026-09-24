/**
 * dateUtils.js — time helpers shared across the app.
 * All date strings are local "YYYY-MM-DD"; times are "HH:MM".
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function toISO(date) {
  if (date instanceof Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return date;
}

export function toDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

export function addDays(dateStr, n) {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday-first week helpers (European/US calendars both fine with Monday). */
export const WEEK_START = 1;
export function startOfWeek(dateStr) {
  const d = toDate(dateStr);
  const day = (d.getDay() + 7 - WEEK_START) % 7;
  d.setDate(d.getDate() - day);
  return toISO(d);
}

export function getWeekDates(dateStr) {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dateLabel(dateStr) {
  const d = toDate(dateStr);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function shortLabel(dateStr) {
  const d = toDate(dateStr);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function weekdayIndex(dateStr) {
  return toDate(dateStr).getDay();
}

export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startDay = (first.getDay() + 7 - WEEK_START) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(toISO(new Date(year, monthIndex, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fromMinutes = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
export const minutesAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
export const hhmmTo12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};
export const formatDuration = (minutes) => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Number of weekdays between two dates (inclusive of start, exclusive of end). */
export function diffDays(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return Math.round((x - y) / 86400000);
}