import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { CircleAlert, FileUp, FolderOpen, RotateCcw, X } from 'lucide-react';
import { appApi } from '../../lib/appApi';
import { startConvert as runConvert } from '../../engine/convert';

const EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'mp3', 'wav', 'flac', 'ogg', 'm4a'];

interface ConvertTask {
  id: string;
  inputPath: string;
  fileName: string;
  outputFormat: string;
  quality: string;
  percent: number;
  status: 'idle' | 'converting' | 'complete' | 'error';
  outputPath?: string;
  error?: string;
}

const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

export default function ConvertForm() {
  const [tasks, setTasks] = useState<ConvertTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const cancels = useRef(new Map<string, () => Promise<unknown>>());

  const addPaths = (paths: string[]) => {
    setTasks((prev) => [...prev, ...paths.map((inputPath) => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      inputPath,
      fileName: fileNameOf(inputPath),
      outputFormat: 'mp4',
      quality: 'medium',
      percent: 0,
      status: 'idle' as const,
    }))]);
  };

  // Tauri dosya birakmayi kendisi yakalar; HTML drop olayi dosya yolu vermez.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === 'enter' || payload.type === 'over') setDragging(true);
      else if (payload.type === 'leave') setDragging(false);
      else {
        setDragging(false);
        addPaths(payload.paths);
      }
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  const handleBrowse = async () => {
    const selected = await open({ multiple: true, filters: [{ name: 'Medya', extensions: EXTENSIONS }] });
    if (selected) addPaths(Array.isArray(selected) ? selected : [selected]);
  };

  const patch = (id: string, value: Partial<ConvertTask>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...value } : t)));

  const startConvert = async (task: ConvertTask) => {
    patch(task.id, { status: 'converting', percent: 0, error: undefined });
    try {
      const { result, cancel } = await runConvert(task.inputPath, task.outputFormat, task.quality, (percent) => patch(task.id, { percent }));
      cancels.current.set(task.id, cancel);
      const outcome = await result;
      cancels.current.delete(task.id);
      if (outcome.status === 'complete') patch(task.id, { status: 'complete', percent: 100, outputPath: outcome.outputPath });
      else if (outcome.status === 'error') patch(task.id, { status: 'error', error: outcome.message });
    } catch (error) {
      patch(task.id, { status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const remove = (id: string) => {
    void cancels.current.get(id)?.();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleBrowse}
        className={`card border-2 border-dashed transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100 hover:border-base-content/30'
        }`}
      >
        <span className="card-body items-center text-center gap-2 py-10">
          <FileUp size={32} strokeWidth={1.5} className="opacity-50" />
          <span className="font-medium">{dragging ? 'Bırakın…' : 'Dosyaları sürükleyin veya seçmek için tıklayın'}</span>
          <span className="text-xs text-base-content/50">MP4, WebM, MKV, AVI, MOV, MP3, WAV, FLAC</span>
        </span>
      </button>

      {tasks.length > 0 && (
        <ul className="list bg-base-100 rounded-box border border-base-300">
          {tasks.map((task) => (
            <li key={task.id} className="list-row flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-medium truncate flex-1" title={task.inputPath}>{task.fileName}</h3>
                {task.status === 'complete' && <span className="badge badge-success badge-soft badge-sm">Tamamlandı</span>}
                {task.status === 'error' && <span className="badge badge-error badge-soft badge-sm">Hata</span>}
                {task.status === 'complete' && (
                  <button onClick={() => void appApi.openFileLocation(task.outputPath || task.inputPath)} className="btn btn-ghost btn-sm btn-square" aria-label="Klasörde göster">
                    <FolderOpen size={16} />
                  </button>
                )}
                {task.status === 'error' && (
                  <button onClick={() => startConvert(task)} className="btn btn-ghost btn-sm btn-square" aria-label="Tekrar dene">
                    <RotateCcw size={16} />
                  </button>
                )}
                <button onClick={() => remove(task.id)} className="btn btn-ghost btn-sm btn-square" aria-label={task.status === 'converting' ? 'İptal et' : 'Kaldır'}>
                  <X size={16} />
                </button>
              </div>

              {task.status === 'idle' && (
                <div className="flex flex-wrap items-end gap-3">
                  <fieldset className="fieldset py-0">
                    <legend className="fieldset-legend pt-0">Format</legend>
                    <select value={task.outputFormat} onChange={(e) => patch(task.id, { outputFormat: e.target.value })} className="select select-sm">
                      <option value="mp4">MP4 (Video)</option>
                      <option value="mp3">MP3 (Ses)</option>
                      <option value="webm">WebM (Video)</option>
                    </select>
                  </fieldset>
                  <fieldset className="fieldset py-0">
                    <legend className="fieldset-legend pt-0">Kalite</legend>
                    <select value={task.quality} onChange={(e) => patch(task.id, { quality: e.target.value })} className="select select-sm">
                      <option value="high">Yüksek</option>
                      <option value="medium">Orta</option>
                      <option value="low">Düşük</option>
                    </select>
                  </fieldset>
                  <button onClick={() => startConvert(task)} className="btn btn-sm btn-neutral ml-auto">Dönüştür</button>
                </div>
              )}

              {task.status === 'converting' && (
                <div className="flex items-center gap-3">
                  <progress className="progress progress-primary flex-1" value={task.percent} max={100} aria-label="Dönüştürme ilerlemesi" />
                  <span className="text-xs font-semibold w-10 text-right">%{task.percent}</span>
                </div>
              )}

              {task.status === 'error' && task.error && (
                <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
                  <CircleAlert size={16} />
                  <span className="break-words min-w-0">{task.error}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
