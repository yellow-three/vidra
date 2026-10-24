// yt-dlp'ye ozgu saf mantik: secenekler, arguman uretimi, cikti ayristirma.
// Platformdan bagimsizdir; masaustu ve Android motorlari ayni kodu kullanir.

import { joinPath, splitPath, stem } from './paths';
import type { DownloadOption, FormatOption } from './types';

/** `yt-dlp -J` ciktisindaki format nesnesinin kullandigimiz alanlari. */
export interface YtdlpFormat {
  format_id: string;
  ext?: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
}

export const PROGRESS_PREFIX = '[progress] ';
export const DEST_PREFIX = 'DEST:';
export const FILE_PREFIX = 'FILE:';

export function parseOption(id: string): DownloadOption | null {
  if (id === 'audio-mp3') return { kind: 'mp3' };
  if (id === 'audio-m4a') return { kind: 'm4a' };
  if (id === 'video-best') return { kind: 'best-video' };
  const match = /^video-(\d+)$/.exec(id);
  return match ? { kind: 'video', height: Number(match[1]) } : null;
}

export function optionLabel(option: DownloadOption): string {
  switch (option.kind) {
    case 'video': return `${option.height}p`;
    case 'best-video': return 'En iyi';
    case 'mp3': return 'MP3';
    case 'm4a': return 'M4A';
  }
}

export function formatFilesize(bytes: number | null | undefined): string {
  if (bytes == null) return 'Bilinmiyor';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const sizeOf = (f: YtdlpFormat) => f.filesize ?? f.filesize_approx ?? undefined;
const isVideo = (f: YtdlpFormat) => !!f.vcodec && f.vcodec !== 'none';
const isAudioOnly = (f: YtdlpFormat) => f.vcodec === 'none' && !!f.acodec && f.acodec !== 'none';
const maxOf = (values: (number | undefined)[]) => {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.max(...nums) : undefined;
};

/** Ham format listesini sade seceneklere indirger: her cozunurluk icin bir video, arti MP3/M4A. */
export function buildOptions(formats: YtdlpFormat[]): FormatOption[] {
  const bestAudio = maxOf(formats.filter((f) => isAudioOnly(f) && f.ext === 'm4a').map(sizeOf));
  const heights = [...new Set(formats.filter(isVideo).map((f) => f.height).filter((h): h is number => h != null))]
    .sort((a, b) => b - a);

  const options: FormatOption[] = heights.map((h) => {
    const video = maxOf(formats.filter((f) => isVideo(f) && f.height === h).map(sizeOf));
    return {
      formatId: `video-${h}`,
      resolution: `${h}p`,
      ext: 'mp4',
      note: 'Video + ses',
      filesize: formatFilesize(video == null ? null : video + (bestAudio ?? 0)),
    };
  });

  if (options.length === 0) {
    options.push({ formatId: 'video-best', resolution: 'En iyi', ext: 'mp4', note: 'Video + ses', filesize: formatFilesize(null) });
  }
  options.push(
    { formatId: 'audio-mp3', resolution: 'Ses', ext: 'mp3', note: 'En iyi kalite', filesize: formatFilesize(bestAudio) },
    { formatId: 'audio-m4a', resolution: 'Ses', ext: 'm4a', note: 'Dönüştürmesiz', filesize: formatFilesize(bestAudio) },
  );
  return options;
}

/**
 * YouTube imza cozumu icin yt-dlp'ye paketlenmis deno'yu gosterir;
 * yt-dlp deno'yu kendiliginden yalnizca PATH'te arar.
 */
export function jsRuntimeArgs(denoPath?: string | null): string[] {
  return denoPath ? ['--js-runtimes', `deno:${denoPath}`] : [];
}

export function buildInfoArgs(url: string, denoPath?: string | null): string[] {
  return [url, '-J', '--no-playlist', ...jsRuntimeArgs(denoPath)];
}

export interface DownloadArgsInput {
  url: string;
  option: DownloadOption;
  outDir: string;
  ffmpegPath?: string | null;
  subtitles: boolean;
  denoPath?: string | null;
}

export function buildDownloadArgs({ url, option, outDir, ffmpegPath, subtitles, denoPath }: DownloadArgsInput): string[] {
  const args = [
    url,
    '-o', joinPath(outDir, '%(title)s.%(ext)s'),
    '--no-playlist',
    '--newline',
    '--progress',
    '--progress-template', `download:${PROGRESS_PREFIX}%(progress)j`,
    '--print', `before_dl:${DEST_PREFIX}%(filename)s`,
    '--print', `after_move:${FILE_PREFIX}%(filepath)s`,
  ];

  switch (option.kind) {
    case 'video':
      args.push(
        '-f', `bv*[height<=${option.height}]+ba/b[height<=${option.height}]/bv*+ba/b`,
        // Once cozunurluk, ayni cozunurlukte MP4 uyumlu kodekler (H.264 + AAC).
        // `res` basta olmazsa H.264'lu 360p birlesik format 4K'nin onune gecer.
        '-S', 'res,vcodec:h264,acodec:m4a',
        '--merge-output-format', 'mp4',
      );
      break;
    case 'best-video':
      args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
      break;
    case 'mp3':
      args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
      break;
    case 'm4a':
      args.push('-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a');
      break;
  }

  if (subtitles && option.kind !== 'mp3' && option.kind !== 'm4a') {
    // `--write-subs` eklenirse gomulduktan sonra .vtt dosyasi da diskte kalir.
    args.push('--embed-subs', '--sub-langs', 'tr,en');
  }
  if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath);
  args.push(...jsRuntimeArgs(denoPath));
  return args;
}

