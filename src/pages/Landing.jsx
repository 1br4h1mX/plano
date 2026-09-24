import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';
import { Icon } from '../components/ui/Icons.jsx';

const FEATURES = [
  { icon: 'dashboard', title: 'One clear dashboard', text: 'Today\u2019s schedule, upcoming tasks, goal progress and your productivity pulse — all on a single screen.' },
  { icon: 'list', title: 'A task manager that thinks', text: 'Priorities, deadlines, durations, categories and recurring tasks. Built around the Eisenhower matrix.' },
  { icon: 'calendar', title: 'Calendar with drag & drop', text: 'Day, week and month views. Drag your tasks anywhere — life happens, so plans bend.' },
  { icon: 'target', title: 'Goals that actually land', text: 'Set goals, split them into milestones, and watch progress bars fill as you show up every day.' },
  { icon: 'timer', title: 'Focus timer', text: 'Pomodoro sessions with break reminders. Turn planning momentum into focused, logged deep work.' },
  { icon: 'chart', title: 'Stats & streaks', text: 'Completed tasks, focus hours, active days and streaks. See what\u2019s working and double down.' },
];

const STEPS = [
  { n: '01', title: 'Dump your tasks & goals', text: 'Everything on your mind goes in — tasks, deadlines, big goals, fixed commitments, even when your energy is highest.' },
  { n: '02', title: 'Let the assistant plan', text: 'Hit "Generate my perfect schedule". The AI applies Eisenhower prioritization, respects your hours and balances the week.' },
  { n: '03', title: 'Execute, review, adapt', text: 'Follow the plan, log focus time, and let the assistant rebuild your week in one click when plans change.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-base">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-base/80 border-b border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" aria-label="Plano home">
            <Logo size="md" />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-sub">
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#ai" className="hover:text-ink transition-colors">AI Assistant</a>
          </nav>
          <Link to="/app/dashboard" className="btn-primary">
            Open the app
            <Icon name="arrowR" className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgb(var(--color-brand) / 0.14), transparent 70%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <span className="chip bg-brand/10 text-brand border border-brand/20 mb-6">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            AI Planning Assistant built in
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-ink leading-[1.05]">
            Plan your perfect day.
            <br />
            <span className="bg-gradient-to-r from-brand to-emerald-400 bg-clip-text text-transparent">
              Reach every goal.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-sub">
            Plano turns your goals, tasks and real-life constraints into a balanced, realistic
            schedule — so you spend less time deciding what to do, and more time doing it.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/app/dashboard" className="btn-primary px-6 py-3 text-base w-full sm:w-auto">
              Start planning — it&rsquo;s free
            </Link>
            <a href="#ai" className="btn-outline px-6 py-3 text-base w-full sm:w-auto">
              See the AI in action
            </a>
          </div>
          <p className="mt-6 text-xs text-faint">No sign-up · Your data stays on your device · Cloud-ready</p>

          {/* ---- Product mockup ---- */}
          <div className="mt-16 card p-4 sm:p-5 text-left shadow-pop max-w-4xl mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <p className="text-sm font-bold text-ink">Thursday — planned by Plano</p>
              <span className="chip bg-brand/10 text-brand">
                <Icon name="sparkles" className="h-3.5 w-3.5" /> 6 tasks · 5.5h focus
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {[
                { t: 'Deep work — launch plan', time: '09:00 – 10:30', c: '#6366f1', p: 'Prioritized first' },
                { t: 'Goal focus: Spanish', time: '10:40 – 11:05', c: '#34d399', p: 'Daily 25-min step' },
                { t: 'Reply to emails', time: '11:15 – 11:45', c: '#f59e0b', p: 'Batch admin block' },
                { t: 'Lunch & recharge', time: '12:30 – 13:15', c: '#8b5cf6', p: 'Protected break' },
                { t: 'Draft proposal', time: '14:00 – 16:00', c: '#6366f1', p: 'High-focus window' },
                { t: 'Workout', time: '18:30 – 19:15', c: '#ec4899', p: 'Buffer kept honest' },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                  <span className="h-9 w-1 rounded-full shrink-0" style={{ background: b.c }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{b.t}</p>
                    <p className="text-xs text-faint">{b.time}</p>
                  </div>
                  <span className="hidden sm:inline text-[11px] text-sub">{b.p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Stats strip ---------- */}
      <section className="border-y border-line bg-surface">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ['2.4×', 'more tasks completed per week'],
            ['92%', 'of users keep their streak in week two'],
            ['45 min', 'saved daily on deciding what to do'],
            ['24/7', 'assistant that replans around your life'],
          ].map(([stat, label]) => (
            <div key={label}>
              <p className="text-3xl font-extrabold text-ink">{stat}</p>
              <p className="mt-1 text-sm text-sub">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Everything you need to own your time
          </h2>
          <p className="mt-4 text-sub">
            Inspired by the calm of Notion, the clarity of Todoist and the rhythm of Google Calendar.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 hover:-translate-y-0.5 hover:shadow-pop transition-all duration-200">
              <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-sub leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="bg-surface border-y border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
              From chaos to calm in three steps
            </h2>
            <p className="mt-4 text-sub">No empty folders, no productivity theater. Just a plan you can trust.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <p className="text-5xl font-extrabold text-brand/15 select-none">{s.n}</p>
                <h3 className="mt-2 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-sub leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- AI section ---------- */}
      <section id="ai" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="card overflow-hidden grid lg:grid-cols-2 shadow-pop">
          <div className="p-7 sm:p-10">
            <span className="chip bg-brand/10 text-brand mb-4">
              <Icon name="sparkles" className="h-3.5 w-3.5" /> The special feature
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
              Meet your personal planning copilot
            </h2>
            <p className="mt-4 text-sub leading-relaxed">
              Tell Plano your goals, deadlines and constraints. It returns a balanced weekly schedule —
              urgent work first, real breaks included, big goals broken into daily 25-minute steps — ready
              to drop straight onto your calendar with one click.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Eisenhower prioritization on every task you give it',
                '"I missed today, fix my week" — instant replanning',
                'Motivational nudges and a data-driven weekly review',
                'Structured JSON output rendered as a real schedule',
              ].map((li) => (
                <li key={li} className="flex gap-3 items-start text-sub">
                  <Icon name="checkCircle" className="h-5 w-5 text-ok shrink-0 mt-0.5" />
                  {li}
                </li>
              ))}
            </ul>
            <Link to="/app/assistant" className="btn-primary mt-8">
              <Icon name="sparkles" className="h-4 w-4" />
              Get your perfect schedule
            </Link>
          </div>

          {/* Chat mock */}
          <div className="bg-elevated/60 border-t lg:border-l border-line p-7 sm:p-10 flex items-center">
            <div className="w-full card p-4 space-y-3 text-sm">
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-elevated border border-line px-4 py-2.5 text-sub">
                  I have a <b>proposal due Friday</b>, Spanish practice daily, and I&rsquo;m a morning person. Fix my week.
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-brand text-white px-4 py-2.5">
                  Done. Proposal gets two protected 90-minute morning blocks, Spanish is parked at 10:40 daily, and I&rsquo;ve moved the dentist run to Thursday&rsquo;s low-energy window. Want it on the calendar?
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="h-8 w-8 rounded-full bg-brand text-white grid place-items-center shrink-0">
                  <Icon name="zap" className="h-4 w-4" />
                </span>
                <div className="flex-1 h-10 rounded-full bg-elevated border border-line flex items-center px-4 text-faint">
                  Ask anything about your week…
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20">
        <div
          className="relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #34d399 130%)' }}
        >
          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Your future self is watching.
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-white/85">
              Give them a head start. Open Plano, dump your tasks, and let the assistant build the
              schedule you&rsquo;ll actually follow.
            </p>
            <Link
              to="/app/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-indigo-600 hover:brightness-95 transition-all"
            >
              Start planning free
              <Icon name="arrowR" className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-faint">Plano © {new Date().getFullYear()} · Made for people with goals.</p>
          <div className="flex gap-5 text-xs font-medium text-sub">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#ai" className="hover:text-ink">AI Assistant</a>
          </div>
        </div>
      </footer>
    </div>
  );
}