/**
 * AppContext.jsx — the single source of truth for Plano's data.
 *
 * Loads once from the storage adapter (db.js), exposes CRUD operations and a
 * theme system, and persists every mutation automatically. Swap `db` for a
 * Supabase/Firebase adapter later without touching any component.
 */
import { createContext, useEffect, useMemo, useState, useCallback } from 'react';
import { db } from '../lib/db.js';
import { uid } from '../lib/ids.js';
import { computeStats, goalProgress } from '../lib/stats.js';

const AppContext = createContext(null);
export default AppContext;

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;

export function AppProvider({ children }) {
  const [data, setData] = useState(null); // { settings, tasks, goals, sessions }
  const [ready, setReady] = useState(false);

  // ---- initial load -----------------------------------------------------
  useEffect(() => {
    db.snapshot().then((snapshot) => {
      setData(snapshot);
      setReady(true);
    });
  }, []);

  // ---- persistence ------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    db.persist(data);
  }, [data, ready]);

  // ---- theme ------------------------------------------------------------
  useEffect(() => {
    if (!ready || !data) return;
    const pref = data.settings?.theme || 'light';
    const dark = pref === 'dark' || (pref === 'system' && systemDark());
    document.documentElement.classList.toggle('dark', dark);
  }, [data?.settings?.theme, ready]);

  const setTheme = useCallback((theme) => {
    setData((d) => ({ ...d, settings: { ...d.settings, theme } }));
  }, []);

  // ---- task CRUD --------------------------------------------------------
  const addTask = useCallback((partial) => {
    const task = {
      id: uid(),
      title: '',
      completed: false,
      priority: 2,
      deadline: null,
      estimatedMinutes: 30,
      category: 'Work',
      notes: '',
      recurring: null,
      scheduledStart: null,
      scheduledEnd: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      ...partial,
    };
    setData((d) => ({ ...d, tasks: [task, ...d.tasks] }));
    return task.id;
  }, []);

  const updateTask = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
    }));
  }, []);

  const deleteTask = useCallback((id) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, []);

  const toggleTask = useCallback((id) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: t.completed ? null : new Date().toISOString() }
          : t,
      ),
    }));
  }, []);

  const scheduleTask = useCallback((id, start, end, date) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              scheduledStart: date ? `${date}T${start}:00` : start,
              scheduledEnd: date ? `${date}T${end}:00` : end,
            }
          : t,
      ),
    }));
  }, []);

  // ---- goal CRUD --------------------------------------------------------
  const addGoal = useCallback((partial) => {
    const goal = {
      id: uid(),
      title: '',
      description: '',
      targetDate: null,
      color: '#6366f1',
      milestones: [],
      createdAt: new Date().toISOString(),
      ...partial,
    };
    setData((d) => ({ ...d, goals: [...d.goals, goal] }));
    return goal.id;
  }, []);

  const updateGoal = useCallback((id, patch) => {
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch, id: g.id } : g)) }));
  }, []);

  const deleteGoal = useCallback((id) => {
    setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
  }, []);

  const addMilestone = useCallback((goalId, partial) => {
    const milestone = { id: uid(), title: '', dueDate: null, achieved: false, ...partial };
    setData((d) => ({
      ...d,
      goals: d.goals.map((g) => (g.id === goalId ? { ...g, milestones: [...g.milestones, milestone] } : g)),
    }));
    return milestone.id;
  }, []);

  const updateMilestone = useCallback((goalId, milestoneId, patch) => {
    setData((d) => ({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, ...patch, id: m.id } : m)) }
          : g,
      ),
    }));
  }, []);

  const deleteMilestone = useCallback((goalId, milestoneId) => {
    setData((d) => ({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId ? { ...g, milestones: g.milestones.filter((m) => m.id !== milestoneId) } : g,
      ),
    }));
  }, []);

  // ---- focus sessions ---------------------------------------------------
  const addSession = useCallback((session) => {
    const s = {
      id: uid(),
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: 25,
      taskId: null,
      ...session,
    };
    setData((d) => ({ ...d, sessions: [...d.sessions, s] }));
    return s.id;
  }, []);

  // ---- settings ---------------------------------------------------------
  const updateSettings = useCallback((patch) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    db.resetAll().then((snapshot) => setData(snapshot));
  }, []);

  // ---- derived ----------------------------------------------------------
  const value = useMemo(() => {
    const stats = data ? computeStats({ tasks: data.tasks, sessions: data.sessions }) : null;
    const goalsWithProgress = (data?.goals || []).map((g) => ({ ...g, progress: goalProgress(g) }));
    const sortedGoals = [...goalsWithProgress].sort((a, b) => b.progress - a.progress);
    return {
      ready,
      data,
      settings: data?.settings || {},
      tasks: data?.tasks || [],
      goals: data?.goals || [],
      goalsWithProgress,
      sortedGoals,
      sessions: data?.sessions || [],
      stats,
      addTask, updateTask, deleteTask, toggleTask, scheduleTask,
      addGoal, updateGoal, deleteGoal,
      addMilestone, updateMilestone, deleteMilestone,
      addSession,
      updateSettings, setTheme, resetAll,
    };
  }, [data, ready, addTask, updateTask, deleteTask, toggleTask, scheduleTask,
    addGoal, updateGoal, deleteGoal, addMilestone, updateMilestone, deleteMilestone,
    addSession, updateSettings, setTheme, resetAll]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}