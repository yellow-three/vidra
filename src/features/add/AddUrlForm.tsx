import { useState } from 'react';
import { useAppStatus } from '../queue/bootstrap';
import { useQueueStore } from '../queue/store';

/** Link kutusu: indirmeler surerken de yeni link eklenebilir (kuyruk eszamanliligi sinirlar). */
export default function AddUrlForm() {
  const url = useQueueStore((s) => s.url);
  const setUrl = useQueueStore((s) => s.setUrl);
  const analyze = useQueueStore((s) => s.analyze);
  const depsReady = useAppStatus((s) => s.depsReady);
  const [urlError, setUrlError] = useState(false);

  const onAnalyze = () => {
    if (!url.trim()) {
      setUrlError(true);
      setTimeout(() => setUrlError(false), 2000);
      return;
    }
    void analyze();
  };

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            aria-label="YouTube linki"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && depsReady) onAnalyze(); }}
            placeholder="YouTube linki yapıştırın ve analiz edin..."
            className={`w-full h-11 bg-[var(--bg-body)] border-2 rounded-xl pl-4 pr-10 text-sm text-white outline-none transition-colors ${
              urlError ? 'border-red-500 placeholder:text-red-400' : 'border-[var(--border)] focus:border-blue-500'
            }`}
          />
          {url && (
            <button
              onClick={() => setUrl('')}
              aria-label="Linki temizle"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-lg leading-none"
            >
              &times;
            </button>
          )}
        </div>
        <button
          onClick={onAnalyze}
          disabled={!depsReady || !url.trim()}
          className="h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20"
        >
          {depsReady ? 'Analiz Et' : 'Hazırlanıyor...'}
        </button>
      </div>
      {urlError && <p className="text-[11px] text-red-400 mt-2">Lütfen geçerli bir URL girin.</p>}
    </div>
  );
}
