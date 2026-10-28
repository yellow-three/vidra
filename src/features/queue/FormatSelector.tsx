import { Download, FileAudio, FileVideo } from 'lucide-react';
import { formatFilesize } from '../../engine/ytdlp';
import type { Task, VideoFormat } from '../../types';
import { useT } from '../../i18n';

/** Oynatma listesi girdilerinde boyut bilinmez; yerine secenegin notu gosterilir. */
const sizeOrNote = (f: VideoFormat) => (f.filesize === formatFilesize(null) ? f.note : f.filesize);

interface FormatSelectorProps {
  task: Task;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
}

export default function FormatSelector({ task, onFormatChange, onStartDownload }: FormatSelectorProps) {
  const m = useT();
  if (task.status !== 'ready-to-select' || !task.formats) return null;

  const selected = task.selectedFormatId || task.formats[0]?.formatId;
  const isAudio = selected?.startsWith('audio-');
  const videos = task.formats.filter((f) => f.formatId.startsWith('video-'));
  const audios = task.formats.filter((f) => f.formatId.startsWith('audio-'));

  return (
    <div className="join w-full">
      <label className="select select-sm join-item w-full">
        {isAudio ? <FileAudio size={14} className="opacity-60" /> : <FileVideo size={14} className="opacity-60" />}
        <select value={selected} onChange={(e) => onFormatChange(task.id, e.target.value)} aria-label={m.task.format}>
          <optgroup label={m.task.videoGroup}>
            {videos.map((f) => (
              <option key={f.formatId} value={f.formatId}>{f.resolution} · {sizeOrNote(f)}</option>
            ))}
          </optgroup>
          <optgroup label={m.task.audioGroup}>
            {audios.map((f) => (
              <option key={f.formatId} value={f.formatId}>{f.ext.toUpperCase()} · {f.note}{f.filesize === formatFilesize(null) ? '' : ` · ${f.filesize}`}</option>
            ))}
          </optgroup>
        </select>
      </label>
      <button onClick={() => onStartDownload(task)} className="btn btn-sm btn-neutral join-item gap-1.5">
        <Download size={14} /> {m.task.download}
      </button>
    </div>
  );
}
