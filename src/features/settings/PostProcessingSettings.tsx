import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { AppSettings } from '../../types';
import { useT } from '../../i18n';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField, ToggleRow } from './SettingsParts';

type Toggle = 'splitChapters' | 'parseArtist' | 'writeThumbnail' | 'writeDescription' | 'writeInfoJson' | 'writeComments' | 'serverMtime';

/** Duzenli ifade gecerli mi; yt-dlp (Python) ifadeleri basit kaliplarda JavaScript'le ayni. */
function regexError(text: string): boolean {
  try {
    new RegExp(text.replace(/^\(\?i\)/, ''));
    return false;
  } catch {
    return true;
  }
}

/** Indirme sonrasi: bolumler, kap, etiketler, ek dosyalar, dosya tarihi (roadmap Grup 3). */
export default function PostProcessingSettings() {
  const m = useT().postProcessing;
  const settings: AppSettings = useSettings().data ?? {};
  const save = useSaveSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const removeChapters = draft ?? settings.removeChapters ?? '';
  const invalid = removeChapters.trim() !== '' && regexError(removeChapters.trim());
  const [execDraft, setExecDraft] = useState<string | null>(null);
  const execCommand = execDraft ?? settings.execCommand ?? '';

  const toggle = (key: Toggle) => ({
    checked: settings[key] ?? false,
    onChange: (v: boolean) => save.mutate({ [key]: v }),
  });
  const commit = () => {
    if (invalid) return;
    if (removeChapters.trim() !== (settings.removeChapters ?? '')) save.mutate({ removeChapters: removeChapters.trim() });
    setDraft(null);
  };
  const commitExec = () => {
    if (execCommand.trim() !== (settings.execCommand ?? '')) save.mutate({ execCommand: execCommand.trim() });
    setExecDraft(null);
  };

  return (
    <Section title={m.title} icon={<Wand2 size={18} />}>
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField
          legend={m.remux}
          value={settings.remux ?? ''}
          options={[['', m.remuxOff], ['mp4', 'MP4'], ['mkv', 'MKV']]}
          onChange={(v) => save.mutate({ remux: (v || undefined) as AppSettings['remux'] })}
          hint={m.remuxHint}
        />
        <fieldset className="fieldset">
          <legend className="fieldset-legend">{m.removeChapters}</legend>
          <input
            value={removeChapters}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            placeholder="(?i)intro|outro"
            aria-label={m.removeChapters}
            aria-invalid={invalid}
            className={`input w-full font-mono ${invalid ? 'input-error' : ''}`}
          />
          <p className={`label whitespace-normal ${invalid ? 'text-error' : ''}`}>{invalid ? m.badRegex : m.removeChaptersHint}</p>
        </fieldset>
      </div>
      <ToggleRow label={m.splitChapters} description={m.splitChaptersHint} {...toggle('splitChapters')} />
      <ToggleRow label={m.parseArtist} description={m.parseArtistHint} {...toggle('parseArtist')} />
      <div className="divider my-0" />
      <p className="text-sm font-medium">{m.extras}</p>
      <ToggleRow label={m.writeThumbnail} description={m.writeThumbnailHint} {...toggle('writeThumbnail')} />
      <ToggleRow label={m.writeDescription} description={m.writeDescriptionHint} {...toggle('writeDescription')} />
      <ToggleRow label={m.writeInfoJson} description={m.writeInfoJsonHint} {...toggle('writeInfoJson')} />
      <ToggleRow label={m.writeComments} description={m.writeCommentsHint} {...toggle('writeComments')} />
      <div className="divider my-0" />
      <ToggleRow label={m.serverMtime} description={m.serverMtimeHint} {...toggle('serverMtime')} />
      <div className="divider my-0" />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{m.exec}</legend>
        <input
          value={execCommand}
          onChange={(e) => setExecDraft(e.target.value)}
          onBlur={commitExec}
          onKeyDown={(e) => e.key === 'Enter' && commitExec()}
          placeholder='notify-send "Vidra" {}'
          aria-label={m.exec}
          className="input w-full font-mono"
        />
        <p className="label whitespace-normal">{m.execHint}</p>
      </fieldset>
    </Section>
  );
}
