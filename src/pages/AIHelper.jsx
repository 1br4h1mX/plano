import { useEffect, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import { api } from '../lib/api.js';
import { buildPlannerInput, contextLines } from '../lib/plannerInput.js';
import { Icon } from '../components/ui/Icons.jsx';
import Modal from '../components/ui/Modal.jsx';
import { dateLabel, hhmmTo12, todayISO, shortLabel } from '../lib/dateUtils.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const WELCOME = [
  {
    role: 'assistant',
    content:
      'Hi, I\u2019m Plano, your planning copilot. 👋\n\nTell me what\u2019s on your plate and I\u2019ll help you protect time for what matters. Want to start? Hit "Generate my perfect schedule" and I\u2019ll turn your tasks, goals, deadlines and energy profile into a balanced week you can drop straight onto the calendar.',
  },
];

const TYPE_STYLE = {
  task: 'border-brand bg-brand/5 text-ink',
  goal: 'border-emerald-500 bg-emerald-500/5 text-ink',
  commitment: 'border-slate-400 bg-slate-400/5 text-ink',
  break: 'border-amber-500 bg-amber-500/5 text-ink',
  buffer: 'border-violet-500 bg-violet-500/5 text-ink',
  focus: 'border-brand bg-brand/5 text-ink',
};
const TYPE_DOT = {
  task: 'bg-brand',
  goal: 'bg-emerald-500',
  commitment: 'bg-slate-400',
  break: 'bg-amber-500',
  buffer: 'bg-violet-500',
  focus: 'bg-brand',
};
const TYPE_LABEL = {
  task: 'Task',
  goal: 'Goal step',
  commitment: 'Commitment',
  break: 'Break',
  buffer: 'Buffer',
  focus: 'Focus',
};

