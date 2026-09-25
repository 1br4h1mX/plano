import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp.js';
import { ai } from '../lib/aiClient.js';
import { getAIConfig, providerLabel } from '../lib/aiConfig.js';
import { buildPlannerInput } from '../lib/plannerInput.js';
import { resolveOps } from '../lib/operations.js';
import { Icon } from '../components/ui/Icons.jsx';
import Modal from '../components/ui/Modal.jsx';
import { dateLabel, hhmmTo12, todayISO, shortLabel } from '../lib/dateUtils.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const WELCOME = [
  {
    role: 'assistant',
    content:
      'Hi, I\u2019m Plano, your planning copilot. 👋\n\nTell me what\u2019s on your plate and I\u2019ll protect time for it. Ask me to add a task to your calendar (\u201cAdd 2 hours of Python this week\u201d), move or resize something, or hit "Generate my perfect schedule" for a balanced week.',
  },
];

/* Undo survives page navigation (and reloads) via localStorage:
   every applied proposal stores the exact tasks snapshot it started from. */
const LAST_APPLY_KEY = 'plano:last-apply:v1';

function readLastApply() {
  try {
    const raw = localStorage.getItem(LAST_APPLY_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || !Array.isArray(rec.before)) return null;
    if (Date.now() - (rec.at || 0) > 24 * 3600 * 1000) return null;
    return rec;
  } catch {
    return null;
  }
}

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

/** Remembers the last task the user talked about, so follow-ups ("2 hours",
    "move that to Friday") can resolve their pronouns. */
function subjectFrom(ops, tasks) {
  let subject = '';
  (ops || []).forEach((op) => {
    if (op.title) subject = op.title;
    else if (op.taskId) {
      const t = (tasks || []).find((x) => x.id === op.taskId);
      if (t) subject = t.title;
    }
  });
  return subject || null;
}

