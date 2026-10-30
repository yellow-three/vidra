import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { resolvePattern } from '../../engine/filename';
import { isAudioOptionId } from '../../engine/ytdlp';
import type { Task } from '../../types';
import { useT } from '../../i18n';
import { useSettings } from '../settings/queries';
import FilenamePicker from './FilenamePicker';
import { useQueueStore } from './store';

/** Bu video icin altyazi ve dosya adi; secilmezse Ayarlar'daki varsayilanlar kullanilir. */
export default function VideoOptions({ task }: { task: Task }) {
  const m = useT();
  const settings = useSettings().data ?? {};
  const setVideoOptions = useQueueStore((s) => s.setVideoOptions);
  const customized = task.subtitles !== undefined || task.filenamePattern !== undefined;
  const [open, setOpen] = useState(customized);
  const audio = isAudioOptionId(task.selectedFormatId);
  const subtitles = task.subtitles ?? settings.downloadSubtitles ?? false;
  const defaultPattern = resolvePattern(settings.filenameTemplate, settings.filenameCustom);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-xs gap-1 self-start">
        <SlidersHorizontal size={14} /> {m.videoOptions.open}
      </button>
    );
  }

  const reset = () => {
    setVideoOptions(task.id, { subtitles: undefined, filenamePattern: undefined });
    setOpen(false);
  };

  return (
    <div className="rounded-box bg-base-200 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={14} className="opacity-60" />
        <span className="text-sm font-medium">{m.videoOptions.title}</span>
        <button onClick={reset} className="btn btn-ghost btn-xs btn-square ml-auto" aria-label={m.videoOptions.reset}>
          <X size={14} />
        </button>
      </div>
      {!audio && (
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={subtitles}
            onChange={(e) => setVideoOptions(task.id, { subtitles: e.target.checked, filenamePattern: task.filenamePattern })}
          />
          {m.videoOptions.subtitles}
          <span className="text-xs text-base-content/50">({settings.subtitleLangs?.trim() || 'tr,en'})</span>
        </label>
      )}
      <FilenamePicker
        value={task.filenamePattern}
        onChange={(pattern) => setVideoOptions(task.id, { subtitles: task.subtitles, filenamePattern: pattern })}
        defaultLabel={m.videoOptions.defaultFilename}
        defaultPattern={defaultPattern}
        sample={{ ...task.meta, title: task.title }}
        suffix={audio ? '' : ' [1080p]'}
      />
    </div>
  );
}
