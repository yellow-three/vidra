import { Gauge } from 'lucide-react';
import { DEFAULT_CONCURRENT_DOWNLOADS } from '../queue/store';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField, ToggleRow } from './SettingsParts';

const CONCURRENCY = [1, 2, 3, 4, 5].map((n): [string, string] => [String(n), n === 1 ? '1 (sırayla)' : String(n)]);

// Anahtarlar engine/ytdlp.ts FILENAME_TEMPLATES ile ayni.
const FILENAMES: [string, string][] = [
  ['title', 'Başlık'],
  ['uploader-title', 'Kanal - Başlık'],
  ['title-id', 'Başlık [video kimliği]'],
];

const RATE_LIMITS: [string, string][] = [
  ['', 'Sınırsız'],
  ['500K', '500 KB/s'],
  ['1M', '1 MB/s'],
  ['2M', '2 MB/s'],
  ['5M', '5 MB/s'],
  ['10M', '10 MB/s'],
];

export default function DownloadSettings() {
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();

  return (
    <Section title="İndirme" icon={<Gauge size={18} />}>
      <div className="grid sm:grid-cols-3 gap-4">
        <SelectField
          legend="Aynı anda"
          value={String(settings.maxConcurrentDownloads ?? DEFAULT_CONCURRENT_DOWNLOADS)}
          options={CONCURRENCY}
          onChange={(v) => save.mutate({ maxConcurrentDownloads: Number(v) })}
        />
        <SelectField
          legend="Dosya adı"
          value={settings.filenameTemplate || 'title'}
          options={FILENAMES}
          onChange={(v) => save.mutate({ filenameTemplate: v })}
        />
        <SelectField
          legend="Hız sınırı"
          value={settings.rateLimit || ''}
          options={RATE_LIMITS}
          onChange={(v) => save.mutate({ rateLimit: v })}
        />
      </div>
      <p className="text-xs text-base-content/60">
        Videoların adına çözünürlük eklenir (örn. <span className="font-mono">Başlık [1080p].mp4</span>); böylece aynı videonun farklı kaliteleri birbirinin yerine geçmez.
      </p>
      <div className="divider my-0" />
      <ToggleRow
        label="Kapak resmi ve bilgileri göm"
        description="Kapak resmi, başlık, kanal, tarih ve bölümler dosyaya eklenir; müzik çalarlarda görünür."
        checked={settings.embedMetadata ?? true}
        onChange={(v) => save.mutate({ embedMetadata: v })}
      />
    </Section>
  );
}
