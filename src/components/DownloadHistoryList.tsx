import { useState, useEffect } from 'react';
import type { HistoryItem } from '../types';
import { appApi } from '../lib/appApi';

export default function DownloadHistoryList() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = () => appApi.getHistory().then(setHistory);

  useEffect(() => { load(); }, []);

  const handleOpenFolder = (filePath: string) => {
    appApi.openFileLocation(filePath);
  };

  const handleDelete = async (id: string) => {
    await appApi.deleteHistoryItem(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClearAll = async () => {
    await appApi.clearHistory();
    setHistory([]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (history.length === 0) {
    return (
      <div className="h-48 border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-sm text-slate-500 italic">
        Henüz indirme geçmişi yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{history.length} kayıt</span>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2 py-1 rounded transition-all"
        >
          Tümünü Temizle
        </button>
      </div>

      <div className="space-y-2">
        {history.map((item) => (
          <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-start gap-4">
            {item.thumbnail && (
              <img src={item.thumbnail} alt="" className="w-20 h-12 object-cover rounded border border-[var(--border)] shrink-0" />
            )}

            <div className="flex-1 truncate">
              <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{item.url}</p>
              <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                <span>{item.ext?.toUpperCase() || '-'}</span>
                {item.fileSize && <span>{item.fileSize}</span>}
                <span>{formatDate(item.completedAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleOpenFolder(item.filePath)}
                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded transition-all"
                title="Klasörü Aç"
              >
                📂
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-[10px] bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 px-2.5 py-1.5 rounded border border-rose-500/30 transition-all"
                title="Sil"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
