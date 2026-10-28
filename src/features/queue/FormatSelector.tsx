import { Download, FileAudio, FileVideo } from 'lucide-react';
import { formatFilesize } from '../../engine/ytdlp';
import type { Task, VideoFormat } from '../../types';

const UNKNOWN_SIZE = formatFilesize(null);
/** Oynatma listesi girdilerinde boyut bilinmez; yerine secenegin notu gosterilir. */
const sizeOrNote = (f: VideoFormat) => (f.filesize === UNKNOWN_SIZE ? f.note : f.filesize);

interface FormatSelectorProps {
  task: Task;
  onFormatChange: (taskId: string, formatId: string) => void;
  onStartDownload: (task: Task) => void;
}

export default function FormatSelector({ task, onFormatChange, onStartDownload }: FormatSelectorProps) {
  if (task.status !== 'ready-to-select' || !task.formats) return null;

  const selected = task.selectedFormatId || task.formats[0]?.formatId;
  const isAudio = selected?.startsWith('audio-');
  const videos = task.formats.filter((f) => f.formatId.startsWith('video-'));
  const audios = task.formats.filter((f) => f.formatId.startsWith('audio-'));

  return (
    <div className="join w-full">
      <label className="select select-sm join-item w-full">
        {isAudio ? <FileAudio size={14} className="opacity-60" /> : <FileVideo size={14} className="opacity-60" />}
        <select value={selected} onChange={(e) => onFormatChange(task.id, e.target.value)} aria-label="Format">
          <optgroup label="Video (MP4)">
            {videos.map((f) => (
              <option key={f.formatId} value={f.formatId}>{f.resolution} · {sizeOrNote(f)}</option>
            ))}
          </optgroup>
          <optgroup label="Yalnızca ses">
            {audios.map((f) => (
              <option key={f.formatId} value={f.formatId}>{f.ext.toUpperCase()} · {f.note}{f.filesize === UNKNOWN_SIZE ? '' : ` · ${f.filesize}`}</option>
            ))}
          </optgroup>
        </select>
      </label>
      <button onClick={() => onStartDownload(task)} className="btn btn-sm btn-neutral join-item gap-1.5">
        <Download size={14} /> İndir
      </button>
    </div>
  );
}
