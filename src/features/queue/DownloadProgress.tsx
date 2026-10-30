import { Pause, Play } from 'lucide-react';
import type { Task } from '../../types';
import { useT } from '../../i18n';
import { useQueueStore } from './store';

/** Suren, siradaki ya da duraklatilmis indirmenin ilerlemesi ve dugmeleri. */
export default function DownloadProgress({ task, onCancel }: { task: Task; onCancel: (taskId: string) => void }) {
  const m = useT();
  const { pause, resume } = useQueueStore.getState();
  const queued = task.status === 'queued';
  const paused = task.status === 'paused';
  return (
    <div className="flex flex-col gap-1.5">
      {queued ? (
        <progress className="progress w-full" aria-label={m.task.queued} />
      ) : (
        <progress
          className={`progress w-full ${paused ? 'progress-warning' : 'progress-primary'}`}
          value={task.percent}
          max={100}
          aria-label={m.task.progress}
        />
      )}
      <div className="flex items-center gap-3 text-xs text-base-content/60">
        {queued ? (
          <span>{m.task.queuedWaiting}</span>
        ) : (
          <>
            <span className="font-semibold text-base-content">
              {task.downloaded ? task.downloaded : `%${task.percent}`}
            </span>
            {paused ? (
              <span>{m.task.pausedHint}</span>
            ) : task.waitForVideo && !task.downloaded && task.percent === 0 ? (
              <span>{m.task.waitingForLive}</span>
            ) : (
              <>
                {task.speed && <span>{task.speed}</span>}
                {task.eta && <span>{m.task.remaining(task.eta)}</span>}
              </>
            )}
          </>
        )}
        <span className="ml-auto flex gap-1">
          {paused ? (
            <button onClick={() => void resume(task.id)} className="btn btn-ghost btn-xs gap-1">
              <Play size={12} /> {m.task.resume}
            </button>
          ) : (
            <button onClick={() => void pause(task.id)} className="btn btn-ghost btn-xs gap-1">
              <Pause size={12} /> {m.task.pause}
            </button>
          )}
          <button onClick={() => onCancel(task.id)} className="btn btn-ghost btn-xs">
            {m.task.cancel}
          </button>
        </span>
      </div>
    </div>
  );
}
