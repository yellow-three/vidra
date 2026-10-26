import type { Task } from '../types';
import FormatSelector from './FormatSelector';
import DownloadProgress from './DownloadProgress';

interface TaskCardProps {
  task: Task;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
  onCancel: (taskId: string) => void;
  onRetry: (task: Task) => void;
  onMove: (taskId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function TaskCard({ task, onFormatChange, onStartDownload, onCancel, onRetry, onMove, isFirst, isLast }: TaskCardProps) {
  const isIdle = task.status === 'ready-to-select' || task.status === 'complete';
  const isActionable = task.status === 'analyzing' || task.status === 'downloading' || task.status === 'ready-to-select';

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-4 shadow-md">
      {/* Üst Bilgi Alanı */}
      <div className="flex gap-4 items-start">
        {task.thumbnail && (
          <img src={task.thumbnail} alt="Kaplama" className="w-28 h-16 object-cover rounded-lg border border-[var(--border)] shrink-0" />
        )}

        <div className="flex-1 truncate">
          <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
          <p className="text-xs text-slate-500 mt-1 truncate">{task.url}</p>
        </div>

        {/* Durum Göstergeleri */}
        <div className="shrink-0 flex items-center gap-2">
          {task.status === 'analyzing' && (
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded border border-amber-500/20 animate-pulse">🔍 ANALİZ EDİLİYOR...</span>
          )}
          {task.status === 'cancelled' && (
            <span className="text-[10px] bg-slate-500/10 text-slate-400 font-bold px-2.5 py-1 rounded border border-slate-500/20">⛔ İPTAL EDİLDİ</span>
          )}
          {task.status === 'complete' && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded border border-emerald-500/20">✓ TAMAMLANDI</span>
          )}
          {task.status === 'error' && (
            <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2.5 py-1 rounded border border-rose-500/20">{task.message}</span>
          )}

          {/* Cancel */}
          {isActionable && (
            <button
              onClick={() => onCancel(task.id)}
              className="text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/40 font-bold px-2 py-1 rounded border border-red-500/30 transition-all"
              title="İptal Et"
            >
              ✕
            </button>
          )}

          {/* Retry — hatalı veya iptal edilmiş task'lerde */}
          {(task.status === 'error' || task.status === 'cancelled') && (
            <button
              onClick={() => onRetry(task)}
              className="text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 font-bold px-2 py-1 rounded border border-blue-500/30 transition-all"
              title="Tekrar Dene"
            >
              ⟳
            </button>
          )}

          {/* Sıra değiştirme — sadece bekleyen/durağan task'lerde */}
          {isIdle && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => onMove(task.id, 'up')}
                disabled={isFirst}
                className="text-[10px] text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                title="Yukarı Taşı"
              >▲</button>
              <button
                onClick={() => onMove(task.id, 'down')}
                disabled={isLast}
                className="text-[10px] text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                title="Aşağı Taşı"
              >▼</button>
            </div>
          )}
        </div>
      </div>

      {/* Format Seçim Katmanı */}
      <FormatSelector task={task} onFormatChange={onFormatChange} onStartDownload={onStartDownload} />

      {/* İndirme Progress Alanı */}
      {task.status === 'downloading' && <DownloadProgress task={task} onCancel={onCancel} />}
    </div>
  );
}
