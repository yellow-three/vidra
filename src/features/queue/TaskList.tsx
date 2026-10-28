import { useState } from 'react';
import { ListVideo } from 'lucide-react';
import type { Task } from '../../types';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
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
  tasks, onFormatChange, onStartDownload, onCancel, onRetry, onMove, onExpandPlaylist, onStartAll, onClearFinished,
}: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selected = tasks.filter((t) => selectedIds.has(t.id));
  const readyCount = tasks.filter((t) => t.status === 'ready-to-select').length;
  const finishedCount = tasks.filter((t) => t.status === 'complete' || t.status === 'cancelled').length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  if (tasks.length === 0) {
    return (
      <div className="flex-1 grid place-items-center rounded-box border border-dashed border-base-300 py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-base-content/50">
          <ListVideo size={40} strokeWidth={1.5} />
          <p className="text-sm">Kuyruk boş. Yukarıya bir link yapıştırarak başlayın.</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Kuyruk" className="flex flex-col gap-3">
      <div className="flex items-center justify-between min-h-8">
        <h2 className="text-sm font-semibold text-base-content/70">Kuyruk · {tasks.length}</h2>
        <div className="flex items-center gap-2">
          {selected.length > 0 ? (
            <>
              <span className="text-xs text-base-content/60">{selected.length} seçili</span>
              <button
                onClick={() => { selected.forEach((t) => onCancel(t.id)); clearSelection(); }}
                className="btn btn-xs btn-ghost"
              >
                Toplu iptal
              </button>
              <button
                onClick={() => {
                  selected.filter((t) => t.status === 'error' || t.status === 'cancelled').forEach(onRetry);
                  clearSelection();
                }}
                className="btn btn-xs btn-ghost"
              >
                Toplu yeniden dene
              </button>
              <button onClick={clearSelection} className="btn btn-xs btn-ghost">Vazgeç</button>
            </>
          ) : (
            <>
              {finishedCount > 0 && (
                <button onClick={onClearFinished} className="btn btn-xs btn-ghost">Bitenleri temizle</button>
              )}
              <button onClick={() => setSelectedIds(new Set(tasks.map((t) => t.id)))} className="btn btn-xs btn-ghost">
                Tümünü seç
              </button>
              {readyCount > 1 && (
                <button onClick={onStartAll} className="btn btn-xs btn-neutral">Hepsini indir ({readyCount})</button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map((task, idx) => (
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
            isLast={idx === tasks.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