export default function AIHelper() {
  const { tasks, goals, settings, stats, scheduleTask } = useApp();
  const [messages, setMessages] = useLocalStorage('plano:chat', WELCOME);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planSource, setPlanSource] = useState('llm');
  const [planBusy, setPlanBusy] = useState(false);
  const [aiReady, setAiReady] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [fixDay, setFixDay] = useState(false);
  const [fixDate, setFixDate] = useState(todayISO());
  const [toast, setToast] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    api.aiHealth().then((r) => setAiReady(r.aiConfigured)).catch(() => setAiReady(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [messages, plan, review, busy, planBusy]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text, ts: Date.now() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const ctx = contextLines({ tasks, goals, settings, stats });
      const { reply } = await api.chat(
        next.map(({ role, content }) => ({ role, content })),
        ctx,
      );
      setMessages((m) => [...m, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${err.message}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setPlanBusy(true);
    try {
      const res = await api.generateSchedule(buildPlannerInput({ tasks, goals, settings, days: 7 }));
      setPlan(res.plan);
      setPlanSource(res.source);
      setReview(null);
      if (res.warnings?.length) flash(res.warnings[0]);
    } catch (err) {
      flash(`Could not generate: ${err.message}`);
    } finally {
      setPlanBusy(false);
    }
  };

  const doFixWeek = async () => {
    setFixDay(false);
    setPlanBusy(true);
    try {
      const res = await api.reschedule(fixDate, buildPlannerInput({ tasks, goals, settings, days: 7 }));
      setPlan(res.plan);
      setPlanSource('local');
      setReview(null);
      flash(`Rebuilt your week from ${shortLabel(fixDate)}.`);
    } catch (err) {
      flash(`Could not rebuild: ${err.message}`);
    } finally {
      setPlanBusy(false);
    }
  };

  const applyPlan = () => {
    if (!plan) return;
    let n = 0;
    plan.days.forEach((d) => {
      d.blocks.forEach((b) => {
        if (b.type === 'task' && b.taskId) {
          scheduleTask(b.taskId, b.start, b.end, d.date);
          n += 1;
        }
      });
    });
    flash(n > 0 ? `Added ${n} task(s) to the calendar.` : 'No scheduled tasks to apply — add tasks with deadlines first.');
  };

  const runReview = async () => {
    setReviewBusy(true);
    try {
      const res = await api.weeklyReview({
        completedTasks: stats?.totalCompleted || 0,
        focusMinutes: stats?.focusMinutesTotal || 0,
        streaks: { current: stats?.currentStreak || 0, best: stats?.bestStreak || 0 },
        daysActive: stats?.activeDays || 0,
      });
      setPlan(null);
      setReview(res.review);
    } catch (err) {
      setReview(`Review failed: ${err.message}`);
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand to-emerald-400 grid place-items-center text-white">
              <Icon name="sparkles" className="h-4.5 w-4.5" />
            </span>
            AI Assistant
          </h1>
          <p className="mt-1 text-sm text-sub">
            {aiReady === false
              ? 'Running on the built-in engine — fully on-device, no backend needed. Connect a server + LLM key for the extended experience.'
              : aiReady
                ? 'Connected to your LLM provider. Ask anything about your week.'
                : 'Checking assistant status…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline" onClick={runReview} disabled={reviewBusy}>
            <Icon name="chart" className="h-4 w-4" />
            Weekly review
          </button>
          <button type="button" className="btn-outline" onClick={() => setFixDay(true)}>
            <Icon name="refresh" className="h-4 w-4" />
            Fix my week
          </button>
          <button type="button" className="btn-primary" onClick={generate} disabled={planBusy}>
            <Icon name="sparkles" className="h-4 w-4" />
            {planBusy ? 'Planning…' : 'Generate my schedule'}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* ---------------- Chat ---------------- */}
        <section className="card lg:col-span-2 flex flex-col h-[520px] lg:sticky lg:top-20">
          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <Message key={i} msg={m} />
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-elevated border border-line px-4 py-2.5">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={send} className="border-t border-line p-3 flex items-center gap-2">
            <input
              className="input !py-2.5"
              placeholder="Ask about your week, or say 'I'm overwhelmed'…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Message the assistant"
            />
            <button type="submit" className="btn-primary !px-3.5 shrink-0" disabled={busy || !input.trim()} aria-label="Send message">
              <Icon name="send" className="h-4.5 w-4.5" />
            </button>
          </form>
        </section>

        {/* ---------------- Plan / review ---------------- */}
        <div className="lg:col-span-3 space-y-4">
          {planBusy ? (
            <section className="card p-10 flex flex-col items-center gap-4 text-center">
              <span className="h-12 w-12 rounded-2xl bg-brand/10 grid place-items-center">
                <Icon name="sparkles" className="h-6 w-6 text-brand animate-pulse" />
              </span>
              <div>
                <p className="font-bold text-ink">Building your perfect schedule…</p>
                <p className="text-sm text-sub mt-1">Prioritizing, balancing, protecting your energy.</p>
              </div>
            </section>
          ) : plan ? (
            <SchedulePanel
              plan={plan}
              source={planSource}
              onApply={applyPlan}
              onRegenerate={generate}
              hasTasks={plan.days.some((d) => d.blocks.some((b) => b.type === 'task' && b.taskId))}
            />
          ) : review ? (
            <section className="card p-6">
              <header className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink">Weekly review</h2>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setReview(null)}>
                  <Icon name="close" className="h-4 w-4" /> Dismiss
                </button>
              </header>
              <div className="text-sm text-sub whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {review}
              </div>
            </section>
          ) : (
            <section className="card p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-brand/10 text-brand grid place-items-center mx-auto mb-4">
                <Icon name="sparkles" className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-ink">Your perfect schedule, one click away</h2>
              <p className="mt-2 text-sm text-sub max-w-md mx-auto leading-relaxed">
                The assistant reads your open tasks, goals, working hours, work & energy profile and
                fixed commitments — then returns a balanced week with breaks, buffers and daily goal steps.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-faint">
                <span className="chip bg-elevated border border-line">Eisenhower prioritization</span>
                <span className="chip bg-elevated border border-line">Breaks & buffer included</span>
                <span className="chip bg-elevated border border-line">Goal steps split daily</span>
                <span className="chip bg-elevated border border-line">One-click calendar</span>
              </div>
              <button type="button" className="btn-primary mt-6" onClick={generate}>
                <Icon name="zap" className="h-4 w-4" />
                Generate my perfect schedule
              </button>
            </section>
          )}
        </div>
      </div>

      {/* fix week modal */}
      <Modal
        open={fixDay}
        onClose={() => setFixDay(false)}
        title="Fix my week"
        description="Life happened — let's rebuild from where you are now. Choose the day things fell apart."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setFixDay(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={doFixWeek}>
              <Icon name="sparkles" className="h-4 w-4" />
              Rebuild from this day
            </button>
          </>
        }
      >
        <label className="label" htmlFor="fix-date">Restart planning from</label>
        <input id="fix-date" className="input" type="date" value={fixDate} max={todayISO()} onChange={(e) => setFixDate(e.target.value)} />
        <p className="mt-3 text-xs text-faint">
          Everything before this date stays untouched. Tasks already on your calendar will be re-placed from here if they overlap.
        </p>
      </Modal>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 card px-4 py-2.5 text-sm font-semibold text-ink shadow-pop animate-pop-in">
          {toast}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed animate-slide-up ${
          isUser
            ? 'rounded-tr-sm bg-brand text-white'
            : 'rounded-tl-sm bg-elevated border border-line text-ink'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function SchedulePanel({ plan, source, onApply, onRegenerate, hasTasks }) {
  const [expanded, setExpanded] = useState({});

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line bg-elevated/40">
        <div>
          <h2 className="font-bold text-ink flex items-center gap-2">
            <Icon name="calendarClock" className="h-4.5 w-4.5 text-brand" />
            Your {plan.days.length}-day schedule
          </h2>
          <p className="text-xs text-faint mt-0.5">
            {plan.summary.minutesPlanned} min planned · {plan.summary.tasksPlanned} task(s)
            {source === 'llm' ? ' · generated by AI' : ' · built by local engine'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={onRegenerate}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={onApply} disabled={!hasTasks}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Add to calendar
          </button>
        </div>
      </header>

      {/* insights & tips */}
      {(plan.summary.insights?.length || plan.summary.tips?.length) && (
        <div className="px-5 py-3 border-b border-line space-y-2">
          {plan.summary.insights?.map((s, i) => (
            <p key={`i${i}`} className="text-xs text-sub flex gap-2">
              <Icon name="sparkles" className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
              {s}
            </p>
          ))}
          {plan.summary.tips?.map((s, i) => (
            <p key={`t${i}`} className="text-xs text-sub flex gap-2">
              <Icon name="zap" className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              {s}
            </p>
          ))}
        </div>
      )}

      <div className="divide-y divide-line max-h-[52vh] overflow-y-auto">
        {plan.days.map((day) => {
          const open = expanded[day.date] ?? true;
          return (
            <div key={day.date} className="px-5 py-3">
              <button
                type="button"
                className="w-full flex items-center justify-between text-left cursor-pointer"
                onClick={() => setExpanded((e) => ({ ...e, [day.date]: !open }))}
                aria-expanded={open}
              >
                <span className="text-sm font-bold text-ink">{dateLabel(day.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand">
                    {day.blocks.filter((b) => b.type === 'task' || b.type === 'goal' || b.type === 'focus').length} blocks
                  </span>
                  <Icon name={open ? 'chevL' : 'chevR'} className={`h-4 w-4 text-faint transform transition-transform ${open ? '' : 'rotate-90'}`} />
                </span>
              </button>
              {open && (
                <ul className={`mt-2 space-y-1.5 ${open ? 'animate-fade-in' : ''}`}>
                  {day.blocks.length === 0 && <li className="text-xs text-faint py-1">Nothing scheduled — a light day, by design.</li>}
                  {day.blocks.map((b, i) => (
                    <li
                      key={`${b.title}${i}`}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${TYPE_STYLE[b.type] || TYPE_STYLE.task}`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${TYPE_DOT[b.type] || TYPE_DOT.task}`} />
                      <span className="w-24 shrink-0 text-xs font-bold text-sub tabular-nums">
                        {hhmmTo12(b.start)} – {hhmmTo12(b.end)}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{b.title}</span>
                      <span className="chip bg-surface border border-line text-faint hidden sm:inline-flex">
                        {TYPE_LABEL[b.type] || b.type}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}