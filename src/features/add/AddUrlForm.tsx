import { useState } from 'react';
import { Link2, X } from 'lucide-react';
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
      return;
    }
    void analyze();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (depsReady) onAnalyze(); }}
      className="flex flex-col gap-2"
    >
      <div className="join w-full">
        <label className={`input input-lg join-item w-full ${urlError ? 'input-error' : ''}`}>
          <Link2 size={18} className="opacity-50 shrink-0" />
          <input
            type="text"
            aria-label="YouTube linki"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(false); }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="grow"
            autoFocus
          />
          {url && (
            <button type="button" onClick={() => setUrl('')} aria-label="Linki temizle" className="btn btn-ghost btn-xs btn-circle">
              <X size={14} />
            </button>
          )}
        </label>
        <button type="submit" disabled={!depsReady || !url.trim()} className="btn btn-primary btn-lg join-item px-8">
          {depsReady ? 'Analiz Et' : 'Hazırlanıyor...'}
        </button>
      </div>
      {urlError ? (
        <p className="text-xs text-error px-1">Lütfen geçerli bir URL girin.</p>
      ) : (
        <p className="text-xs text-base-content/50 px-1">
          Kopyaladığınız YouTube linkleri kutuya kendiliğinden gelir. Video veya ses formatını analizden sonra seçersiniz.
        </p>
      )}
    </form>
  );
}
