import { ChevronDown, ChevronUp, CircleAlert, Info, ListPlus, ListVideo, RotateCcw, X } from 'lucide-react';
import { isVideoInPlaylist } from '../../engine/ytdlp';
import type { Task } from '../../types';
import DownloadProgress from './DownloadProgress';
import FormatSelector from './FormatSelector';
import SectionPicker from './SectionPicker';
import StatusBadge from './StatusBadge';
import Thumbnail from '../../app/Thumbnail';
import { useT } from '../../i18n';

interface TaskCardProps {
  task: Task;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
  onCancel: (taskId: string) => void;
  onRetry: (task: Task) => void;
  onMove: (taskId: string, direction: 'up' | 'down') => void;
  onExpandPlaylist: (taskId: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function TaskCard({
  task, selected, onToggleSelect, onFormatChange, onStartDownload, onCancel, onRetry, onMove, onExpandPlaylist, isFirst, isLast,
}: TaskCardProps) {
  const m = useT();
  const analyzing = task.status === 'analyzing';
  const canCancel = analyzing || task.status === 'ready-to-select';
  const canRetry = task.status === 'error' || task.status === 'cancelled';
  const ready = task.status === 'ready-to-select';
  // Siradakiler tasininca baslama siralari da degisir (store.move).
  const canMove = !analyzing && task.status !== 'downloading';
  const canExpand = ready && !task.playlist && isVideoInPlaylist(task.url);

  return (
    <article
      aria-label={analyzing ? m.task.analyzing : task.title}
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
            aria-label={m.task.select}
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
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge task={task} />
              {task.playlist && (
                <span className="badge badge-ghost badge-sm gap-1 max-w-full" title={task.playlist}>
                  <ListVideo size={12} className="shrink-0" /><span className="truncate">{task.playlist}</span>
                </span>
              )}
              {canExpand && (
                <button onClick={() => onExpandPlaylist(task.id)} className="btn btn-ghost btn-xs gap-1">
                  <ListPlus size={14} /> {m.task.expandPlaylist}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canMove && (
              <div className="join join-vertical">
                <button onClick={() => onMove(task.id, 'up')} disabled={isFirst} className="btn btn-ghost btn-xs btn-square join-item" aria-label={m.task.moveUp}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => onMove(task.id, 'down')} disabled={isLast} className="btn btn-ghost btn-xs btn-square join-item" aria-label={m.task.moveDown}>
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
            {canRetry && (
              <button onClick={() => onRetry(task)} className="btn btn-ghost btn-sm btn-square" aria-label={m.task.retry}>
                <RotateCcw size={16} />
              </button>
            )}
            {canCancel && (
              <button onClick={() => onCancel(task.id)} className="btn btn-ghost btn-sm btn-square" aria-label={m.task.remove}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <FormatSelector task={task} onFormatChange={onFormatChange} onStartDownload={onStartDownload} />
        {ready && task.formats && <SectionPicker task={task} />}
        {(task.status === 'downloading' || task.status === 'queued') && <DownloadProgress task={task} onCancel={onCancel} />}
        {ready && task.message && (
          <div role="status" className="alert alert-info alert-soft py-2 text-sm">
            <Info size={16} />
            <span className="min-w-0">{task.message}</span>
          </div>
        )}
        {task.status === 'error' && task.message && (
          <div role="alert" className="alert alert-error alert-soft py-2 text-sm items-start">
            <CircleAlert size={16} className="mt-0.5" />
            <div className="min-w-0 flex flex-col gap-1">
              <span className="break-words">{task.message}</span>
              {task.detail && (
                <details className="text-xs opacity-70">
                  <summary className="cursor-pointer">{m.task.detail}</summary>
                  <p className="font-mono break-words whitespace-pre-wrap mt-1">{task.detail}</p>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
