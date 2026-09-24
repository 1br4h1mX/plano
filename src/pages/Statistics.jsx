import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApp } from '../hooks/useApp.js';
import { Icon } from '../components/ui/Icons.jsx';
import { shortLabel } from '../lib/dateUtils.js';
import { formatDuration } from '../lib/dateUtils.js';
import { CATEGORY_COLORS } from '../lib/eisenhower.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgb(var(--color-surface))',
  border: '1px solid rgb(var(--color-line))',
  borderRadius: 12,
  fontSize: 12,
  color: 'rgb(var(--color-ink))',
  boxShadow: '0 8px 30px rgb(0 0 0 / 0.1)',
};

export default function Statistics() {
  const { sessions, tasks, stats } = useApp();
  const [range, setRange] = useState('14');

  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const chartData = useMemo(() => {
    const n = Number(range);
    return (stats?.perDay || []).slice(-n).map((d) => ({
      label: shortLabel(d.date),
      completed: d.completed,
      focusMinutes: d.focusMinutes,
    }));
  }, [stats, range]);

  const pieData = useMemo(
    () => Object.entries(stats?.byCategory || {})
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({ name, value: v.done, total: v.total })),
    [stats],
  );

  if (!stats) return null;

  const completionRate = stats.completionRate;

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Statistics</h1>
          <p className="mt-1 text-sm text-sub">Your momentum, measured honestly.</p>
        </div>
        <SegmentedControl ariaLabel="Chart range" options={RANGES} value={range} onChange={setRange} />
      </header>

      {/* overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card icon="checkCircle" color="text-ok" value={String(stats.totalCompleted)} label="Tasks completed" sub={`${stats.completedThisWeek} this week`} />
        <Card icon="timer" color="text-brand" value={formatDuration(stats.focusMinutesTotal)} label="Total focus time" sub={`${stats.sessionsCount} sessions`} />
        <Card icon="zap" color="text-amber-500" value={String(stats.currentStreak)} label="Current streak" sub={`best: ${stats.bestStreak} days`} />
        <Card icon="trending" color="text-emerald-500" value={`${completionRate}%`} label="Completion rate" sub={`${stats.totalCompleted}/${stats.totalTasks} tasks`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* completed bar chart */}
        <section className="card p-5">
          <h2 className="text-sm font-bold text-ink mb-4">Tasks completed per day</h2>
          {stats.totalCompleted === 0 ? (
            <EmptyState icon="inbox" title="No completions yet" blurb="Check some tasks off — the chart feeds itself." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--color-faint))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--color-faint))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(var(--color-brand-soft))' }} />
                <Bar dataKey="completed" name="Completed" fill="rgb(var(--color-brand))" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* focus area chart */}
        <section className="card p-5">
          <h2 className="text-sm font-bold text-ink mb-4">Focus minutes per day</h2>
          {stats.focusMinutesTotal === 0 ? (
            <EmptyState icon="timer" title="No focus logged yet" blurb="Try a first 25-minute session — stats love that." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--color-ok))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(var(--color-ok))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-line))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--color-faint))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--color-faint))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="focusMinutes" name="Focus (min)" stroke="rgb(var(--color-ok))" strokeWidth={2.5} fill="url(#focusFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* category pie */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Completions by category</h2>
        {pieData.length === 0 ? (
          <EmptyState icon="chart" title="Nothing to slice yet" blurb="Once you categorize and complete tasks, this fills in." />
        ) : (
          <div className="grid md:grid-cols-2 items-center gap-4">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} tasks`, 'Completed']} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2.5">
              {pieData.map((p) => {
                const ratio = p.total ? Math.round((p.value / p.total) * 100) : 0;
                return (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[p.name] || '#64748b' }} />
                    <span className="flex-1 text-sm text-sub">{p.name}</span>
                    <span className="text-sm font-semibold text-ink">{p.value}/{p.total}</span>
                    <span className="w-10 text-right text-xs text-faint">{ratio}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* sessions ledger */}
      <section className="card overflow-hidden">
        <header className="px-5 pt-4 pb-2">
          <h2 className="text-sm font-bold text-ink">Recent focus sessions</h2>
        </header>
        {sessions.length === 0 ? (
          <EmptyState icon="timer" title="No sessions yet" blurb="Your Pomodoro history will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {[...sessions].reverse().slice(0, 8).map((s) => {
              const t = tasksById[s.taskId];
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-8 w-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
                    <Icon name="timer" className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{t ? t.title : 'Unlinked focus session'}</p>
                    <p className="text-xs text-faint">{new Date(s.startedAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">{s.durationMinutes}m</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ icon, color, value, label, sub }) {
  return (
    <div className="card p-4">
      <Icon name={icon} className={`h-5 w-5 ${color}`} />
      <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs text-sub">{label}</p>
      {sub && <p className="text-[11px] text-faint mt-0.5">{sub}</p>}
    </div>
  );
}