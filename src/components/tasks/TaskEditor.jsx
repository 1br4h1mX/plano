import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { PRIORITIES } from '../../lib/eisenhower.js';
import { CATEGORY_LIST } from '../../lib/eisenhower.js';
import { Icon } from '../ui/Icons.jsx';

const RECURRING = [
  { value: null, label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const empty = {
  title: '',
  priority: 2,
  category: 'Work',
  estimatedMinutes: 30,
  deadline: '',
  recurring: null,
  notes: '',
};

export default function TaskEditor({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...empty, ...initial, deadline: initial?.deadline || '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (form.title) setError('');
  }, [form.title]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Give the task a name — even a short one. 😊');
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      deadline: form.deadline || null,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit task' : 'New task'}
      description="Visible on your dashboard and available to the planning assistant."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="task-form" className="btn-primary">
            {initial ? 'Save changes' : 'Add task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="task-title">Task name</label>
          <input
            id="task-title"
            className="input"
            autoFocus
            placeholder="e.g. Review launch checklist"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="task-priority">Priority</label>
            <select id="task-priority" className="input" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="task-category">Category</label>
            <select id="task-category" className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORY_LIST.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="task-duration">Estimated time (min)</label>
            <input
              id="task-duration"
              className="input"
              type="number"
              min="5"
              max="600"
              step="5"
              value={form.estimatedMinutes}
              onChange={(e) => set('estimatedMinutes', Math.max(5, Number(e.target.value) || 30))}
            />
          </div>
          <div>
            <label className="label" htmlFor="task-deadline">Deadline</label>
            <input
              id="task-deadline"
              className="input"
              type="date"
              value={form.deadline || ''}
              onChange={(e) => set('deadline', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="task-recurring">Repeats</label>
          <select id="task-recurring" className="input" value={form.recurring || ''} onChange={(e) => set('recurring', e.target.value || null)}>
            {RECURRING.map((r) => (
              <option key={String(r.value)} value={r.value || ''}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="task-notes">Notes</label>
          <textarea
            id="task-notes"
            className="input min-h-[72px] resize-y"
            placeholder="Context, links, next steps…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        {initial && (
          <p className="flex items-center gap-1.5 text-[11px] text-faint">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Created {new Date(initial.createdAt).toLocaleDateString()}
          </p>
        )}
      </form>
    </Modal>
  );
}