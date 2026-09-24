import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp.js';
import { todayISO, dateLabel, hhmmTo12, shortLabel, addDays } from '../lib/dateUtils.js';
import { getPriority } from '../lib/eisenhower.js';
import { Icon } from '../components/ui/Icons.jsx';
import PriorityBadge from '../components/ui/PriorityBadge.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { formatDuration } from '../lib/dateUtils.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { tasks, sortedGoals, stats, toggleTask } = useApp();

  const pending = tasks.filter((t) => !t.completed);
  const todayPending = [...pending].sort(
    (a, b) => (getPriority(a.priority).value - getPriority(b.priority).value) || ((a.deadline || '') < (b.deadline || '') ? -1 : 1),
  );
  const upcoming = pending.filter((t) => t.deadline && t.deadline >= todayISO())
    .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))
    .slice(0, 5);

  const weekBars = (stats?.perDay || []).slice(-7);
  const maxCompleted = Math.max(4, ...weekBars.map((d) => d.completed));
  const maxFocus = Math.max(4, ...weekBars.map((d) => d.focusMinutes));

  const scheduledToday = todayPending.filter((t) => t.scheduledStart);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---------- Greeting ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{greeting()} 👋</h1>
          <p className="mt-1 text-sm text-sub">{dateLabel(todayISO())} — here&rsquo;s your day at a glance.</p>
        </div>
        <Link to="/app/assistant" className="btn-primary self-start sm:self-auto">
          <Icon name="sparkles" className="h-4 w-4" />
          Build today&rsquo;s schedule
        </Link>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon="checkCircle" label="Completed today" value={String(stats?.completedToday ?? 0)} accent="text-ok" />
        <StatCard icon="timer" label="Focus today" value={formatDuration(stats?.focusMinutesToday ?? 0)} accent="text-brand" />
        <StatCard icon="zap" label="Day streak" value={String(stats?.currentStreak ?? 0)} accent="text-amber-500" />
        <StatCard icon="flag" label="Pending tasks" value={String(stats?.pending ?? 0)} accent="text-sub" sub={stats?.overdue ? `${stats.overdue} overdue` : ''} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ---------- Today's schedule ---------- */}
        <section className="card lg:col-span-2 flex flex-col">
          <header className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Icon name="calendarClock" className="h-4 w-4 text-brand" />
              Today&rsquo;s focus
            </h2>
            <Link to="/app/tasks" className="text-xs font-semibold text-brand hover:underline">
              Manage tasks
            </Link>
          </header>
          <div className="px-3 pb-3 flex-1">
            {todayPending.length === 0 ? (
              <EmptyState
                icon="checkCircle"
                title="All clear for today"
                blurb="Enjoy the calm — you've planned a great day. Or add a task to keep the momentum going."
                action={<Link to="/app/tasks" className="btn-primary btn-sm">Add a task</Link>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {todayPending.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl group">
                    <button
                      type="button"
                      onClick={() => toggleTask(t.id)}
                      className="btn-icon shrink-0"
                      aria-label={`Complete ${t.title}`}
                    >
                      <span className="h-5.5 w-5.5 rounded-full border-2 border-line group-hover:border-brand grid place-items-center transition-colors">
                        <span className="h-2 w-2 rounded-full bg-transparent group-hover:bg-brand transition-colors" />
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                      {t.deadline && <p className="text-xs text-faint">Due {shortLabel(t.deadline)}</p>}
                    </div>
                    {t.scheduledStart && (
                      <span className="chip bg-brand/10 text-brand hidden sm:inline-flex">
                        {hhmmTo12(t.scheduledStart.split('T')[1]?.slice(0, 5) || t.scheduledStart)}
                      </span>
                    )}
                    <PriorityBadge value={t.priority} />
                  </li>
                ))}
              </ul>
            )}
            {scheduledToday.length > 0 && todayPending.length > 6 && (
              <p className="pt-2 text-xs text-faint text-center">
                {todayPending.length - 6} more waiting in Tasks
              </p>
            )}
          </div>
        </section>

        {/* ---------- Right column ---------- */}
        <div className="space-y-4">
          {/* Goal progress */}
          <section className="card p-4">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Icon name="target" className="h-4 w-4 text-brand" />
                Goal progress
              </h2>
              <Link to="/app/goals" className="text-xs font-semibold text-brand hover:underline">All goals</Link>
            </header>
            {sortedGoals.length === 0 ? (
              <p className="text-sm text-faint py-4 text-center">No goals yet — define what matters.</p>
            ) : (
              <ul className="space-y-3.5">
                {sortedGoals.slice(0, 3).map((g) => (
                  <li key={g.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-ink truncate mr-2">{g.title}</span>
                      <span className="text-faint shrink-0">{g.progress}%</span>
                    </div>
                    <ProgressBar value={g.progress} barClassName="bg-brand" size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Productivity pulse */}
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 mb-3">
              <Icon name="trending" className="h-4 w-4 text-ok" />
              Last 7 days
            </h2>
            <div className="flex items-end justify-between gap-1.5 h-24" aria-hidden="true">
              {weekBars.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.completed} done, ${d.focusMinutes}m focus`}>
                  <div className="w-full flex items-end justify-center gap-1" style={{ height: '100%' }}>
                    <div className="w-1/2 rounded-t bg-brand/80 group-hover:bg-brand transition-colors" style={{ height: `${Math.max(6, (d.completed / maxCompleted) * 100)}%` }} />
                    <div className="w-1/2 rounded-t bg-ok/70 group-hover:bg-ok transition-colors" style={{ height: `${Math.max(6, (d.focusMinutes / maxFocus) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-faint">{shortLabel(d.date).split(' ')[1]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Tasks done</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" /> Focus (min)</span>
            </div>
          </section>

          {/* AI teaser */}
          <Link to="/app/assistant" className="block card p-4 group hover:shadow-pop transition-shadow">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand to-emerald-400 grid place-items-center text-white shrink-0">
                <Icon name="sparkles" className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink group-hover:text-brand transition-colors">
                  Generate my perfect schedule
                </p>
                <p className="text-xs text-faint truncate">Goals, deadlines & constraints → AI plan</p>
              </div>
              <Icon name="arrowR" className="h-4 w-4 text-faint group-hover:text-brand transition-colors" />
            </div>
          </Link>
        </div>
      </div>

      {/* ---------- Upcoming ---------- */}
      <section className="card">
        <header className="px-5 pt-4 pb-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <Icon name="flag" className="h-4 w-4 text-brand" />
            Upcoming deadlines
          </h2>
        </header>
        <div className="px-3 pb-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-faint text-center py-4">Nothing with a deadline coming up. Enjoy the margin.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-4 px-2 py-2.5">
                  <span className="w-20 shrink-0 text-xs font-bold text-sub">
                    {shortLabel(addDays(t.deadline, 0))}
                  </span>
                  <p className="flex-1 text-sm font-medium text-ink truncate">{t.title}</p>
                  <PriorityBadge value={t.priority} showLabel />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div className="card p-4">
      <div className={`h-9 w-9 rounded-xl bg-brand/10 grid place-items-center ${accent}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs text-sub mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-danger mt-0.5">{sub}</p>}
    </div>
  );
}