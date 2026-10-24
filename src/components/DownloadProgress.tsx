import type { Task } from '../types';

interface DownloadProgressProps {
  task: Task;
  onCancel: (taskId: string) => void;
}

export default function DownloadProgress({ task, onCancel }: DownloadProgressProps) {
  return (
    <div className="space-y-2 bg-[var(--bg-body)] p-3 rounded-lg border border-[var(--border)]">
      <div className="flex justify-between items-center text-[11px] text-slate-400">
        <span>Hız: <strong className="text-blue-400">{task.speed}</strong></span>
        <span>Kalan Süre: <strong className="text-emerald-400">{task.eta}</strong></span>
      </div>
      <div className="w-full bg-[var(--bg-card)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full" style={{ width: `${task.percent}%` }}></div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-400">%{task.percent} indirildi</span>
        <button
          onClick={() => onCancel(task.id)}
          className="text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/40 font-bold px-2.5 py-1 rounded border border-red-500/30 transition-all"
        >
          İptal Et
        </button>
      </div>
    </div>
  );
}
