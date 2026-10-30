import { Download, FileAudio, FileVideo } from 'lucide-react';
import { BEST_AUDIO_ID, BEST_ID, formatFilesize, isAudioOptionId } from '../../engine/ytdlp';
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
  const isAudio = isAudioOptionId(selected);
  const best = task.formats.filter((f) => f.formatId === BEST_ID || f.formatId === BEST_AUDIO_ID);
  const videos = task.formats.filter((f) => f.formatId.startsWith('video-'));
  const audios = task.formats.filter((f) => f.formatId.startsWith('audio-') && f.formatId !== BEST_AUDIO_ID);
  const raw = task.formats.filter((f) => f.formatId.startsWith('fmt-'));

  return (
    <div className="join w-full">
      <label className="select select-sm join-item w-full">
        {isAudio ? <FileAudio size={14} className="opacity-60" /> : <FileVideo size={14} className="opacity-60" />}
        <select value={selected} onChange={(e) => onFormatChange(task.id, e.target.value)} aria-label={m.task.format}>
          {best.length > 0 && (
            <optgroup label={m.task.bestGroup}>
              {best.map((f) => (
                <option key={f.formatId} value={f.formatId}>
                  {[`★ ${f.formatId === BEST_ID ? f.resolution : m.formats.bestAudio}`, f.note, f.filesize === formatFilesize(null) ? '' : f.filesize].filter(Boolean).join(' · ')}
                </option>
              ))}
            </optgroup>
          )}
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
          {raw.length > 0 && (
            <optgroup label={m.task.allFormatsGroup}>
              {raw.map((f) => (
                <option key={f.formatId} value={f.formatId}>
                  {[f.resolution, f.ext, f.note, f.filesize === formatFilesize(null) ? '' : f.filesize].filter(Boolean).join(' · ')}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <button onClick={() => onStartDownload(task)} className="btn btn-sm btn-neutral join-item gap-1.5">
        <Download size={14} /> {m.task.download}
      </button>
    </div>
  );
}
