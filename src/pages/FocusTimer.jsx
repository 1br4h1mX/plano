import { useEffect, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import { Icon } from '../components/ui/Icons.jsx';
import { formatDuration } from '../lib/dateUtils.js';

const MODES = {
  focus: { label: 'Focus', tone: '#6366f1', blurb: 'Deep work. Phone away, water nearby.' },
  short: { label: 'Short break', tone: '#34d399', blurb: 'Stand up, stretch, look at something far away.' },
  long: { label: 'Long break', tone: '#f59e0b', blurb: 'You earned it. Take a real pause.' },
};

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660 + i * 110;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.35);
    });
  } catch { /* audio not available */ }
}

function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}

export default function FocusTimer() {
  const { settings, tasks, sessions, addSession, updateSettings } = useApp();
  const pom = settings.pomodoro || { focus: 25, shortBreak: 5, longBreak: 15, roundsBeforeLong: 4 };

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.startedAt?.startsWith(today));
  const sessionsToday = todaySessions.length;
  const minutesToday = todaySessions.reduce((s, x) => s + (x.durationMinutes || 0), 0);

  const [mode, setMode] = useState('focus');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(pom.focus * 60);
  const [round, setRound] = useState(1);
  const [taskId, setTaskId] = useState('');

  const endRef = useRef(null);
  const leftRef = useRef(left);
  const modeRef = useRef(mode);
  const roundRef = useRef(round);
  leftRef.current = left;
  modeRef.current = mode;
  roundRef.current = round;

  const totalSeconds = {
    focus: (pom.focus || 25) * 60,
    short: (pom.shortBreak || 5) * 60,
    long: (pom.longBreak || 15) * 60,
  }[mode] || 25 * 60;

  const activeTask = tasks.find((t) => t.id === taskId) || null;

  const switchTo = (nextMode, auto = false) => {
    setMode(nextMode);
    setLeft(totalSecondsFor(nextMode));
    setRunning(false);
    if (auto && nextMode !== 'focus') notify('Plano — time for a break', MODES[nextMode].blurb);
    beep();
  };

  function totalSecondsFor(m) {
    return {
      focus: (pom.focus || 25) * 60,
      short: (pom.shortBreak || 5) * 60,
      long: (pom.longBreak || 15) * 60,
    }[m] || 25 * 60;
  }

  const complete = () => {
    if (modeRef.current === 'focus') {
      addSession({ durationMinutes: Math.round((pom.focus || 25)), taskId: taskId || null });
      const isLong = roundRef.current >= (pom.roundsBeforeLong || 4);
      switchTo(isLong ? 'long' : 'short', true);
      setRound(isLong ? 1 : roundRef.current + 1);
    } else {
      switchTo('focus');
      notify('Plano — back to focus', 'Break over. One more round?');
    }
  };

  // ticker
  useEffect(() => {
    if (!running) return undefined;
    endRef.current = Date.now() + leftRef.current * 1000;
    const t = setInterval(() => {
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      leftRef.current = rem;
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(t);
        setRunning(false);
        complete();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // keyboard shortcut
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const start = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setLeft(totalSeconds);
  };

  const percent = 1 - left / totalSeconds;
  const C = 2 * Math.PI * 86;
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const timeLabel = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const tone = MODES[mode].tone;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2) };
  });
  const maxMins = Math.max(
    30,
    ...last7Days.map((d) => sessions.filter((s) => s.startedAt?.startsWith(d.date)).reduce((s, x) => s + (x.durationMinutes || 0), 0)),
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Focus timer</h1>
        <p className="mt-1 text-sm text-sub">Pomodoro rhythm with break reminders. Space to start/pause.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timer card */}
        <section className="card p-6 lg:col-span-2 flex flex-col items-center">
          <div className="flex items-center gap-2">
            {Object.entries(MODES).map(([k, m]) => (
              <button
                key={k}
                type="button"
                onClick={() => { switchTo(k); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
                  mode === k ? 'text-white shadow-card' : 'text-sub hover:text-ink bg-surface'
                }`}
                style={mode === k ? { background: m.tone } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="relative mt-8" style={{ width: 240, height: 240 }}>
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="86" fill="none" stroke="rgb(var(--color-line))" strokeWidth="10" />
              <circle
                cx="100" cy="100" r="86" fill="none"
                stroke={tone} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * percent}
                style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold text-ink tabular-nums" aria-live="polite">{timeLabel}</span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: tone }}>
                {running ? MODES[mode].label : 'Paused'}
              </span>
              <span className="mt-1 text-[11px] text-faint">Round {round}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-sub text-center max-w-sm">{MODES[mode].blurb}</p>

          <div className="mt-6 flex items-center gap-3">
            <button type="button" className="btn-outline btn-icon !h-11 !w-11" onClick={reset} aria-label="Reset timer">
              <Icon name="refresh" className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="btn-primary !px-8 !py-3 !rounded-2xl text-base"
              onClick={() => (running ? setRunning(false) : start())}
            >
              <Icon name={running ? 'pause' : 'play'} className="h-5 w-5" />
              {running ? 'Pause' : 'Start focus'}
            </button>
          </div>

          {/* Session logging */}
          <div className="mt-6 w-full max-w-md">
            <label className="label" htmlFor="timer-task">Working on (optional)</label>
            <select id="timer-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">Just focusing — no task linked</option>
              {tasks.filter((t) => !t.completed).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        </section>

        {/* Side panel */}
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink mb-3">Today&rsquo;s focus stats</h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-elevated p-3">
                <p className="text-xl font-extrabold text-ink">{sessionsToday}</p>
                <p className="text-[11px] text-faint mt-0.5">sessions</p>
              </div>
              <div className="rounded-xl bg-elevated p-3">
                <p className="text-xl font-extrabold text-ink">{formatDuration(minutesToday)}</p>
                <p className="text-[11px] text-faint mt-0.5">focus time</p>
              </div>
            </div>
            {activeTask && (
              <p className="mt-3 text-xs text-sub truncate">
                Last session logged against <span className="font-semibold text-ink">“{activeTask.title}”</span>
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink mb-3">Work / break settings</h2>
            <div className="space-y-3 text-sm">
              {[
                ['Focus length', 'focus', 'focus'],
                ['Short break', 'shortBreak', 'shortBreak'],
                ['Long break', 'longBreak', 'longBreak'],
                ['Rounds before long break', 'roundsBeforeLong', 'roundsBeforeLong'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sub">{label}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn-outline btn-sm !px-2"
                      onClick={() => updateSettings({ pomodoro: { ...pom, [key]: Math.max(1, (pom[key] || 1) - 1) } })}>
                      −
                    </button>
                    <span className="w-10 text-center font-semibold text-ink tabular-nums">
                      {pom[key]}{key.endsWith('Break') || key === 'focus' ? 'm' : ''}
                    </span>
                    <button type="button" className="btn-outline btn-sm !px-2"
                      onClick={() => updateSettings({ pomodoro: { ...pom, [key]: Math.min(key === 'roundsBeforeLong' ? 8 : 90, (pom[key] || 1) + 1) } })}>
                      +
                    </button>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink mb-2">Pro tips</h2>
            <ul className="space-y-1.5 text-xs text-sub leading-relaxed">
              <li>• Match each focus round with the exact task from your plan.</li>
              <li>• Breaks are scheduled by the assistant — respect them.</li>
              <li>• Every completed round feeds your Statistics page.</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-ink">Focus pattern — this week</h2>
          <span className="text-xs text-faint">minutes per day</span>
        </div>
        <div className="flex items-end gap-3 h-20">
          {last7Days.map((d) => {
            const mins = sessions.filter((s) => s.startedAt?.startsWith(d.date)).reduce((s, x) => s + (x.durationMinutes || 0), 0);
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                <div className="w-full rounded-t-lg bg-brand/70" style={{ height: `${Math.max(6, (mins / maxMins) * 64)}px` }} title={`${mins} min`}>
                  <div className="sr-only">{mins} minutes on {d.date}</div>
                </div>
                <span className="text-[10px] text-faint">{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}