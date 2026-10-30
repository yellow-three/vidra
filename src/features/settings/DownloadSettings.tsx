import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { DEFAULT_CONCURRENT_DOWNLOADS } from '../queue/store';
import FilenamePicker from '../queue/FilenamePicker';
import { FILENAME_PRESETS, resolvePattern } from '../../engine/filename';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField, ToggleRow } from './SettingsParts';
import { useT } from '../../i18n';

const RATE_LIMITS: [string, string][] = [
  ['500K', '500 KB/s'],
  ['1M', '1 MB/s'],
  ['2M', '2 MB/s'],
  ['5M', '5 MB/s'],
  ['10M', '10 MB/s'],
];

export default function DownloadSettings() {
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();
  const m = useT().downloadSettings;
  const concurrency = [1, 2, 3, 4, 5].map((n): [string, string] => [String(n), n === 1 ? m.sequential : String(n)]);
  // Hazir kalip anahtar olarak, digerleri `custom` + kalip olarak saklanir.
  const saveFilename = (pattern: string | undefined) => {
    if (!pattern) return;
    const key = Object.keys(FILENAME_PRESETS).find((k) => k !== 'uploader-title' && FILENAME_PRESETS[k] === pattern);
    save.mutate(key ? { filenameTemplate: key } : { filenameTemplate: 'custom', filenameCustom: pattern });
  };

  return (
    <Section title={m.title} icon={<Gauge size={18} />}>
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField
          legend={m.concurrent}
          value={String(settings.maxConcurrentDownloads ?? DEFAULT_CONCURRENT_DOWNLOADS)}
          options={concurrency}
          onChange={(v) => save.mutate({ maxConcurrentDownloads: Number(v) })}
        />
        <SelectField
          legend={m.rateLimit}
          value={settings.rateLimit || ''}
          options={[['', m.unlimited], ...RATE_LIMITS]}
          onChange={(v) => save.mutate({ rateLimit: v })}
        />
      </div>
      <FilenamePicker
        value={resolvePattern(settings.filenameTemplate, settings.filenameCustom)}
        onChange={saveFilename}
        suffix=" [1080p].mp4"
      />
      <p className="text-xs text-base-content/60 -mt-2">{m.filenameNote}</p>
      <div className="divider my-0" />
      <ToggleRow
        label={m.embed}
        description={m.embedHint}
        checked={settings.embedMetadata ?? true}
        onChange={(v) => save.mutate({ embedMetadata: v })}
      />
      <ToggleRow
        label={m.playlistFolder}
        description={m.playlistFolderHint}
        checked={settings.playlistSubfolder ?? true}
        onChange={(v) => save.mutate({ playlistSubfolder: v })}
      />
    </Section>
  );
}

const LANGS_PATTERN = /^[\w-]+(?:\s*,\s*[\w-]+)*$/;

/** `--sub-langs` icin dil kodlari; yazarken degil, kutudan cikinca kaydedilir. */
export function SubtitleLanguages() {
  const saved = useSettings().data?.subtitleLangs ?? '';
  const save = useSaveSettings();
  const m = useT().settings;
  // Kullanici yazmiyorken (null) kayitli degeri gosterir.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const valid = value.trim() === '' || LANGS_PATTERN.test(value.trim());

  const commit = () => {
    const next = value.trim().replace(/\s+/g, '');
    if (valid && next !== saved) save.mutate({ subtitleLangs: next });
    if (valid) setDraft(null);
  };

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{m.subtitleLangs}</legend>
      <input
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="tr,en"
        aria-label={m.subtitleLangs}
        aria-invalid={!valid}
        className={`input w-full font-mono ${valid ? '' : 'input-error'}`}
      />
      <p className={`label whitespace-normal ${valid ? '' : 'text-error'}`}>
        {valid ? m.subtitleLangsHint : m.subtitleLangsInvalid}
      </p>
    </fieldset>
  );
}
