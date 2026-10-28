import type { Task } from '../../types';

/** Gorev durumunun kisa etiketi; hata mesaji kartta ayrica gosterilir. */
export default function StatusBadge({ task }: { task: Task }) {
  switch (task.status) {
    case 'analyzing':
      return (
        <span className="badge badge-ghost badge-sm gap-1.5">
          <span className="loading loading-spinner loading-xs" /> Analiz ediliyor
        </span>
      );
    case 'ready-to-select':
      return <span className="badge badge-info badge-soft badge-sm">Format seçin</span>;
    case 'queued':
      return <span className="badge badge-ghost badge-sm">Sırada</span>;
    case 'downloading':
      return <span className="badge badge-primary badge-soft badge-sm">İndiriliyor</span>;
    case 'complete':
      return <span className="badge badge-success badge-soft badge-sm">Tamamlandı</span>;
    case 'cancelled':
      return <span className="badge badge-ghost badge-sm">İptal edildi</span>;
    case 'error':
      return <span className="badge badge-error badge-soft badge-sm">Hata</span>;
  }
}
