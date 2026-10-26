import { useState } from 'react';
import type { Task } from '../types';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
  onCancel: (taskId: string) => void;
  onRetry: (task: Task) => void;
  onMove: (taskId: string, direction: 'up' | 'down') => void;
}

export default function TaskList({ tasks, onFormatChange, onStartDownload, onCancel, onRetry, onMove }: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(tasks.map((t) => t.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const batchCancel = () => {
    selectedIds.forEach((id) => onCancel(id));
    clearSelection();
  };

  const batchRetry = () => {
    tasks.filter((t) => selectedIds.has(t.id) && (t.status === 'error' || t.status === 'cancelled')).forEach((t) => onRetry(t));
    clearSelection();
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">İndirme Havuzu ({tasks.length})</h3>
        <div className="flex gap-2">
          {hasSelection && (
            <>
              <span className="text-[10px] text-slate-500 self-center">{selectedIds.size} seçili</span>
              <button
                onClick={batchCancel}
                className="text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/40 font-bold px-2 py-1 rounded border border-red-500/30 transition-all"
              >
                Toplu İptal
              </button>
              <button
                onClick={batchRetry}
                className="text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 font-bold px-2 py-1 rounded border border-blue-500/30 transition-all"
              >
                Toplu Yeniden Dene
              </button>
              <button
                onClick={clearSelection}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1"
              >
                ✕
              </button>
            </>
          )}
          {tasks.length > 0 && !hasSelection && (
            <button
              onClick={selectAll}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Tümünü Seç
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto flex-1 pr-1">
        {tasks.length === 0 ? (
          <div className="h-48 border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-sm text-slate-500 italic">
            Havuz boş. Bir link ekleyerek analiz sürecini başlatın.
          </div>
        ) : (
          tasks.map((task, idx) => (
            <div key={task.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(task.id)}
                onChange={() => toggleSelect(task.id)}
                className="mt-5 accent-blue-500 cursor-pointer shrink-0"
              />
              <div className="flex-1">
                <TaskCard
                  task={task}
                  onFormatChange={onFormatChange}
                  onStartDownload={onStartDownload}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  onMove={onMove}
                  isFirst={idx === 0}
                  isLast={idx === tasks.length - 1}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
