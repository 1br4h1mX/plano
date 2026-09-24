import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './hooks/useApp.js';
import Landing from './pages/Landing.jsx';
import AppShell from './pages/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Goals from './pages/Goals.jsx';
import FocusTimer from './pages/FocusTimer.jsx';
import Statistics from './pages/Statistics.jsx';
import AIHelper from './pages/AIHelper.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { ready } = useApp();
  return (
    <div className="min-h-screen">
      {!ready ? (
        <LoadScreen />
      ) : (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="goals" element={<Goals />} />
            <Route path="focus" element={<FocusTimer />} />
            <Route path="stats" element={<Statistics />} />
            <Route path="assistant" element={<AIHelper />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
}

function LoadScreen() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="h-11 w-11 rounded-2xl bg-brand animate-pulse grid place-items-center shadow-pop">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M7 7h10M7 12h8M7 17h9" />
        </svg>
      </div>
      <p className="text-sm font-medium text-faint">Warming up your day…</p>
    </div>
  );
}