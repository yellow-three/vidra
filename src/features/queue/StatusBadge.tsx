import type { Task } from '../../types';
import { useT } from '../../i18n';

/** Gorev durumunun kisa etiketi; hata mesaji kartta ayrica gosterilir. */
export default function StatusBadge({ task }: { task: Task }) {
  const b = useT().task.badge;
  switch (task.status) {
    case 'analyzing':
      return (
        <span className="badge badge-ghost badge-sm gap-1.5">
          <span className="loading loading-spinner loading-xs" /> {b.analyzing}
        </span>
      );
    case 'ready-to-select':
      return <span className="badge badge-info badge-soft badge-sm">{b.ready}</span>;
    case 'queued':
      return <span className="badge badge-ghost badge-sm">{b.queued}</span>;
    case 'downloading':
      return <span className="badge badge-primary badge-soft badge-sm">{b.downloading}</span>;
    case 'paused':
      return <span className="badge badge-warning badge-soft badge-sm">{b.paused}</span>;
    case 'complete':
      return <span className="badge badge-success badge-soft badge-sm">{b.complete}</span>;
    case 'cancelled':
      return <span className="badge badge-ghost badge-sm">{b.cancelled}</span>;
    case 'error':
      return <span className="badge badge-error badge-soft badge-sm">{b.error}</span>;
  }
}
