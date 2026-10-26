import type { Task } from '../../types';

interface FormatSelectorProps {
  task: Task;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
}

export default function FormatSelector({ task, onFormatChange, onStartDownload }: FormatSelectorProps) {
  if (task.status !== 'ready-to-select' || !task.formats) {
    return null;
  }

  return (
    <div className="flex gap-3 bg-[var(--bg-body)] p-3 rounded-lg border border-[var(--border)] items-center animate-fade-in">
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mevcut Formatı Seçin</label>
        <select 
          value={task.selectedFormatId || task.formats[0]?.formatId}
          onChange={(e) => onFormatChange(task.id, e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] text-xs rounded p-2 text-slate-200 focus:outline-none"
        >
          {task.formats.map((f) => (
            <option key={f.formatId} value={f.formatId}>
              [{f.ext.toUpperCase()}] • {f.resolution} • {f.filesize} {f.note ? `(${f.note})` : ''}
            </option>
          ))}
        </select>
      </div>
      <button 
        onClick={() => onStartDownload(task)}
        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded shadow self-end"
      >
        İndirmeyi Başlat 📥
      </button>
    </div>
  );
}
