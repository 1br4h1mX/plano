import { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import TaskEditor from '../components/tasks/TaskEditor.jsx';
import TaskItem from '../components/tasks/TaskItem.jsx';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { Icon } from '../components/ui/Icons.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { CATEGORY_LIST } from '../lib/eisenhower.js';

const STATUS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'overdue', label: 'Overdue' },
];

export default function Tasks() {
  const { tasks, addTask, updateTask, deleteTask } = useApp();
  const [editor, setEditor] = useState(null); // null | {} (new) | task (edit)
  const [toDelete, setToDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (status === 'open' && t.completed) return false;
      if (status === 'done' && !t.completed) return false;
      if (status === 'overdue' && (!t.deadline || t.deadline >= new Date().toISOString().slice(0, 10) || t.completed)) return false;
      if (category !== 'all' && t.category !== category) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, status, category, query]);

  const openCount = tasks.filter((t) => !t.completed).length;
  const doneCount = tasks.length - openCount;

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Tasks</h1>
          <p className="mt-1 text-sm text-sub">{openCount} open · {doneCount} completed</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditor({})}>
          <Icon name="plus" className="h-4 w-4" />
          New task
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 md:max-w-xs">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            className="input !pl-9"
            placeholder="Search tasks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl ariaLabel="Task status" options={STATUS} value={status} onChange={setStatus} />
          <select className="input !w-auto !py-2" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {CATEGORY_LIST.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No tasks match"
            blurb={tasks.length === 0 ? 'Add your first task and it will show up here.' : 'Try clearing search or filters.'}
            action={tasks.length === 0 ? (
              <button type="button" className="btn-primary btn-sm" onClick={() => setEditor({})}>Add your first task</button>
            ) : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((t) => (
              <TaskItem key={t.id} task={t} onEdit={setEditor} onDelete={setToDelete} />
            ))}
          </ul>
        )}
      </section>

      {editor !== null && (
        <TaskEditor
          initial={Object.keys(editor).length ? editor : null}
          onClose={() => setEditor(null)}
          onSave={(values) => {
            if (editor.id) updateTask(editor.id, values);
            else addTask(values);
            setEditor(null);
          }}
        />
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete task?"
        description={`"${toDelete?.title}" will be permanently removed.`}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                deleteTask(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-sub">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}