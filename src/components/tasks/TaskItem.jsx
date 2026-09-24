import { useApp } from '../../hooks/useApp.js';
import { Icon } from '../ui/Icons.jsx';
import PriorityBadge from '../ui/PriorityBadge.jsx';
import { categoryColor } from '../../lib/eisenhower.js';
import { shortLabel, hhmmTo12, formatDuration } from '../../lib/dateUtils.js';
import { todayISO } from '../../lib/dateUtils.js';

export default function TaskItem({ task, onEdit, onDelete }) {
  const { toggleTask } = useApp();
  const overdue = task.deadline && task.deadline < todayISO() && !task.completed;

  return (
    <li className={`group flex items-start gap-3 px-4 py-3 ${overdue ? 'bg-danger/5' : ''}`}>
      <button
        type="button"
        onClick={() => toggleTask(task.id)}
        aria-label={task.completed ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        className={`mt-0.5 h-5.5 w-5.5 shrink-0 rounded-full border-2 grid place-items-center transition-colors cursor-pointer ${
          task.completed ? 'bg-ok border-ok text-white' : 'border-line hover:border-brand'
        }`}
      >
        {task.completed && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${task.completed ? 'text-faint line-through' : 'text-ink'}`}>
            {task.title}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(task.category) }} />
            {task.category}
          </span>
          {task.estimatedMinutes && <span className="inline-flex items-center gap-1"><Icon name="timer" className="h-3 w-3" />{formatDuration(task.estimatedMinutes)}</span>}
          {task.deadline && (
            <span className={overdue ? 'text-danger font-semibold' : ''}>
              Due {shortLabel(task.deadline)}{overdue ? ' · overdue' : ''}
            </span>
          )}
          {task.recurring?.frequency && (
            <span className="inline-flex items-center gap-1">
              <Icon name="refresh" className="h-3 w-3" />
              {task.recurring.frequency}
            </span>
          )}
          {task.scheduledStart && (
            <span className="inline-flex items-center gap-1 text-brand">
              <Icon name="calendar" className="h-3 w-3" />
              {task.scheduledStart.includes('T')
                ? hhmmTo12(task.scheduledStart.slice(11, 16))
                : hhmmTo12(task.scheduledStart)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <PriorityBadge value={task.priority} />
        <button type="button" className="btn-icon !h-8 !w-8" onClick={() => onEdit(task)} aria-label="Edit task">
          <Icon name="edit" className="h-4 w-4" />
        </button>
        <button type="button" className="btn-icon !h-8 !w-8 hover:!text-danger" onClick={() => onDelete(task)} aria-label="Delete task">
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}