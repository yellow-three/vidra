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
  const customized = task.subtitles !== undefined || task.filenamePattern !== undefined || task.subtitleLangs !== undefined
    || task.splitChapters !== undefined;
  const [open, setOpen] = useState(customized);
  const audio = isAudioOptionId(task.selectedFormatId);
  const subtitles = task.subtitles ?? settings.downloadSubtitles ?? false;
  const langs = (task.subtitleLangs ?? settings.subtitleLangs ?? 'tr,en').split(',').map((l) => l.trim()).filter(Boolean);
  const available = task.meta?.subtitles ?? [];
  const auto = settings.autoSubtitles ? (task.meta?.autoSubtitles ?? []).filter((l) => !available.includes(l)) : [];
  const toggleLang = (lang: string) => {
    const next = langs.includes(lang) ? langs.filter((l) => l !== lang) : [...langs, lang];
    setVideoOptions(task.id, { subtitleLangs: next.join(',') });
  };
  const defaultPattern = resolvePattern(settings.filenameTemplate, settings.filenameCustom);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-xs gap-1 self-start">
        <SlidersHorizontal size={14} /> {m.videoOptions.open}
      </button>
    );
  }

  const reset = () => {
    setVideoOptions(task.id, { subtitles: undefined, subtitleLangs: undefined, filenamePattern: undefined, splitChapters: undefined });
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
            onChange={(e) => setVideoOptions(task.id, { subtitles: e.target.checked })}
          />
          {m.videoOptions.subtitles}
          <span className="text-xs text-base-content/50">({langs.join(', ') || '-'})</span>
        </label>
      )}
      {!audio && subtitles && task.meta?.subtitles && (
        available.length + auto.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 pl-6" role="group" aria-label={m.videoOptions.languages}>
            <span className="text-xs text-base-content/60 mr-1">{m.videoOptions.languages}:</span>
            {[...available.map((l) => [l, false] as const), ...auto.map((l) => [l, true] as const)].map(([lang, isAuto]) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLang(lang)}
                aria-pressed={langs.includes(lang)}
                className={`badge badge-sm cursor-pointer ${langs.includes(lang) ? 'badge-primary' : 'badge-ghost'}`}
              >
                {lang}{isAuto ? ` (${m.videoOptions.auto})` : ''}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-base-content/50 pl-6">
            {task.meta.autoSubtitles?.length ? m.videoOptions.onlyAuto(task.meta.autoSubtitles.join(', ')) : m.videoOptions.none}
          </p>
        )
      )}
      {(task.meta?.chapters ?? 0) > 1 && (
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={task.splitChapters ?? settings.splitChapters ?? false}
            onChange={(e) => setVideoOptions(task.id, { splitChapters: e.target.checked })}
          />
          {m.videoOptions.splitChapters(task.meta!.chapters!)}
        </label>
      )}
      <FilenamePicker
        value={task.filenamePattern}
        onChange={(pattern) => setVideoOptions(task.id, { filenamePattern: pattern })}
        defaultLabel={m.videoOptions.defaultFilename}
        defaultPattern={defaultPattern}
        sample={{ ...task.meta, title: task.title, index: task.playlistIndex }}
        suffix={audio ? '' : ' [1080p]'}
      />
    </div>
  );
}
