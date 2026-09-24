/**
 * db.js — storage adapter for Plano.
 *
 * This is the ONLY file that touches localStorage. It exposes an async,
 * document-store-style API that mirrors what a future Supabase/Firebase
 * adapter would provide, so moving to a cloud database later only requires
 * swapping this module (the rest of the app never reads localStorage itself).
 */
import { uid } from './ids.js';

const STORAGE_KEY = 'plano:db:v1';

/* ------------------------------------------------------------------ */
/* Seed data — gives new users a realistic first-run experience.      */
/* ------------------------------------------------------------------ */
function seed() {
  const now = new Date().toISOString();
  return {
    settings: {
      theme: 'light',
      workingHours: { start: '09:00', end: '18:00' },
      workDays: [1, 2, 3, 4, 5],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      energy: 'balanced',
      notifications: { breaks: true, dailyPlan: false, sounds: true },
      pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, roundsBeforeLong: 4 },
    },
    tasks: [
      {
        id: uid(), title: 'Review Q3 launch plan', completed: false,
        priority: 1, deadline: addIso(2), estimatedMinutes: 60, category: 'Work',
        notes: 'Final review before the team kickoff on Thursday.', recurring: null,
        scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Write Spanish vocabulary cards', completed: false,
        priority: 2, deadline: null, estimatedMinutes: 30, category: 'Learning',
        notes: '20 new words from the travel chapter.', recurring: { frequency: 'daily' },
        scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Draft project proposal', completed: false,
        priority: 2, deadline: addIso(5), estimatedMinutes: 120, category: 'Work',
        notes: '', recurring: null, scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Morning workout', completed: false,
        priority: 3, deadline: null, estimatedMinutes: 45, category: 'Health',
        notes: '', recurring: { frequency: 'weekly' }, scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Reply to mentorship emails', completed: false,
        priority: 3, deadline: addIso(1), estimatedMinutes: 20, category: 'Personal',
        notes: '', recurring: null, scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Schedule dentist appointment', completed: false,
        priority: 4, deadline: null, estimatedMinutes: 15, category: 'Personal',
        notes: '', recurring: null, scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
      {
        id: uid(), title: 'Read 20 pages — Deep Work', completed: true,
        priority: 2, deadline: null, estimatedMinutes: 40, category: 'Reading',
        notes: '', recurring: null, scheduledStart: null, scheduledEnd: null, createdAt: now,
      },
    ],
    goals: [
      {
        id: uid(), title: 'Learn Spanish to B1', description: 'Conversational fluency before the summer trip.',
        targetDate: addIso(90), color: '#34d399', createdAt: now,
        milestones: [
          { id: uid(), title: 'Finish Duolingo unit 6', dueDate: addIso(14), achieved: false },
          { id: uid(), title: 'Hold a 10-minute chat with a tutor', dueDate: addIso(45), achieved: false },
          { id: uid(), title: 'Watch a movie with Spanish subtitles', dueDate: addIso(70), achieved: false },
        ],
      },
      {
        id: uid(), title: 'Ship the portfolio redesign', description: 'A polished case-study site.',
        targetDate: addIso(21), color: '#60a5fa', createdAt: now,
        milestones: [
          { id: uid(), title: 'Reusable component library', dueDate: addIso(7), achieved: true },
          { id: uid(), title: 'Three case studies written', dueDate: addIso(14), achieved: false },
          { id: uid(), title: 'Mobile/accessibility pass', dueDate: addIso(19), achieved: false },
        ],
      },
    ],
    sessions: [
      { id: uid(), startedAt: new Date(Date.now() - 3600e3 - 25 * 60e3).toISOString(), endedAt: new Date(Date.now() - 3600e3).toISOString(), durationMinutes: 25, taskId: null },
    ],
    version: 1,
  };
}

function addIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Storage primitives                                                  */
/* ------------------------------------------------------------------ */
let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw);
      if (!cache.settings) cache.settings = seed().settings;
      return cache;
    }
  } catch {
    /* corrupted storage -> reseed */
  }
  cache = seed();
  persist();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('Plano: could not persist data', err);
  }
}

/* ------------------------------------------------------------------ */
/* Public API (async, db-like)                                         */
/* ------------------------------------------------------------------ */
const clone = (x) => JSON.parse(JSON.stringify(x));

export const db = {
  async snapshot() {
    return clone(load());
  },

  async persist(snapshot) {
    cache = clone(snapshot);
    persist();
  },

  // Quick accessors (used rarely; most reads go through the React context).
  async getSettings() {
    return clone(load().settings);
  },
  async setSettings(settings) {
    load().settings = clone(settings);
    persist();
    return clone(load().settings);
  },

  async resetAll() {
    cache = seed();
    persist();
    return clone(cache);
  },
};