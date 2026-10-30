// Dosya adi kaliplari: kullanicinin yazdigi `{kanal} - {baslik}` gibi kaliplar yt-dlp sablonuna cevrilir.
// Kaliplar dile bagli degildir; arayuz alanlari etiketleriyle gosterir.

/** Kalipta kullanilabilen alanlar ve yt-dlp karsiliklari. */
export const FILENAME_FIELDS = {
  title: '%(title)s',
  channel: '%(channel,uploader,uploader_id)s',
  id: '%(id)s',
  date: '%(upload_date>%Y-%m-%d)s',
  site: '%(extractor_key)s',
} as const;

export type FilenameField = keyof typeof FILENAME_FIELDS;

/** Hazir kaliplar; `custom` kullanicinin yazdigi kaliptir. Eski ayar anahtarlari da burada. */
export const FILENAME_PRESETS: Record<string, string> = {
  title: '{title}',
  'channel-title': '{channel} - {title}',
  'title-id': '{title} [{id}]',
  'channel-title-id': '{channel} - {title} [{id}]',
  'date-title': '{date} {title}',
  'channel-date-title': '{channel} - {date} - {title}',
  // v0.3 ve oncesi ayar anahtari.
  'uploader-title': '{channel} - {title}',
};

export const DEFAULT_PATTERN = FILENAME_PRESETS.title;

const TOKEN = /\{([a-z]+)\}/g;
/** Dosya adlarinda gecersiz ya da klasor olusturan karakterler. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/g;

export type PatternError = 'empty' | 'noField' | 'unknownField';

/** Kalip kullanilabilir mi; degilse neden. */
export function patternError(pattern: string): PatternError | null {
  const text = pattern.trim();
  if (!text) return 'empty';
  const fields = [...text.matchAll(TOKEN)].map((m) => m[1]);
  if (fields.some((f) => !(f in FILENAME_FIELDS))) return 'unknownField';
  // Alansiz kalipta butun videolar ayni adi alirdi.
  if (fields.length === 0) return 'noField';
  return null;
}

/** Ayardaki ya da gorevdeki secimden kalip: hazir anahtar, `custom` ya da dogrudan kalip. */
export function resolvePattern(choice: string | undefined, custom?: string): string {
  if (choice === 'custom') return custom && !patternError(custom) ? custom.trim() : DEFAULT_PATTERN;
  return (choice && FILENAME_PRESETS[choice]) ?? DEFAULT_PATTERN;
}

/** Kalibi yt-dlp `-o` sablonuna cevirir; duz metindeki `%` kacirilir, gecersiz karakterler `_` olur. */
export function toYtdlpTemplate(pattern: string): string {
  const safe = patternError(pattern) ? DEFAULT_PATTERN : pattern.trim();
  return safe
    .split(TOKEN)
    .map((part, i) => (i % 2 === 1
      ? FILENAME_FIELDS[part as FilenameField]
      : part.replace(UNSAFE, '_').replace(/%/g, '%%')))
    .join('');
}

export type FilenameSample = Partial<Record<FilenameField, string>>;

/** Arayuzde onizleme: alanlar bilinen degerlerle, bilinmeyenler alan adiyla doldurulur. */
export function previewFilename(pattern: string, sample: FilenameSample, labels: Record<FilenameField, string>): string {
  const safe = patternError(pattern) ? DEFAULT_PATTERN : pattern.trim();
  return safe
    .split(TOKEN)
    .map((part, i) => (i % 2 === 1
      ? (sample[part as FilenameField] || labels[part as FilenameField]).replace(UNSAFE, '_')
      : part.replace(UNSAFE, '_')))
    .join('');
}
