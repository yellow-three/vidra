import type { Task } from '../../types';

export default function DownloadProgress({ task, onCancel }: { task: Task; onCancel: (taskId: string) => void }) {
  const queued = task.status === 'queued';
  return (
    <div className="flex flex-col gap-1.5">
      {queued ? (
        <progress className="progress w-full" aria-label="Sırada" />
      ) : (
        <progress className="progress progress-primary w-full" value={task.percent} max={100} aria-label="İndirme ilerlemesi" />
      )}
      <div className="flex items-center gap-3 text-xs text-base-content/60">
        {queued ? (
          <span>Sırada bekliyor...</span>
        ) : (
          <>
            <span className="font-semibold text-base-content">%{task.percent}</span>
            {task.speed && <span>{task.speed}</span>}
            {task.eta && <span>{task.eta} kaldı</span>}
          </>
        )}
        <button onClick={() => onCancel(task.id)} className="btn btn-ghost btn-xs ml-auto">
          İptal Et
        </button>
      </div>
    </div>
  );
}
