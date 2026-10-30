import { useState } from 'react';
import { ListVideo, Pause, Play, Search, X } from 'lucide-react';
import type { Task } from '../../types';
import TaskCard from './TaskCard';
import { useT } from '../../i18n';
import { filterTasks, type QueueFilter } from './queueFilter';
import { useQueueStore } from './store';

interface TaskListProps {
  tasks: Task[];
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
  onCancel: (taskId: string) => void;
  onRetry: (task: Task) => void;
  onMove: (taskId: string, direction: 'up' | 'down') => void;
  onExpandPlaylist: (taskId: string) => void;
  onStartAll: () => void;
  onClearFinished: () => void;
}

export default function TaskList({
  tasks, filter, onFilterChange, onFormatChange, onStartDownload, onCancel, onRetry, onMove, onExpandPlaylist, onStartAll, onClearFinished,
}: TaskListProps) {
  const m = useT();
  const { pause, resume } = useQueueStore.getState();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visible = filterTasks(tasks, filter, query, m.locale);
  const selected = tasks.filter((t) => selectedIds.has(t.id));
  const readyCount = tasks.filter((t) => t.status === 'ready-to-select').length;
  const finishedCount = tasks.filter((t) => t.status === 'complete' || t.status === 'cancelled').length;
  const active = tasks.filter((t) => t.status === 'downloading' || t.status === 'queued');
  const paused = tasks.filter((t) => t.status === 'paused');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  /** Secili gorevlerden bu islemin uygulanabildikleri; dugme yalnizca varsa gorunur. */
  const bulk = (statuses: Task['status'][], run: (t: Task) => void) => {
    const targets = selected.filter((t) => statuses.includes(t.status));
    return targets.length ? () => { targets.forEach(run); clearSelection(); } : undefined;
  };
  const bulkActions = [
    { label: m.list.downloadSelected, run: bulk(['ready-to-select'], onStartDownload), primary: true },
    { label: m.list.pauseSelected, run: bulk(['downloading', 'queued'], (t) => void pause(t.id)) },
    { label: m.list.resumeSelected, run: bulk(['paused'], (t) => void resume(t.id)) },
    { label: m.list.retrySelected, run: bulk(['error', 'cancelled'], onRetry) },
    { label: m.list.cancelSelected, run: bulk(['analyzing', 'ready-to-select', 'queued', 'downloading', 'paused'], (t) => onCancel(t.id)) },
  ];

  if (tasks.length === 0) {
    return (
      <div className="flex-1 grid place-items-center rounded-box border border-dashed border-base-300 py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-base-content/50">
          <ListVideo size={40} strokeWidth={1.5} />
          <p className="text-sm">{m.list.empty}</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label={m.list.label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 min-h-8">
        <h2 className="text-sm font-semibold text-base-content/70 mr-1">{m.list.heading(tasks.length)}</h2>
        <label className="input input-sm w-56">
          <Search size={14} className="opacity-50" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={m.list.search} aria-label={m.list.search} />
        </label>
        {filter !== 'all' && (
          <button onClick={() => onFilterChange('all')} className="badge badge-neutral gap-1 cursor-pointer" aria-label={m.list.clearFilter}>
            {m.queue.stats[filter]} <X size={12} />
          </button>
        )}
        <div role="toolbar" aria-label={m.list.actions} className="flex flex-wrap items-center gap-1 ml-auto">
          {selected.length > 0 ? (
            <>
              <span className="text-xs text-base-content/60 mr-1">{m.list.selected(selected.length)}</span>
              {bulkActions.filter((a) => a.run).map((a) => (
                <button key={a.label} onClick={a.run} className={`btn btn-xs ${a.primary ? 'btn-neutral' : 'btn-ghost'}`}>{a.label}</button>
              ))}
              <button onClick={clearSelection} className="btn btn-xs btn-ghost">{m.list.clearSelection}</button>
            </>
          ) : (
            <>
              {active.length > 0 && (
                <button onClick={() => active.forEach((t) => void pause(t.id))} className="btn btn-xs btn-ghost gap-1">
                  <Pause size={12} /> {m.list.pauseAll}
                </button>
              )}
              {paused.length > 0 && (
                <button onClick={() => paused.forEach((t) => void resume(t.id))} className="btn btn-xs btn-ghost gap-1">
                  <Play size={12} /> {m.list.resumeAll(paused.length)}
                </button>
              )}
              {finishedCount > 0 && (
                <button onClick={onClearFinished} className="btn btn-xs btn-ghost">{m.list.clearFinished}</button>
              )}
              <button onClick={() => setSelectedIds(new Set(visible.map((t) => t.id)))} className="btn btn-xs btn-ghost">
                {m.list.selectAll}
              </button>
              {readyCount > 1 && (
                <button onClick={onStartAll} className="btn btn-xs btn-neutral">{m.list.startAll(readyCount)}</button>
              )}
            </>
          )}
        </div>
      </div>

      {visible.length === 0 && <p className="text-sm text-base-content/50 text-center py-8">{m.list.noMatch}</p>}

      <div className="flex flex-col gap-3">
        {visible.map((task, idx) => (
          <TaskCard
            key={task.id}
            task={task}
            selected={selectedIds.has(task.id)}
            onToggleSelect={toggleSelect}
            onFormatChange={onFormatChange}
            onStartDownload={onStartDownload}
            onCancel={onCancel}
            onRetry={onRetry}
            onMove={onMove}
            onExpandPlaylist={onExpandPlaylist}
            isFirst={idx === 0}
            isLast={idx === visible.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
