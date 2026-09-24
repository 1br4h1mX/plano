import { useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import Modal from '../components/ui/Modal.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { Icon } from '../components/ui/Icons.jsx';
import { shortLabel, todayISO } from '../lib/dateUtils.js';

const COLORS = ['#6366f1', '#34d399', '#60a5fa', '#f59e0b', '#ec4899', '#8b5cf6'];

const emptyGoal = { title: '', description: '', targetDate: '', color: COLORS[0] };
const emptyMilestone = { title: '', dueDate: '' };

export default function Goals() {
  const {
    goals, goalsWithProgress, sortedGoals,
    addGoal, updateGoal, deleteGoal,
    addMilestone, updateMilestone, deleteMilestone,
  } = useApp();

  const [editor, setEditor] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [milestoneFor, setMilestoneFor] = useState(null);

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Goals</h1>
          <p className="mt-1 text-sm text-sub">
            {sortedGoals.length} active · avg {sortedGoals.length ? Math.round(sortedGoals.reduce((s, g) => s + g.progress, 0) / sortedGoals.length) : 0}% complete
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditor({})}>
          <Icon name="plus" className="h-4 w-4" />
          New goal
        </button>
      </header>

      {sortedGoals.length === 0 ? (
        <section className="card">
          <EmptyState
            icon="target"
            title="Set a goal that excites you"
            blurb="Goals break into milestones, and milestones turn into daily 25-minute focus steps your planner will protect automatically."
            action={<button type="button" className="btn-primary btn-sm" onClick={() => setEditor({})}>Create your first goal</button>}
          />
        </section>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sortedGoals.map((g) => {
            const recent = g.milestones.filter((m) => m.achieved).length;
            const targetDate = g.targetDate;
            return (
              <section key={g.id} className="card p-5 flex flex-col" style={{ borderTop: `3px solid ${g.color}` }}>
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-ink truncate">{g.title}</h2>
                    {g.description && <p className="mt-1 text-sm text-sub line-clamp-2">{g.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="btn-icon !h-8 !w-8" onClick={() => setEditor(g)} aria-label="Edit goal">
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-icon !h-8 !w-8 hover:!text-danger" onClick={() => setToDelete(g)} aria-label="Delete goal">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-faint font-medium">{recent}/{g.milestones.length} milestones</span>
                    <span className="font-bold text-ink">{g.progress}%</span>
                  </div>
                  <ProgressBar value={g.progress} barClassName="" styleColor={g.color} />
                </div>

                {targetDate && (
                  <p className="mt-3 text-xs text-faint flex items-center gap-1.5">
                    <Icon name="flag" className="h-3.5 w-3.5" />
                    Target {shortLabel(targetDate)}
                    {targetDate < todayISO() && <span className="text-danger font-semibold">· overdue</span>}
                    {targetDate >= todayISO() && (
                      <span className="text-sub">
                        · {Math.max(0, Math.round((new Date(`${targetDate}T12:00:00`) - new Date()) / 86400000))} days left
                      </span>
                    )}
                  </p>
                )}

                {/* Milestones */}
                <ul className="mt-4 space-y-1.5 flex-1">
                  {g.milestones.length === 0 && (
                    <li className="text-xs text-faint py-1">No milestones yet — break the goal into steps.</li>
                  )}
                  {g.milestones.map((m) => (
                    <li key={m.id} className="group flex items-center gap-2.5 group">
                      <button
                        type="button"
                        onClick={() => updateMilestone(g.id, m.id, { achieved: !m.achieved })}
                        aria-label={m.achieved ? `Mark "${m.title}" as not achieved` : `Mark "${m.title}" as achieved`}
                        className={`h-5 w-5 shrink-0 rounded-md border-2 grid place-items-center transition-colors cursor-pointer ${
                          m.achieved ? 'bg-ok border-ok text-white' : 'border-line hover:border-ok'
                        }`}
                      >
                        {m.achieved && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                      </button>
                      <span className={`flex-1 text-sm ${m.achieved ? 'text-faint line-through' : 'text-sub'}`}>{m.title || 'Untitled step'}</span>
                      {m.dueDate && <span className="text-[11px] text-faint shrink-0">{shortLabel(m.dueDate)}</span>}
                      <button type="button" className="btn-icon !h-6 !w-6 opacity-0 group-hover:opacity-100 hover:!text-danger" onClick={() => deleteMilestone(g.id, m.id)} aria-label="Delete milestone">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="mt-4 btn-outline btn-sm self-start"
                  onClick={() => setMilestoneFor(g.id)}
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                  Add milestone
                </button>
              </section>
            );
          })}
        </div>
      )}

      {/* Goal editor */}
      {editor !== null && (
        <GoalEditor
          initial={Object.keys(editor).length ? editor : null}
          onClose={() => setEditor(null)}
          onSave={(values) => {
            if (editor.id) updateGoal(editor.id, values);
            else addGoal(values);
            setEditor(null);
          }}
        />
      )}

      {/* Milestone editor */}
      {milestoneFor && (
        <MilestoneEditor
          onClose={() => setMilestoneFor(null)}
          onSave={(values) => { addMilestone(milestoneFor, values); setMilestoneFor(null); }}
        />
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete goal?"
        description={`"${toDelete?.title}" and all its milestones will be removed.`}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
            <button type="button" className="btn-danger" onClick={() => { deleteGoal(toDelete.id); setToDelete(null); }}>
              Delete goal
            </button>
          </>
        }
      >
        <p className="text-sm text-sub">Your tasks are not affected.</p>
      </Modal>
    </div>
  );
}

function GoalEditor({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    ...emptyGoal,
    ...initial,
    targetDate: initial?.targetDate || '',
  });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Name your goal so the planner can protect time for it.');
    onSave({ ...form, title: form.title.trim(), targetDate: form.targetDate || null });
  };

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit goal' : 'New goal'} description="Big outcomes, broken into milestones the assistant turns into daily steps.">
      <form id="goal-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="goal-title">Goal</label>
          <input id="goal-title" className="input" autoFocus placeholder="e.g. Learn Spanish in 3 months" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <div>
          <label className="label" htmlFor="goal-desc">Why it matters (optional)</label>
          <textarea id="goal-desc" className="input min-h-[64px] resize-y" placeholder="The reason you'll keep showing up…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="goal-date">Target date</label>
            <input id="goal-date" className="input" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 pt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use ${c}`}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full transition-transform ${form.color === c ? 'scale-110 ring-2 ring-offset-2 ring-brand' : 'hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <footer className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">{initial ? 'Save changes' : 'Create goal'}</button>
        </footer>
      </form>
    </Modal>
  );
}

function MilestoneEditor({ onClose, onSave }) {
  const [form, setForm] = useState(emptyMilestone);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Give the milestone a name.');
    onSave({ ...form, title: form.title.trim(), dueDate: form.dueDate || null });
  };

  return (
    <Modal open onClose={onClose} title="Add milestone" description="A concrete, checkable step toward your goal.">
      <form id="mile-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="mile-title">Milestone</label>
          <input id="mile-title" className="input" autoFocus placeholder="e.g. Finish unit 6 of the course" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <div>
          <label className="label" htmlFor="mile-date">Due (optional)</label>
          <input id="mile-date" className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <footer className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Add milestone</button>
        </footer>
      </form>
    </Modal>
  );
}