export default function AIHelper() {
  const { tasks, goals, settings, stats, scheduleTask, applyOps, restoreTasks } = useApp();
  const [messages, setMessages] = useLocalStorage('plano:chat', WELCOME);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planSource, setPlanSource] = useState('llm');
  const [planBusy, setPlanBusy] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [choice, setChoice] = useState({});
  const [undoBanner, setUndoBanner] = useState(() => readLastApply());
  const [aiReady, setAiReady] = useState(null);
  const [ownKey, setOwnKey] = useState(() => Boolean(getAIConfig().apiKey));
  const [ownKeyProvider, setOwnKeyProvider] = useState(() => getAIConfig().provider);
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [fixDay, setFixDay] = useState(false);
  const [fixDate, setFixDate] = useState(todayISO());
  const [toast, setToast] = useState('');
  const [subject, setSubject] = useLocalStorage('plano:topic', '');
  const listRef = useRef(null);

  useEffect(() => {
    ai.aiHealth().then((r) => setAiReady(r.aiConfigured)).catch(() => setAiReady(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [messages, plan, review, proposal, busy, planBusy]);

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
      const res = await ai.applyOps({ query: text, tasks, settings, subject });
      let ops = [];
      if (res.ops?.length) {
        const resolved = resolveOps({ tasks, settings, ops: res.ops });
        ops = resolved.ops;
        setProposal({ text: res.text, ops: ops.filter((o) => o.status !== 'conflict'), conflicts: resolved.conflicts, status: 'pending' });
        setChoice({});
        const topic = subjectFrom(ops, tasks);
        if (topic) setSubject(topic);
      } else {
        setProposal(null);
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.text || (ops.length ? 'Here\u2019s what I propose.' : ''), ts: Date.now() },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${err.message}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  /** Substitute the user's chosen alternative (if any) into the op list. */
  const buildApplyOps = () => {
    const out = [];
    for (let i = 0; i < (proposal?.ops || []).length; i += 1) {
      const op = proposal.ops[i];
      const sel = choice[i];
      if (sel && op.alternatives?.[sel - 1]) {
        const alt = op.alternatives[sel - 1];
        out.push({ ...op, ...alt, alternatives: undefined, status: 'ok', label: alt.label || op.label });
        (alt.extraOps || []).forEach((x) => out.push(x));
      } else {
        out.push(op);
      }
    }
    return out;
  };

  const applyProposal = () => {
    if (!proposal || proposal.status !== 'pending') return;
    const res = applyOps(buildApplyOps());
    const record = { at: Date.now(), before: res.before };
    try {
      localStorage.setItem(LAST_APPLY_KEY, JSON.stringify(record));
    } catch {
      /* storage unavailable — undo will still work this session */
    }
    setUndoBanner(record);
    setProposal({ ...proposal, status: 'applied', before: res.before });
    flash(res.created > 0 ? `Added ${res.created} item(s) to your calendar.` : 'Applied to your calendar.');
  };

  const cancelProposal = () => {
    setProposal(null);
    flash('Proposal cancelled — nothing changed.');
  };

  const doUndo = () => {
    const before = proposal?.before || undoBanner?.before;
    if (!before) return;
    restoreTasks(before);
    try {
      localStorage.removeItem(LAST_APPLY_KEY);
    } catch {
      /* ignore */
    }
    setUndoBanner(null);
    setProposal(null);
    flash('Undone — everything is back as it was.');
  };

  const generate = async () => {
    setPlanBusy(true);
    setProposal(null);
    try {
      const res = await ai.generateSchedule(buildPlannerInput({ tasks, goals, settings, days: 7 }));
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
    setProposal(null);
    try {
      const res = await ai.reschedule(fixDate, buildPlannerInput({ tasks, goals, settings, days: 7 }));
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
      const res = await ai.weeklyReview({
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
            {aiReady === false ? (
              <>
                Running on the built-in engine — fully on-device, no backend needed.{' '}
                <Link to="/app/settings" className="text-brand font-semibold hover:underline">Add your own API key</Link> to upgrade.
              </>
            ) : aiReady ? (
              ownKey
                ? `Using your personal ${providerLabel(ownKeyProvider)} key — requests go straight from your browser to the provider.`
                : 'Connected to your LLM provider. Ask anything about your week.'
            ) : (
              'Checking assistant status…'
            )}
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
        {undoBanner && proposal?.status !== 'applied' && (
          <div className="lg:col-span-2 card !flex-row items-center justify-between gap-3 px-4 py-3 border-emerald-500/40 bg-emerald-500/5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">AI change applied</p>
              <p className="text-xs text-sub truncate">
                You can still revert the last change the assistant made to your calendar.
              </p>
            </div>
            <button type="button" className="btn-outline btn-sm shrink-0" onClick={doUndo}>
              <Icon name="undo" className="h-3.5 w-3.5" /> Undo
            </button>
          </div>
        )}
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
          ) : proposal ? (
            <ProposalPanel
              proposal={proposal}
              choice={choice}
              onSelectChoice={(i, ndx) => setChoice((c) => ({ ...c, [i]: ndx }))}
              onApply={applyProposal}
              onCancel={cancelProposal}
              onUndo={doUndo}
            />
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

const OP_ICON = {
  create: 'plus',
  schedule: 'calendar',
  move: 'arrowR',
  resize: 'refresh',
  keep: 'calendar',
  unschedule: 'close',
  delete: 'trash',
  complete: 'check',
  priority: 'flag',
  deadline: 'chart',
};

const OP_COLOR = {
  create: 'text-brand',
  schedule: 'text-brand',
  move: 'text-violet-500',
  resize: 'text-amber-500',
  keep: 'text-slate-400',
  unschedule: 'text-slate-400',
  delete: 'text-rose-500',
  complete: 'text-emerald-500',
  priority: 'text-amber-500',
  deadline: 'text-sky-500',
};

function ProposalPanel({ proposal, onApply, onCancel, onUndo, choice = {}, onSelectChoice }) {
  const ops = proposal.ops || [];
  const applied = proposal.status === 'applied';
  return (
    <section className="card overflow-hidden animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line bg-elevated/40">
        <div className="flex items-center gap-2.5">
          <span className={`h-8 w-8 rounded-xl grid place-items-center ${applied ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand/10 text-brand'}`}>
            <Icon name={applied ? 'checkCircle' : 'sparkles'} className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-bold text-ink">{applied ? 'Applied to your calendar' : 'Proposed changes'}</h2>
            <p className="text-xs text-faint mt-0.5">
              {applied ? 'Your calendar is updated. You can undo this anytime.' : `${ops.length} change(s) ready — review and confirm.`}
            </p>
          </div>
        </div>
        {applied && (
          <button type="button" className="btn-outline btn-sm" onClick={onUndo}>
            <Icon name="undo" className="h-3.5 w-3.5" /> Undo
          </button>
        )}
      </header>

      {proposal.text && !applied && (
        <p className="px-5 pt-3 text-sm text-sub">{proposal.text}</p>
      )}

      <div className="px-5 py-3 space-y-2">
        {ops.length === 0 && (
          <p className="text-sm text-sub py-2">
            Nothing to change — the assistant found no actionable request.
          </p>
        )}
        {ops.map((op, i) => {
          const opName = op.displayKind || op.op;
          const icon = OP_ICON[opName] || 'calendar';
          const color = OP_COLOR[opName] || 'text-brand';
          const sel = choice[i] || 0;
          const altList = op.alternatives || [];
          return (
            <div key={`${op.op}${i}`} className="rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="flex items-start gap-3">
                <span className={`h-6 w-6 rounded-lg grid place-items-center shrink-0 ${color} bg-elevated`}>
                  <Icon name={icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{op.label}</p>
                  {op.note && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{op.note}</p>}
                </div>
                {op.status === 'adjusted' && (
                  <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">Adjusted</span>
                )}
              </div>

              {!applied && altList.length > 0 && (
                <div className="mt-2 ml-9 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-faint">Requested time is busy — pick one:</p>
                  {[
                    { label: op.label, note: op.note },
                    ...altList.map((a) => ({ label: a.label, note: a.note })),
                  ].map((opt, ai) => (
                    <label key={ai} className={`flex items-start gap-2 text-sm cursor-pointer rounded-lg px-2 py-1.5 ${sel === ai ? 'bg-brand/5 ring-1 ring-brand/30' : ''}`}>
                      <input
                        type="radio"
                        name={`alt-${i}`}
                        checked={sel === ai}
                        onChange={() => onSelectChoice(i, ai)}
                        className="accent-brand mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className={`font-medium ${sel === ai ? 'text-brand' : 'text-ink'}`}>{opt.label}</span>
                        {opt.note && <span className="block text-xs text-sub mt-0.5">{opt.note}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {proposal.conflicts?.length > 0 && (
        <div className="mx-5 mb-3 rounded-xl border border-line bg-elevated px-3 py-2.5 space-y-1">
          {proposal.conflicts.map((c, i) => (
            <p key={i} className="text-xs text-sub flex gap-2">
              <Icon name="close" className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              {c}
            </p>
          ))}
        </div>
      )}

      {!applied && (
        <footer className="px-5 py-4 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onApply} disabled={!ops.length}>
            <Icon name="check" className="h-4 w-4" /> Apply
          </button>
        </footer>
      )}
    </section>
  );
}