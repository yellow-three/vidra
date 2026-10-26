import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
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

  const updateTask = (id: string, key: string, value: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, [key]: value } : t));
  };

  const startConvert = async (task: ConvertTask) => {
    const setStatus = (patch: Partial<ConvertTask>) =>
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...patch } : t));
    setStatus({ status: 'converting', percent: 0 });
    try {
      const { result, cancel } = await runConvert(task.inputPath, task.outputFormat, task.quality);
      cancels.current.set(task.id, cancel);
      const outcome = await result;
      cancels.current.delete(task.id);
      if (outcome.status === 'complete') setStatus({ status: 'complete', percent: 100, outputPath: outcome.outputPath });
      else if (outcome.status === 'error') setStatus({ status: 'error' });
    } catch {
      setStatus({ status: 'error' });
    }
  };

  const cancelConvert = (id: string) => {
    void cancels.current.get(id)?.();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
          dragging ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--border)] hover:border-blue-500/50'
        }`}
        onClick={handleBrowse}
      >
        <p className="text-sm text-slate-400">
          {dragging ? 'Bırakın...' : 'Dosyaları sürükleyin veya seçmek için tıklayın'}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">MP4, WebM, MKV, AVI, MOV, MP3, WAV, FLAC</p>
      </div>

      {/* Task List */}
      {tasks.map((task) => (
        <div key={task.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 truncate">
              <h4 className="text-sm font-bold text-white truncate">{task.fileName}</h4>
            </div>

            {task.status === 'complete' && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded border border-emerald-500/20 shrink-0">✓ TAMAMLANDI</span>
            )}
            {task.status === 'error' && (
              <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2.5 py-1 rounded border border-rose-500/20 shrink-0">HATA</span>
            )}
          </div>

          {/* Options */}
          {task.status === 'idle' && (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Format</label>
                <select
                  value={task.outputFormat}
                  onChange={(e) => updateTask(task.id, 'outputFormat', e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-xs rounded p-2 text-slate-200"
                >
                  <option value="mp4">MP4 (Video)</option>
                  <option value="mp3">MP3 (Ses)</option>
                  <option value="webm">WebM (Video)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kalite</label>
                <select
                  value={task.quality}
                  onChange={(e) => updateTask(task.id, 'quality', e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-xs rounded p-2 text-slate-200"
                >
                  <option value="high">Yüksek</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
              </div>
              <button
                onClick={() => startConvert(task)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded transition-all"
              >
                Dönüştür
              </button>
            </div>
          )}

          {/* Progress */}
          {task.status === 'converting' && (
            <div className="space-y-2">
              <div className="w-full bg-[var(--bg-body)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all" style={{ width: `${task.percent}%` }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">%{task.percent}</span>
                <button
                  onClick={() => cancelConvert(task.id)}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Complete actions */}
          {task.status === 'complete' && (
            <div className="flex gap-2">
              <button
                onClick={() => appApi.openFileLocation(task.outputPath || task.inputPath)}
                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-all"
              >
                Klasörü Aç
              </button>
              <button
                onClick={() => removeTask(task.id)}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-2"
              >
                ✕
              </button>
            </div>
          )}

          {task.status === 'error' && (
            <div className="flex gap-2">
              <button
                onClick={() => startConvert(task)}
                className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded"
              >
                Tekrar Dene
              </button>
              <button
                onClick={() => removeTask(task.id)}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
