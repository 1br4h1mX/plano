import { useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import { Icon } from '../components/ui/Icons.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import Modal from '../components/ui/Modal.jsx';
import { DAY_NAMES } from '../lib/dateUtils.js';
import { getAIConfig, saveAIConfig, clearAIConfig, providerLabel } from '../lib/aiConfig.js';
import { testConnection } from '../lib/llm.js';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const ENERGY = [
  { value: 'morning', label: 'Morning person', icon: 'sun' },
  { value: 'evening', label: 'Evening person', icon: 'moon' },
  { value: 'balanced', label: 'Balanced', icon: 'zap' },
];

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first

export default function Settings() {
  const { settings, updateSettings, resetAll, stats } = useApp();
  const [commitment, setCommitment] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [aiForm, setAiForm] = useState(() => {
    const c = getAIConfig();
    return { provider: c.provider, apiKey: c.apiKey, model: c.model };
  });
  const [showKey, setShowKey] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [testing, setTesting] = useState(false);

  const h = settings.workingHours || { start: '09:00', end: '18:00' };
  const workDays = settings.workDays || [1, 2, 3, 4, 5];

  const toggleWorkDay = (d) => {
    const next = workDays.includes(d) ? workDays.filter((x) => x !== d) : [...workDays, d];
    updateSettings({ workDays: next });
  };

  const setHours = (key, value) => updateSettings({ workingHours: { ...h, [key]: value } });

  const addCommitment = (values) => {
    updateSettings({ commitments: [...(settings.commitments || []), values] });
  };
  const removeCommitment = (id) => {
    updateSettings({ commitments: (settings.commitments || []).filter((c) => c.id !== id) });
  };

  const saveKey = () => {
    if (!aiForm.apiKey.trim()) return;
    const c = saveAIConfig(aiForm);
    setAiForm({ provider: c.provider, apiKey: c.apiKey, model: c.model });
    setAiStatus(`Saved — requests now go straight to ${providerLabel(c.provider)} from your browser.`);
  };

  const testKey = async () => {
    if (!aiForm.apiKey.trim()) return;
    setTesting(true);
    setAiStatus(`Testing connection to ${providerLabel(aiForm.provider)}…`);
    try {
      await testConnection(aiForm.provider, aiForm.apiKey.trim(), aiForm.model);
      setAiStatus(`Connected — ${providerLabel(aiForm.provider)} accepted your key.`);
    } catch (err) {
      setAiStatus(`Connection failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const removeKey = () => {
    clearAIConfig();
    setAiForm({ provider: 'gemini', apiKey: '', model: '' });
    setAiStatus('Key removed — the built-in engine is active.');
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-sub">Everything the planner needs to respect your real life.</p>
      </header>

      {/* Appearance */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Appearance</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-sub">Theme</p>
          <SegmentedControl ariaLabel="Theme" options={THEMES} value={settings.theme || 'light'} onChange={(v) => updateSettings({ theme: v })} />
        </div>
        <p className="mt-4 text-xs text-faint">Time zone: {settings.timezone || 'auto'} — dates always follow your local calendar.</p>
      </section>

      {/* Working hours */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Working hours</h2>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div>
            <label className="label" htmlFor="wh-start">Start</label>
            <input id="wh-start" className="input" type="time" value={h.start} onChange={(e) => setHours('start', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="wh-end">End</label>
            <input id="wh-end" className="input" type="time" value={h.end} onChange={(e) => setHours('end', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <p className="label">Work days</p>
          <div className="flex flex-wrap gap-2">
            {DAY_ORDER.map((d) => {
              const on = workDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWorkDay(d)}
                  aria-pressed={on}
                  className={`h-10 w-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    on ? 'bg-brand text-white shadow-card' : 'bg-elevated text-sub border border-line hover:text-ink'
                  }`}
                >
                  {DAY_NAMES[d].slice(0, 2)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Energy profile */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-1">Energy profile</h2>
        <p className="text-sm text-sub mb-4">Tells the planner when to put your hardest work.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {ENERGY.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => updateSettings({ energy: e.value })}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                settings.energy === e.value
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-sub hover:text-ink'
              }`}
            >
              <Icon name={e.icon} className="h-4.5 w-4.5" />
              {e.label}
            </button>
          ))}
        </div>
      </section>

      {/* AI provider — bring your own key */}
      <section className="card p-5" id="ai-provider">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Icon name="sparkles" className="h-4 w-4 text-brand" />
              AI power — bring your own key
            </h2>
            <p className="text-xs text-faint mt-0.5">
              Optional. Connect a free Google Gemini key (no card needed) — or use Anthropic/OpenAI. Calls go straight from your browser to the provider.
            </p>
          </div>
          {aiForm.apiKey && (
            <button type="button" className="btn-ghost btn-sm !text-danger shrink-0" onClick={removeKey}>
              <Icon name="trash" className="h-3.5 w-3.5" /> Remove key
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="label">Provider</p>
            <SegmentedControl
              ariaLabel="AI provider"
              options={PROVIDERS}
              value={aiForm.provider}
              onChange={(v) => setAiForm((f) => ({ ...f, provider: v }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="ai-model">Model (optional)</label>
            <input
              id="ai-model"
              className="input"
              placeholder={
                aiForm.provider === 'openai' ? 'gpt-4o-mini'
                  : aiForm.provider === 'gemini' ? 'gemini-3.8-flash'
                    : 'claude-sonnet-4-20250514'
              }
              value={aiForm.model}
              onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="ai-key">API key</label>
          <div className="flex gap-2">
            <input
              id="ai-key"
              className="input flex-1 font-mono"
              type={showKey ? 'text' : 'password'}
              placeholder={
                aiForm.provider === 'gemini' ? 'AIza…'
                  : aiForm.provider === 'openai' ? 'sk-…'
                    : 'sk-ant-…'
              }
              value={aiForm.apiKey}
              onChange={(e) => setAiForm((f) => ({ ...f, apiKey: e.target.value }))}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="button"
              className="btn-outline !px-3 shrink-0 text-xs font-semibold"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={saveKey} disabled={!aiForm.apiKey.trim()}>
            Save key
          </button>
          <button type="button" className="btn-outline btn-sm" onClick={testKey} disabled={!aiForm.apiKey.trim() || testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {getAIConfig().apiKey === aiForm.apiKey && aiForm.apiKey && (
            <span className="chip bg-ok/10 text-ok">Active</span>
          )}
        </div>

        {aiStatus && (
          <p className={`mt-3 text-xs ${aiStatus.startsWith('Connected') || aiStatus.startsWith('Saved') ? 'text-ok' : 'text-danger'}`}>
            {aiStatus}
          </p>
        )}
        <p className="mt-3 text-xs text-faint">
          Your key is stored only in this browser and sent only to {providerLabel(aiForm.provider)}. If it fails, the built-in engine takes over automatically.
        </p>
        {aiForm.provider === 'gemini' && (
          <p className="mt-2 text-xs">
            No key yet?{' '}
            <a className="text-brand font-semibold hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Get a free Google Gemini API key
            </a>{' '}
            — no credit card required.
          </p>
        )}
      </section>

      {/* Notifications */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Notifications</h2>
        <div className="divide-y divide-line">
          {[
            ['notifications', 'breaks', 'Break reminders', 'Get nudged when a Pomodoro break starts'],
            ['notifications', 'dailyPlan', 'Daily plan prompt', 'A gentle morning reminder to review today\u2019s plan'],
            ['notifications', 'sounds', 'Sounds', 'Audible cues when focus sessions end'],
          ].map(([group, key, label, sub]) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-faint">{sub}</p>
              </div>
              <Toggle
                checked={Boolean(settings[group]?.[key])}
                onChange={(v) => updateSettings({ notifications: { ...(settings.notifications || {}), [key]: v } })}
                ariaLabel={label}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Fixed commitments */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-ink">Fixed commitments</h2>
            <p className="text-xs text-faint mt-0.5">Work shifts, classes, team syncs — the assistant protects these.</p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => setCommitment({})}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {!settings.commitments?.length ? (
          <p className="text-sm text-faint py-3 text-center">No fixed commitments yet. Sleep is assumed automatically.</p>
        ) : (
          <ul className="space-y-2">
            {settings.commitments.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{c.title}</p>
                  <p className="text-xs text-faint">
                    {c.start}–{c.end} · {c.days?.length ? c.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ') : 'Every day'}
                  </p>
                </div>
                <button type="button" className="btn-icon !h-8 !w-8 hover:!text-danger" onClick={() => removeCommitment(c.id)} aria-label={`Remove ${c.title}`}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* About / reset */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-ink mb-1">Data & storage</h2>
        <p className="text-sm text-sub mb-4">
          Everything lives in your browser\u2019s localStorage — {stats?.totalTasks || 0} task(s), {stats?.totalCompleted || 0} completed, {stats?.sessionsCount || 0} focus session(s). The only external traffic is the AI requests you opt into: your own backend, or the provider you keyed above.
        </p>
        <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
          Reset all data
        </button>
      </section>

      {commitment !== null && (
        <CommitmentEditor
          onClose={() => setCommitment(null)}
          onSave={(values) => {
            addCommitment({ ...values, id: `c${Date.now()}` });
            setCommitment(null);
          }}
        />
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data?"
        description="Tasks, goals, sessions and settings will be replaced with the starter sample."
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => { resetAll(); setConfirmReset(false); }}
            >
              Yes, reset everything
            </button>
          </>
        }
      >
        <p className="text-sm text-sub">This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function CommitmentEditor({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', start: '10:00', end: '10:30', days: [1, 2, 3, 4, 5] });
  const [allDays, setAllDays] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (d) => {
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Name the commitment.');
    onSave({ ...form, title: form.title.trim(), days: allDays ? [...form.days, ...DAY_ORDER.filter((d) => !form.days.includes(d))] : form.days.length ? form.days : [0, 1, 2, 3, 4, 5, 6] });
  };

  return (
    <Modal open onClose={onClose} title="Add fixed commitment" description="This time is protected in every schedule the assistant builds.">
      <form id="commit-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="c-title">Name</label>
          <input id="c-title" className="input" autoFocus placeholder="e.g. Team standup, Gym, Lecture" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-start">Starts</label>
            <input id="c-start" className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-end">Ends</label>
            <input id="c-end" className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
        </div>
        <div>
          <p className="label" id="c-days-label">Repeats</p>
          <div className="flex flex-wrap gap-2 items-center">
            {DAY_ORDER.map((d) => {
              const on = form.days.includes(d) || allDays;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setAllDays(false); toggleDay(d); }}
                  aria-pressed={on}
                  className={`h-9 w-9 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    on ? 'bg-brand text-white' : 'bg-elevated text-sub border border-line hover:text-ink'
                  }`}
                >
                  {DAY_NAMES[d].slice(0, 2)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAllDays((v) => !v)}
              className={`ml-1 chip cursor-pointer ${allDays ? 'bg-brand text-white' : 'bg-elevated border border-line text-sub'}`}
            >
              Every day
            </button>
          </div>
        </div>
        <footer className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save commitment</button>
        </footer>
      </form>
    </Modal>
  );
}