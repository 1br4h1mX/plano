import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icons.jsx';
import { useApp } from '../../hooks/useApp.js';

export default function Topbar({ onOpenMenu }) {
  const navigate = useNavigate();
  const { settings, setTheme } = useApp();

  const isDark = settings.theme === 'dark';
  const cycleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 sm:px-6 bg-base/85 backdrop-blur-md border-b border-line">
      <button type="button" className="btn-icon lg:hidden -ml-1" onClick={onOpenMenu} aria-label="Open menu">
        <Icon name="burger" className="h-5 w-5" />
      </button>

      <div className="hidden sm:flex items-center gap-2 text-sm">
        <span className="text-sub">Today</span>
        <span className="text-faint">·</span>
        <span className="text-faint font-medium">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className="btn-primary sm:px-3.5 px-2.5"
          onClick={() => navigate('/app/assistant')}
        >
          <Icon name="sparkles" className="h-4 w-4" />
          <span className="hidden sm:inline">AI Assistant</span>
          <span className="sm:hidden">AI</span>
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={cycleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={isDark ? 'sun' : 'moon'} className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}