export type OutputLine =
  | { type: 'progress'; percent: number; speed: string; eta: string }
  | { type: 'destination'; path: string }
  | { type: 'file'; path: string };

interface ProgressJson {
  status?: string;
  downloaded_bytes?: number | null;
  total_bytes?: number | null;
  total_bytes_estimate?: number | null;
  speed?: number | null;
  eta?: number | null;
}

function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function parseOutputLine(line: string): OutputLine | null {
  if (line.startsWith(DEST_PREFIX)) return { type: 'destination', path: line.slice(DEST_PREFIX.length).trim() };
  if (line.startsWith(FILE_PREFIX)) return { type: 'file', path: line.slice(FILE_PREFIX.length).trim() };
  if (!line.startsWith(PROGRESS_PREFIX)) return null;

  let p: ProgressJson;
  try {
    p = JSON.parse(line.slice(PROGRESS_PREFIX.length));
  } catch {
    return null;
  }
  const total = p.total_bytes ?? p.total_bytes_estimate;
  const percent = p.status === 'finished'
    ? 100
    : total && p.downloaded_bytes != null ? Math.min(100, (p.downloaded_bytes / total) * 100) : 0;
  return {
    type: 'progress',
    percent,
    speed: p.speed != null ? `${formatFilesize(p.speed)}/s` : '',
    eta: p.eta != null ? formatEta(p.eta) : '',
  };
}

/** yt-dlp stderr'inden kullaniciya gosterilecek son anlamli satirlar. */
export function lastErrorLines(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('[debug]') && !l.startsWith('WARNING:'))
    .slice(-2)
    .join('\n');
}

/** Dosya sistemi mtime'i kaba saatle yazar; yeni dosyalar baslangictan biraz once gorunebilir. */
const MTIME_TOLERANCE_MS = 2000;

/**
 * Iptal edilen indirmenin bu oturumda yazdigi dosyalar
 * (`Ad.f137.mp4.part`, `Ad.temp.mp4`, `Ad.en.vtt`, birlesmis `Ad.mp4` ...).
 * Daha once indirilmis ayni adli dosyalar degistirilme zamani sayesinde secilmez.
 */
export function partialFilesToRemove(
  destination: string,
  entries: { name: string; mtimeMs: number }[],
  startedMs: number,
): string[] {
  const prefix = stem(splitPath(destination).name) + '.';
  return entries
    .filter((e) => e.name.startsWith(prefix) && e.mtimeMs >= startedMs - MTIME_TOLERANCE_MS)
    .map((e) => e.name);
}
