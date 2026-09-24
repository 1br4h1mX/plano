/**
 * Icons.jsx — inline SVG icon set (Lucide-style, stroke-based).
 * No icon library dependency keeps the bundle lean.
 */

function S({ children, className = 'h-5 w-5', strokeWidth = 2, filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: (
    <S>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </S>
  ),
  list: (
    <S>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </S>
  ),
  calendar: (
    <S>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </S>
  ),
  target: (
    <S>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </S>
  ),
  timer: (
    <S>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </S>
  ),
  chart: (
    <S>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </S>
  ),
  sparkles: (
    <S>
      <path d="M9.94 15.5 8.5 14.06 2.34 12.48a.5.5 0 0 1 0-.96L8.5 9.94 9.94 8.5l1.58-6.16a.5.5 0 0 1 .96 0L14.06 8.5l1.44 1.44 6.16 1.58a.5.5 0 0 1 0 .96l-6.16 1.58-1.44 1.44-1.58 6.16a.5.5 0 0 1-.96 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </S>
  ),
  settings: (
    <S>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </S>
  ),
  moon: (
    <S>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </S>
  ),
  sun: (
    <S>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </S>
  ),
  plus: (
    <S>
      <path d="M12 5v14M5 12h14" />
    </S>
  ),
  edit: (
    <S>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </S>
  ),
  trash: (
    <S>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </S>
  ),
  chevL: (
    <S>
      <path d="m15 18-6-6 6-6" />
    </S>
  ),
  chevR: (
    <S>
      <path d="m9 18 6-6-6-6" />
    </S>
  ),
  close: (
    <S>
      <path d="M18 6 6 18M6 6l12 12" />
    </S>
  ),
  send: (
    <S>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </S>
  ),
  play: (
    <S>
      <path d="M6 3v18l15-9Z" />
    </S>
  ),
  pause: (
    <S>
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </S>
  ),
  stop: (
    <S>
      <rect width="14" height="14" x="5" y="5" rx="2" />
    </S>
  ),
  checkCircle: (
    <S>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m22 4-10 10.01-3-3" />
    </S>
  ),
  flag: (
    <S>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </S>
  ),
  bell: (
    <S>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </S>
  ),
  search: (
    <S>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </S>
  ),
  grip: (
    <S>
      <path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" />
    </S>
  ),
  arrowR: (
    <S>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </S>
  ),
  zap: (
    <S>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </S>
  ),
  refresh: (
    <S>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </S>
  ),
  trending: (
    <S>
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </S>
  ),
  inbox: (
    <S>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </S>
  ),
  coffee: (
    <S>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </S>
  ),
  rocket: (
    <S>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </S>
  ),
  check: (
    <S>
      <path d="M20 6 9 17l-5-5" />
    </S>
  ),
  more: (
    <S>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </S>
  ),
  calendarClock: (
    <S>
      <circle cx="17" cy="17" r="4" />
      <path d="M13 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M8 3v4M16 3v4M6 11h12M17 15v2l1.5 1.5" />
    </S>
  ),
  burger: (
    <S>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </S>
  ),
};

export function Icon({ name, className, strokeWidth = 2 }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return React.cloneElement(icon, { className, strokeWidth });
}

import React from 'react';
export default Icon;