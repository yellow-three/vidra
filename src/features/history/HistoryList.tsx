import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, History, Play, RotateCcw, Search, Trash2 } from 'lucide-react';
import Thumbnail from '../../app/Thumbnail';
import type { HistoryItem } from '../../types';
import { appApi } from '../../lib/appApi';
import { useQueueStore } from '../queue/store';
import { useDeleteHistoryItem, useHistory } from './queries';
import { useT } from '../../i18n';

// Gecmis Unix saniyesi tutar; eski kayitlar ISO metni olabilir.
function formatDate(value: string, locale: string) {
  const seconds = Number(value);
  const d = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(value);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const isAudio = (item: HistoryItem) => ['mp3', 'm4a', 'opus', 'wav', 'flac'].includes(item.ext?.toLowerCase());

const normalize = (text: string, locale: string) => text.toLocaleLowerCase(locale);

/** Diskten silinmis ya da tasinmis dosyalar; bilinmiyorsa (sorgu bitmeden) var sayilir. */
function useMissingFiles(items: HistoryItem[]): Set<string> {
  const paths = items.map((i) => i.filePath);
  const { data } = useQuery({
    queryKey: ['history-files', paths],
    queryFn: () => appApi.filesExist(paths),
    enabled: paths.length > 0,
  });
  return useMemo(() => new Set(data ? items.filter((_, i) => !data[i]).map((i) => i.id) : []), [data, items]);
}

function IconButton({ tip, onClick, disabled, children }: {
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="tooltip" data-tip={tip}>
      <button onClick={onClick} disabled={disabled} className="btn btn-ghost btn-sm btn-square" aria-label={tip}>
        {children}
      </button>
    </div>
  );
}

export default function HistoryList() {
  const m = useT();
  const h = m.history;
  const { data: history = [], isPending } = useHistory();
  const deleteItem = useDeleteHistoryItem();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const missing = useMissingFiles(history);

  const visible = useMemo(() => {
    // Turkce I/i farki her dilde dogru eslesmesi icin aranan ve aranan yer ayni yerelle kucultulur.
    const lower = (s: string) => normalize(s, m.locale);
    const q = lower(query.trim());
    return q ? history.filter((item) => lower(item.title).includes(q) || lower(item.url).includes(q)) : history;
  }, [history, query, m.locale]);

  const redownload = (item: HistoryItem) => {
    const queue = useQueueStore.getState();
    queue.setUrl(item.url);
    void queue.analyze();
    navigate('/');
  };

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
          <p className="text-sm">{h.empty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="input w-full">
        <Search size={16} className="opacity-50" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={h.searchPlaceholder}
          aria-label={h.search}
          className="grow"
        />
      </label>

      {visible.length === 0 ? (
        <p className="text-sm text-base-content/60 text-center py-8">{h.noMatch(query)}</p>
      ) : (
        <ul className="list bg-base-100 rounded-box border border-base-300">
          {visible.map((item) => {
            const gone = missing.has(item.id);
            return (
              <li key={item.id} className="list-row items-center" data-missing={gone || undefined}>
                <Thumbnail src={item.thumbnail} audio={isAudio(item)} className={`w-28 ${gone ? 'opacity-50' : ''}`} />
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{item.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-base-content/60">
                    <span className="badge badge-sm badge-ghost">{item.quality || item.ext?.toUpperCase() || '-'}</span>
                    {item.fileSize && <span>{item.fileSize}</span>}
                    <span aria-hidden>·</span>
                    <span>{formatDate(item.completedAt, m.locale)}</span>
                    {gone && <span className="badge badge-sm badge-warning badge-soft">{h.missing}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton tip={h.play} onClick={() => void appApi.openFile(item.filePath)} disabled={gone}>
                    <Play size={16} />
                  </IconButton>
                  <IconButton tip={h.reveal} onClick={() => void appApi.openFileLocation(item.filePath)} disabled={gone}>
                    <FolderOpen size={16} />
                  </IconButton>
                  <IconButton tip={h.redownload} onClick={() => redownload(item)}>
                    <RotateCcw size={16} />
                  </IconButton>
                  <IconButton tip={h.delete} onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
