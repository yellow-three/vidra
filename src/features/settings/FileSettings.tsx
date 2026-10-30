import { useQuery } from '@tanstack/react-query';
import { FolderTree } from 'lucide-react';
import type { AppSettings } from '../../types';
import { appApi } from '../../lib/appApi';
import { useT } from '../../i18n';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField, ToggleRow } from './SettingsParts';

/** Klasor duzeni, dosya adi kurallari, ayni ad, harici indirici (roadmap Grup 5). */
export default function FileSettings() {
  const m = useT().files;
  const settings: AppSettings = useSettings().data ?? {};
  const save = useSaveSettings();
  const aria2 = useQuery({ queryKey: ['aria2'], queryFn: () => appApi.aria2Available() }).data;

  return (
    <Section title={m.title} icon={<FolderTree size={18} />}>
      <div className="grid sm:grid-cols-3 gap-4">
        <SelectField
          legend={m.layout}
          value={settings.folderLayout ?? ''}
          options={[['', m.layoutNone], ['channel', m.layoutChannel], ['channel-year', m.layoutChannelYear], ['site-channel', m.layoutSiteChannel], ['year', m.layoutYear]]}
          onChange={(v) => save.mutate({ folderLayout: v || undefined })}
          hint={m.layoutHint}
        />
        <SelectField
          legend={m.chars}
          value={settings.filenameChars ?? ''}
          options={[['', m.charsAsIs], ['windows', m.charsWindows], ['ascii', m.charsAscii]]}
          onChange={(v) => save.mutate({ filenameChars: (v || undefined) as AppSettings['filenameChars'] })}
          hint={m.charsHint}
        />
        <SelectField
          legend={m.trim}
          value={String(settings.trimFilenames ?? 0)}
          options={[['0', m.trimOff], ...[80, 120, 180].map((n): [string, string] => [String(n), m.trimChars(n)])]}
          onChange={(v) => save.mutate({ trimFilenames: Number(v) })}
        />
      </div>
      <ToggleRow label={m.overwrite} description={m.overwriteHint} checked={settings.overwrite ?? false} onChange={(v) => save.mutate({ overwrite: v })} />
      {aria2 && (
        <ToggleRow label={m.aria2} description={m.aria2Hint} checked={settings.aria2 ?? false} onChange={(v) => save.mutate({ aria2: v })} />
      )}
    </Section>
  );
}
