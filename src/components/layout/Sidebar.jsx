import { NavLink } from 'react-router-dom';
import { Icon } from '../ui/Icons.jsx';
import Logo from '../ui/Logo.jsx';

const NAV = [
  { to: '/app/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/app/tasks', icon: 'list', label: 'Tasks' },
  { to: '/app/calendar', icon: 'calendar', label: 'Calendar' },
  { to: '/app/goals', icon: 'target', label: 'Goals' },
  { to: '/app/focus', icon: 'timer', label: 'Focus timer' },
  { to: '/app/stats', icon: 'chart', label: 'Statistics' },
  { to: '/app/assistant', icon: 'sparkles', label: 'AI Assistant' },
  { to: '/app/settings', icon: 'settings', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col bg-surface border-r border-line
          lg:translate-x-0 transition-transform duration-300 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-line">
          <NavLink to="/" onClick={onClose} aria-label="Plano home">
            <Logo />
          </NavLink>
          <button type="button" className="btn-icon lg:hidden" onClick={onClose} aria-label="Close menu">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-brand-soft text-brand' : 'text-sub hover:bg-surface hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 2} />
                  {item.label}
                  {item.to.includes('assistant') && (
                    <span className="ml-auto chip bg-brand/10 text-brand">AI</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-brand grid place-items-center text-white text-xs font-bold">
              P
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">Your workspace</p>
              <p className="text-xs text-faint truncate">Stored locally</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}