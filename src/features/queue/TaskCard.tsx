import { ChevronDown, ChevronUp, CircleAlert, RotateCcw, X } from 'lucide-react';
import type { Task } from '../../types';
import DownloadProgress from './DownloadProgress';
import FormatSelector from './FormatSelector';
import StatusBadge from './StatusBadge';
import Thumbnail from '../../app/Thumbnail';

interface TaskCardProps {
  task: Task;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
  onCancel: (taskId: string) => void;
  onRetry: (task: Task) => void;
  onMove: (taskId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function TaskCard({
  task, selected, onToggleSelect, onFormatChange, onStartDownload, onCancel, onRetry, onMove, isFirst, isLast,
}: TaskCardProps) {
  const analyzing = task.status === 'analyzing';
  const canCancel = analyzing || task.status === 'ready-to-select';
  const canRetry = task.status === 'error' || task.status === 'cancelled';
  const canMove = task.status === 'ready-to-select' || task.status === 'complete';

  return (
    <article
      aria-label={analyzing ? 'Analiz ediliyor' : task.title}
      data-status={task.status}
      className={`card bg-base-100 border transition-colors ${selected ? 'border-primary/60' : 'border-base-300'}`}
    >
      <div className="card-body p-4 gap-4">
        <div className="flex gap-4 items-start">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-1"
            checked={selected}
            onChange={() => onToggleSelect(task.id)}
            aria-label="Seç"
          />

          <Thumbnail
            src={task.thumbnail}
            audio={task.selectedFormatId?.startsWith('audio-')}
            loading={analyzing}
            className="w-36"
          />

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {analyzing ? (
              <div className="skeleton h-4 w-3/4" />
            ) : (
              <h3 className="font-medium leading-snug line-clamp-2">{task.title}</h3>
            )}
            <p className="text-xs text-base-content/50 truncate">{task.url}</p>
            <div><StatusBadge task={task} /></div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canMove && (
              <div className="join join-vertical">
                <button onClick={() => onMove(task.id, 'up')} disabled={isFirst} className="btn btn-ghost btn-xs btn-square join-item" aria-label="Yukarı taşı">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => onMove(task.id, 'down')} disabled={isLast} className="btn btn-ghost btn-xs btn-square join-item" aria-label="Aşağı taşı">
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
            {canRetry && (
              <button onClick={() => onRetry(task)} className="btn btn-ghost btn-sm btn-square" aria-label="Tekrar dene">
                <RotateCcw size={16} />
              </button>
            )}
            {canCancel && (
              <button onClick={() => onCancel(task.id)} className="btn btn-ghost btn-sm btn-square" aria-label="Kaldır">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <FormatSelector task={task} onFormatChange={onFormatChange} onStartDownload={onStartDownload} />
        {task.status === 'downloading' && <DownloadProgress task={task} onCancel={onCancel} />}
        {task.status === 'error' && task.message && (
          <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
            <CircleAlert size={16} />
            <span className="break-words min-w-0">{task.message}</span>
          </div>
        )}
      </div>
    </article>
  );
}
