import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp.js';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { Icon } from '../components/ui/Icons.jsx';
import {
  todayISO, toISO, addDays, getWeekDates, monthGrid,
  toMinutes, fromMinutes, DAY_NAMES_SHORT, MONTH_NAMES, shortLabel, hhmmTo12, dateLabel,
} from '../lib/dateUtils.js';
import { categoryColor } from '../lib/eisenhower.js';

const ROW_H = 44;
const HOURS = 24;

const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export default function CalendarPage() {
  const { tasks, scheduleTask } = useApp();
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(todayISO());
  const [drag, setDrag] = useState(null);
  const [schedFor, setSchedFor] = useState(null); // modal to schedule an unscheduled task
  const gridRef = useRef(null);
  const colRefs = useRef([]);

  const days = useMemo(() => {
    if (view === 'month') return [];
    const base = view === 'day' ? anchor : getWeekDates(anchor)[0];
    const count = view === 'day' ? 1 : 7;
    return Array.from({ length: count }, (_, i) => addDays(base, i));
  }, [view, anchor]);

  const month = useMemo(() => {
    if (view !== 'month') return [];
    return monthGrid(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1);
  }, [view, anchor]);

  const scheduled = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.scheduledStart?.includes('T')) return;
      const date = t.scheduledStart.slice(0, 10);
      const start = toMinutes(t.scheduledStart.slice(11, 16));
      const end = t.scheduledEnd?.includes('T')
        ? toMinutes(t.scheduledEnd.slice(11, 16))
        : start + (t.estimatedMinutes || 60);
      if (!map[date]) map[date] = [];
      map[date].push({ task: t, start, end });
    });
    return map;
  }, [tasks]);

  const unscheduled = tasks.filter((t) => !t.completed && !t.scheduledStart?.includes('T'));

  /* ---------- pointer drag ---------- */
  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      if (
        e.clientY < rect.top || e.clientY > rect.bottom ||
        e.clientX < rect.left || e.clientX > rect.right
      ) {
        setDrag((d) => d && { ...d, target: null, trash: false });
        return;
      }
      const y = e.clientY - rect.top + gridRef.current.scrollTop;
      const startMin = Math.min(23 * 60, Math.max(0, Math.floor(y / ROW_H / 0.5) * 30));

      let col = 0;
      colRefs.current.forEach((ref, i) => {
        if (ref && ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right) col = i;
        }
      });
      const date = days[col] || anchor;
      setDrag((d) => d && { ...d, target: { date, startMin }, trash: false });
    };
    const onUp = () => {
      if (!drag) return;
      if (drag.target && !drag.trash) {
        const { task, target } = drag;
        const endMin = Math.min(23 * 60, target.startMin + Math.max(30, task.estimatedMinutes || 60));
        scheduleTask(
          task.id,
          fromMinutes(target.startMin),
          fromMinutes(endMin),
          target.date,
        );
      }
      if (drag.trash) {
        scheduleTask(drag.task.id, null, null, null);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, days, anchor, scheduleTask]);

  const startDrag = (e, task, trashRef) => {
    e.preventDefault();
    setDrag({ task, target: null, trash: trashRef || false });
  };

  const nav = (dir) => {
    if (view === 'month') {
      const [y, m] = anchor.slice(0, 7).split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setAnchor(toISO(new Date(d.getFullYear(), d.getMonth(), 1)));
    } else {
      setAnchor(addDays(anchor, dir * (view === 'day' ? 1 : 7)));
    }
  };

  const todayInView = view === 'month' ? month.includes(todayISO()) : days.includes(todayISO());

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Calendar</h1>
          <p className="mt-1 text-sm text-sub">
            {view === 'month'
              ? `${MONTH_NAMES[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}`
              : `${dateLabel(days[0])}${days.length > 1 ? ` – ${shortLabel(days[days.length - 1])}` : ''}`}
            {todayInView && <span className="ml-2 chip bg-ok/10 text-ok">Today</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 card !bg-surface px-1 py-1">
            <button type="button" className="btn-icon !h-8 !w-8" onClick={() => nav(-1)} aria-label="Previous">
              <Icon name="chevL" className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost btn-sm px-3" onClick={() => setAnchor(todayISO())}>Today</button>
            <button type="button" className="btn-icon !h-8 !w-8" onClick={() => nav(1)} aria-label="Next">
              <Icon name="chevR" className="h-4 w-4" />
            </button>
          </div>
          <SegmentedControl ariaLabel="Calendar view" options={VIEWS} value={view} onChange={setView} />
        </div>
      </header>

      {/* Unscheduled tray */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-sub shrink-0">Unscheduled:</span>
        {unscheduled.length === 0 ? (
          <span className="text-xs text-faint">everything is on the calendar 🎉</span>
        ) : (
          unscheduled.map((t) => (
            <button
              key={t.id}
              type="button"
              draggable
              onDragStart={(e) => startDrag(e, t, false)}
              onPointerDown={(e) => startDrag(e, t, false)}
              className="chip bg-elevated border border-line text-ink shrink-0 cursor-grab active:cursor-grabbing select-none"
              style={{ borderLeft: `3px solid ${categoryColor(t.category)}` }}
              title="Drag onto the calendar, or click to schedule"
              onClick={() => setSchedFor(t)}
            >
              <Icon name="grip" className="h-3 w-3 text-faint" />
              {t.title}
            </button>
          ))
        )}
      </div>

      {/* ---------- Month ---------- */}
      {view === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="px-2 py-2 text-[11px] font-bold text-sub text-center border-r border-line last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {month.map((date, i) => {
              if (!date) return <div key={`e${i}`} className="min-h-[92px] border-r border-line border-b" />;
              const items = scheduled[date] || [];
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => { setAnchor(date); setView('day'); }}
                  className={`min-h-[92px] p-2 text-left border-r border-line border-b transition-colors hover:bg-elevated/60 cursor-pointer ${
                    date === todayISO() ? 'bg-brand-soft/60' : ''
                  }`}
                >
                  <span className={`text-xs font-bold ${date === todayISO() ? 'text-brand' : 'text-sub'}`}>{Number(date.slice(8, 10))}</span>
                  {items.map(({ task }) => (
                    <p key={task.id} className="mt-1 truncate rounded-md px-1.5 py-0.5 text-[11px] text-white font-medium"
                      style={{ background: categoryColor(task.category) }}>
                      {hhmmTo12(fromMinutes(task.start))} {task.title}
                    </p>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- Day / Week grid ---------- */}
      {view !== 'month' && (
        <div className="card overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            {/* header row */}
            <div className="border-b border-line flex items-end justify-end pb-2 pr-2 h-16" aria-hidden="true" />
            {days.map((d, i) => {
              const isToday = d === todayISO();
              const dow = new Date(`${d}T12:00:00`).getDay();
              return (
                <div key={d} className={`border-b border-l border-line h-16 pb-2 px-2 flex flex-col justify-end ${isToday ? 'bg-brand-soft/50' : ''}`}>
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-brand' : 'text-faint'}`}>{DAY_NAMES_SHORT[dow]}</span>
                  <span className={`text-lg font-extrabold leading-tight ${isToday ? 'text-brand' : 'text-ink'}`}>{Number(d.slice(8, 10))}</span>
                </div>
              );
            })}

            {/* time gutter */}
            <div ref={gridRef} className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div className="relative" aria-hidden="true">
                {Array.from({ length: HOURS }, (_, h) => h + 1).map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-faint" style={{ top: h * ROW_H }}>
                    {h === 24 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
                  </div>
                ))}
              </div>

              {days.map((d, col) => {
                const items = (scheduled[d] || []).sort((a, b) => a.start - b.start);
                return (
                  <div
                    key={d}
                    ref={(el) => { colRefs.current[col] = el; }}
                    className={`relative border-l border-line ${d === todayISO() ? 'bg-brand-soft/30' : ''}`}
                    style={{ height: HOURS * ROW_H }}
                    onClick={(e) => {
                      const rect = gridRef.current.getBoundingClientRect();
                      const y = e.clientY - rect.top + gridRef.current.scrollTop;
                      const startMin = Math.max(0, Math.min(23 * 60, Math.floor(y / ROW_H) * 60));
                      setSchedFor({ _drop: { date: d, startMin } });
                    }}
                  >
                    {Array.from({ length: HOURS }, (_, h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-line/60" style={{ top: h * ROW_H }} />
                    ))}

                    {items.map(({ task, start, end }) => (
                      <div
                        key={task.id}
                        className="block-slot absolute left-1 right-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white cursor-grab active:cursor-grabbing shadow-card select-none overflow-hidden z-10"
                        style={{
                          top: start * (ROW_H / 60) + 2,
                          height: (end - start) * (ROW_H / 60) - 4,
                          background: categoryColor(task.category),
                          opacity: drag?.target?.date === d && drag?.task?.id === task.id ? 0.4 : 1,
                        }}
                        title={`${task.title} — drag to reschedule`}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => { e.stopPropagation(); startDrag(e, task, false); }}
                        onDragStart={(e) => startDrag(e, task, false)}
                        draggable
                      >
                        <span className="block truncate">{task.title}</span>
                        <span className="block truncate opacity-80">{hhmmTo12(fromMinutes(start))} – {hhmmTo12(fromMinutes(end))}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* drag feedback */}
      {drag && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 card px-4 py-2.5 shadow-pop">
          <span className="chip bg-brand/10 text-brand">{drag.task.title}</span>
          {drag.target ? (
            <span className="text-xs font-semibold text-ink">
              {shortLabel(drag.target.date)} · {hhmmTo12(fromMinutes(drag.target.startMin))}–{hhmmTo12(fromMinutes(Math.min(23 * 60, drag.target.startMin + Math.max(30, drag.task.estimatedMinutes || 60))))}
            </span>
          ) : drag.trash ? (
            <span className="text-xs font-semibold text-danger">Drop here to remove from calendar</span>
          ) : (
            <span className="text-xs text-faint">Move over the grid to place…</span>
          )}
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => setDrag((d) => d && { ...d, trash: true, target: null })}
          >
            <Icon name="trash" className="h-3.5 w-3.5" /> Unschedule
          </button>
        </div>
      )}

      {/* Schedule dialog */}
      {schedFor && <ScheduleDialog task={schedFor} tasks={unscheduled} anchor={anchor} onClose={() => setSchedFor(null)} onSave={scheduleTask} />}
    </div>
  );
}

function ScheduleDialog({ task, tasks, anchor, onClose, onSave }) {
  const drop = task?._drop || null;
  const [selectedId, setSelectedId] = useState(task?.id && !drop ? task.id : tasks[0]?.id || '');
  const [date, setDate] = useState(drop?.date || anchor);
  const [start, setStart] = useState(drop?.startMin != null ? fromMinutes(Math.floor(drop.startMin)) : '09:00');
  const [duration, setDuration] = useState(60);

  const selected = tasks.find((t) => t.id === selectedId);
  const effDuration = selected?.estimatedMinutes || duration;

  const submit = () => {
    if (!selected) return;
    const realDuration = selected.estimatedMinutes || duration;
    onSave(selected.id, start, fromMinutes(toMinutes(start) + realDuration), date);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule a task"
      description={drop ? `Place on ${dateLabel(date)}` : 'Choose the task and when it fits.'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!selected} onClick={submit}>
            Add to calendar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="sch-task">Task</label>
          <select id="sch-task" className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="sch-date">Date</label>
            <input id="sch-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="sch-time">Start</label>
            <input id="sch-time" className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="sch-dur">Duration</label>
            <input id="sch-dur" className="input" type="number" min="15" step="15" value={effDuration} onChange={(e) => setDuration(Number(e.target.value) || 60)} disabled={Boolean(selected?.estimatedMinutes)} />
          </div>
        </div>
        <p className="text-xs text-faint">
          Need something you can drag? In week/day view, drag a chip from the "Unscheduled" tray straight onto the grid.
        </p>
      </div>
    </Modal>
  );
}