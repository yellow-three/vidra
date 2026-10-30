import { useRef, useState, type ChangeEvent } from 'react';
import { FileText, Link2, X } from 'lucide-react';
import { useAppStatus } from '../queue/appStatus';
import { linksFromBatchFile } from '../queue/duplicates';
import { useQueueStore } from '../queue/store';
import { useT } from '../../i18n';

/** Link kutusu: indirmeler surerken de yeni link eklenebilir (kuyruk eszamanliligi sinirlar). */
export default function AddUrlForm() {
  const m = useT();
  const url = useQueueStore((s) => s.url);
  const setUrl = useQueueStore((s) => s.setUrl);
  const analyze = useQueueStore((s) => s.analyze);
  const depsReady = useAppStatus((s) => s.depsReady);
  const [urlError, setUrlError] = useState(false);
  const [importEmpty, setImportEmpty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onAnalyze = () => {
    if (!url.trim()) {
      setUrlError(true);
      return;
    }
    // Kutu analiz baslarken (ilk await'ten once) bosaltilir; link olmayan parcalar kutuda kalir.
    void analyze();
    if (useQueueStore.getState().url.trim()) setUrlError(true);
  };

  /** yt-dlp `-a` yerine: her link ayri kart olur, format ve tekrar uyarisi tek tek calisir. */
  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const links = linksFromBatchFile(await file.text());
    setImportEmpty(links.length === 0);
    if (links.length === 0) return;
    setUrl([url.trim(), ...links].filter(Boolean).join('\n'));
    setUrlError(false);
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
            aria-label={m.addUrl.label}
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(false); setImportEmpty(false); }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="grow"
            autoFocus
          />
          {url && (
            <button type="button" onClick={() => setUrl('')} aria-label={m.addUrl.clear} className="btn btn-ghost btn-xs btn-circle">
              <X size={14} />
            </button>
          )}
        </label>
        <button type="submit" disabled={!depsReady || !url.trim()} className="btn btn-primary btn-lg join-item px-8">
          {depsReady ? m.addUrl.analyze : m.addUrl.preparing}
        </button>
      </div>
      <div className="flex items-start gap-2 px-1">
        {urlError || importEmpty ? (
          <p className="text-xs text-error grow">{urlError ? m.addUrl.invalid : m.addUrl.importEmpty}</p>
        ) : (
          <p className="text-xs text-base-content/50 grow">{m.addUrl.hint}</p>
        )}
        <input ref={fileInput} type="file" accept=".txt,text/plain" onChange={(e) => void onImport(e)} className="hidden" aria-hidden tabIndex={-1} />
        <button
          type="button"
          disabled={!depsReady}
          onClick={() => fileInput.current?.click()}
          title={m.addUrl.importFileHint}
          className="btn btn-ghost btn-xs shrink-0"
        >
          <FileText size={14} />
          {m.addUrl.importFile}
        </button>
      </div>
    </form>
  );
}
