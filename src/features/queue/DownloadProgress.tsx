import type { Task } from '../../types';
import { useT } from '../../i18n';

export default function DownloadProgress({ task, onCancel }: { task: Task; onCancel: (taskId: string) => void }) {
  const m = useT();
  const queued = task.status === 'queued';
  return (
    <div className="flex flex-col gap-1.5">
      {queued ? (
        <progress className="progress w-full" aria-label={m.task.queued} />
      ) : (
        <progress className="progress progress-primary w-full" value={task.percent} max={100} aria-label={m.task.progress} />
      )}
      <div className="flex items-center gap-3 text-xs text-base-content/60">
        {queued ? (
          <span>{m.task.queuedWaiting}</span>
        ) : (
          <>
            <span className="font-semibold text-base-content">%{task.percent}</span>
            {task.speed && <span>{task.speed}</span>}
            {task.eta && <span>{m.task.remaining(task.eta)}</span>}
          </>
        )}
        <button onClick={() => onCancel(task.id)} className="btn btn-ghost btn-xs ml-auto">
          {m.task.cancel}
        </button>
      </div>
    </div>
  );
}
