import { FolderOpen, History, Trash2 } from 'lucide-react';
import Thumbnail from '../../app/Thumbnail';
import type { HistoryItem } from '../../types';
import { appApi } from '../../lib/appApi';
import { useDeleteHistoryItem, useHistory } from './queries';

// Gecmis Unix saniyesi tutar; eski kayitlar ISO metni olabilir.
function formatDate(value: string) {
  const seconds = Number(value);
  const d = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(value);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const isAudio = (item: HistoryItem) => ['mp3', 'm4a', 'opus', 'wav', 'flac'].includes(item.ext?.toLowerCase());

export default function HistoryList() {
  const { data: history = [], isPending } = useHistory();
  const deleteItem = useDeleteHistoryItem();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="grid place-items-center rounded-box border border-dashed border-base-300 py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-base-content/50">
          <History size={40} strokeWidth={1.5} />
          <p className="text-sm">Henüz indirme geçmişi yok.</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="list bg-base-100 rounded-box border border-base-300">
      {history.map((item) => (
        <li key={item.id} className="list-row items-center">
          <Thumbnail src={item.thumbnail} audio={isAudio(item)} className="w-28" />
          <div className="min-w-0">
            <h3 className="font-medium truncate">{item.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-base-content/60">
              <span className="badge badge-sm badge-ghost">{item.quality || item.ext?.toUpperCase() || '-'}</span>
              {item.fileSize && <span>{item.fileSize}</span>}
              <span aria-hidden>·</span>
              <span>{formatDate(item.completedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="tooltip" data-tip="Klasörde göster">
              <button onClick={() => void appApi.openFileLocation(item.filePath)} className="btn btn-ghost btn-sm btn-square" aria-label="Klasörde göster">
                <FolderOpen size={16} />
              </button>
            </div>
            <div className="tooltip" data-tip="Geçmişten sil">
              <button onClick={() => deleteItem.mutate(item.id)} className="btn btn-ghost btn-sm btn-square" aria-label="Sil">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
