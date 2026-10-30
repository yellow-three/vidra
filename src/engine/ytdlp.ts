// yt-dlp'ye ozgu saf mantik: secenekler, arguman uretimi, cikti ayristirma.
// Platformdan bagimsizdir; masaustu ve Android motorlari ayni kodu kullanir.

import { msg } from '../i18n';
import { DEFAULT_PATTERN, toYtdlpTemplate } from './filename';
import { joinPath, splitPath, stem } from './paths';
import type { AudioCodec, DownloadOption, FormatOption, PostProcessing, NetworkOptions, PlaylistEntry, SponsorBlockMode, TimeRange, VideoInfo } from './types';

/** `yt-dlp -J` ciktisindaki format nesnesinin kullandigimiz alanlari. */
export interface YtdlpFormat {
  format_id: string;
  ext?: string;
  vcodec?: string | null;
  acodec?: string | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  tbr?: number | null;
  abr?: number | null;
  format_note?: string | null;
  dynamic_range?: string | null;
  filesize?: number | null;
  filesize_approx?: number | null;
}

export const PROGRESS_PREFIX = '[progress] ';
export const DEST_PREFIX = 'DEST:';
export const FILE_PREFIX = 'FILE:';

/** En iyi kombinasyonlar; `video-` onekiyle baslamaz ki varsayilan kalite secimine karismasin. */
export const BEST_ID = 'best-av';
export const BEST_AUDIO_ID = 'audio-best';

/** Ham format secenekleri: `fmt-v-137` (yalniz goruntu), `fmt-a-251` (yalniz ses), `fmt-av-18`. */
const RAW_PREFIX = /^fmt-(av|v|a)-(.+)$/;

export function parseOption(id: string): DownloadOption | null {
  const raw = RAW_PREFIX.exec(id);
  if (raw) return { kind: 'format', formatId: raw[2], video: raw[1] !== 'a', audio: raw[1] !== 'v' };
  if (id === BEST_ID) return { kind: 'best' };
  if (id === BEST_AUDIO_ID) return { kind: 'best-audio' };
  const codec = /^audio-(opus|flac|wav)$/.exec(id);
  if (codec) return { kind: 'audio', codec: codec[1] as AudioCodec };
  if (id === 'audio-mp3') return { kind: 'mp3' };
  if (id === 'audio-m4a') return { kind: 'm4a' };
  if (id === 'video-best') return { kind: 'best-video' };
  const match = /^video-(\d+)$/.exec(id);
  return match ? { kind: 'video', height: Number(match[1]) } : null;
}

export function optionLabel(option: DownloadOption): string {
  switch (option.kind) {
    case 'video': return `${option.height}p`;
    case 'best-video': return msg().formats.best;
    case 'best': return msg().formats.bestQuality;
    case 'best-audio': return msg().formats.bestAudio;
    case 'mp3': return 'MP3';
    case 'm4a': return 'M4A';
    case 'audio': return option.codec.toUpperCase();
    case 'format': return `${msg().formats.formatCode} ${option.formatId}`;
  }
}

/** Sonuc yalnizca ses mi (kapak yerine ses simgesi, altyazi yok). */
export const isAudioOptionId = (id: string | undefined) => !!id && (id.startsWith('audio-') || id.startsWith('fmt-a-'));

export function formatFilesize(bytes: number | null | undefined): string {
  if (bytes == null) return msg().formats.unknownSize;
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
  const m = msg().formats;
  const bestAudio = maxOf(formats.filter((f) => isAudioOnly(f) && f.ext === 'm4a').map(sizeOf));
  const heights = [...new Set(formats.filter(isVideo).map((f) => f.height).filter((h): h is number => h != null))]
    .sort((a, b) => b - a);

  const options: FormatOption[] = heights.map((h) => {
    const video = maxOf(formats.filter((f) => isVideo(f) && f.height === h).map(sizeOf));
    const bytes = video == null ? undefined : video + (bestAudio ?? 0);
    return {
      formatId: `video-${h}`,
      resolution: `${h}p`,
      ext: 'mp4',
      note: msg().formats.videoAndAudio,
      filesize: formatFilesize(bytes),
      bytes,
    };
  });

  // Yalnizca ses sunan sitelerde (SoundCloud vb.) video secenegi olmaz.
  const audioOnlySite = formats.length > 0 && formats.every((f) => !isVideo(f) && f.vcodec !== undefined && f.vcodec !== null);
  if (options.length === 0 && !audioOnlySite) {
    options.push({ formatId: 'video-best', resolution: msg().formats.best, ext: 'mp4', note: msg().formats.videoAndAudio, filesize: formatFilesize(null) });
  }
  const raw = rawOptions(formats, bestAudio);
  // En iyi kombinasyonlar: ham listenin en ustundeki video ve ses (rawOptions kaliteye gore siralar).
  const topVideo = raw.find((o) => !o.formatId.startsWith('fmt-a-'));
  const topAudio = raw.find((o) => o.formatId.startsWith('fmt-a-'));
  // Yalniz goruntu formatinin boyutu en iyi sesi zaten icerir (rawOptions).
  const best: FormatOption[] = topVideo && formats.some(isVideo)
    ? [{ formatId: BEST_ID, resolution: m.bestQuality, ext: m.original, note: m.bestCombo(topVideo.resolution), filesize: topVideo.filesize, bytes: topVideo.bytes }]
    : [];
  const bestAudioOption: FormatOption[] = topAudio
    ? [{ formatId: BEST_AUDIO_ID, resolution: m.audio, ext: topAudio.ext, note: m.bestAudioNote, filesize: topAudio.filesize, bytes: topAudio.bytes }]
    : [];
  options.push(
    ...bestAudioOption,
    { formatId: 'audio-mp3', resolution: m.audio, ext: 'mp3', note: m.bestQuality, filesize: formatFilesize(bestAudio), bytes: bestAudio },
    { formatId: 'audio-m4a', resolution: m.audio, ext: 'm4a', note: m.noConversion, filesize: formatFilesize(bestAudio), bytes: bestAudio },
    ...convertedAudio(formatFilesize(bestAudio), bestAudio),
  );
  return [...best, ...options, ...raw];
}

/** MP3/M4A disindaki ses bicimleri; kayipsiz bicimlerin boyutu kaynaktan buyuk olur. */
function convertedAudio(filesize: string, bytes: number | undefined): FormatOption[] {
  const m = msg().formats;
  return [
    { formatId: 'audio-opus', resolution: m.audio, ext: 'opus', note: m.opusNote, filesize, bytes },
    { formatId: 'audio-flac', resolution: m.audio, ext: 'flac', note: m.losslessNote, filesize: formatFilesize(null), bytes: bytes && bytes * 6 },
    { formatId: 'audio-wav', resolution: m.audio, ext: 'wav', note: m.losslessNote, filesize: formatFilesize(null), bytes: bytes && bytes * 10 },
  ];
}

const codecName = (codec: string) => codec.split('.')[0];

/**
 * yt-dlp'nin listeledigi tum indirilebilir formatlar: once goruntulu olanlar (cozunurluk, sonra bit hizi),
 * sonra yalniz ses (bit hizi). Onizleme gorselleri (storyboard) ve ne goruntu ne ses tasiyan girdiler atlanir.
 */
export function rawOptions(formats: YtdlpFormat[], bestAudio?: number): FormatOption[] {
  const m = msg().formats;
  const hasVideo = (f: YtdlpFormat) => isVideo(f) && f.vcodec !== 'images';
  const hasAudio = (f: YtdlpFormat) => !!f.acodec && f.acodec !== 'none';
  // Codec bilgisi vermeyen siteler (vcodec/acodec yok) birlesik format sayilir.
  const unknown = (f: YtdlpFormat) => f.vcodec == null && f.acodec == null;
  const rank = (f: YtdlpFormat) => [hasVideo(f) || unknown(f) ? 1 : 0, f.height ?? 0, f.fps ?? 0, f.tbr ?? f.abr ?? 0];
  const byQuality = (a: YtdlpFormat, b: YtdlpFormat) => {
    const [ra, rb] = [rank(a), rank(b)];
    const i = ra.findIndex((v, k) => v !== rb[k]);
    return i === -1 ? 0 : rb[i] - ra[i];
  };
  return formats
    .filter((f) => f.ext !== 'mhtml' && (hasVideo(f) || hasAudio(f) || unknown(f)))
    .sort(byQuality)
    .map((f) => {
      const video = hasVideo(f) || unknown(f);
      const audio = hasAudio(f) || unknown(f);
      const kind = video && audio ? 'av' : video ? 'v' : 'a';
      const size = sizeOf(f);
      // Yalniz goruntu formatina en iyi ses eklenir; tahmini boyut da ona gore.
      const bytes = size == null ? undefined : kind === 'v' ? size + (bestAudio ?? 0) : size;
      const fps = f.fps && f.fps > 30 ? ` ${Math.round(f.fps)}fps` : '';
      const hdr = f.dynamic_range && f.dynamic_range !== 'SDR' ? ` ${f.dynamic_range}` : '';
      const resolution = video
        ? (f.height ? `${f.width ? `${f.width}x${f.height}` : `${f.height}p`}${fps}${hdr}` : f.format_note || m.unknownResolution)
        : m.audio;
      const bitrate = !video && f.abr ? ` ${Math.round(f.abr)}k` : '';
      const codecs = [
        video && f.vcodec && f.vcodec !== 'none' ? codecName(f.vcodec) : '',
        audio && f.acodec && f.acodec !== 'none' ? codecName(f.acodec) + bitrate : '',
      ].filter(Boolean).join(' + ');
      const note = [codecs, kind === 'v' ? m.plusBestAudio : kind === 'a' ? m.audioOnly : ''].filter(Boolean).join(' · ');
      return { formatId: `fmt-${kind}-${f.format_id}`, resolution, ext: f.ext ?? '', note, filesize: formatFilesize(bytes), bytes };
    })
    .map((o, i, all) => {
      // Siralamada ilk gelen goruntulu ve ilk gelen yalniz ses format en iyileridir.
      const audio = o.formatId.startsWith('fmt-a-');
      const first = all.findIndex((x) => x.formatId.startsWith('fmt-a-') === audio) === i;
      return first ? { ...o, note: [m.bestMark, o.note].filter(Boolean).join(' · ') } : o;
    });
}

/** Oynatma listesi girdileri tek tek analiz edilmez; her cozunurluk "en fazla" olarak sunulur. */
const PLAYLIST_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export function playlistOptions(): FormatOption[] {
  const m = msg().formats;
  const unknown = formatFilesize(null);
  return [
    { formatId: BEST_ID, resolution: m.bestQuality, ext: m.original, note: m.bestComboShort, filesize: unknown },
    ...PLAYLIST_HEIGHTS.map((h) => ({ formatId: `video-${h}`, resolution: `${h}p`, ext: 'mp4', note: m.upTo, filesize: unknown })),
    { formatId: BEST_AUDIO_ID, resolution: m.audio, ext: m.original, note: m.bestAudioNote, filesize: unknown },
    { formatId: 'audio-mp3', resolution: m.audio, ext: 'mp3', note: m.bestQuality, filesize: unknown },
    { formatId: 'audio-m4a', resolution: m.audio, ext: 'm4a', note: m.noConversion, filesize: unknown },
    ...convertedAudio(unknown, undefined),
  ];
}

/** `yt-dlp -J --flat-playlist` ciktisinin kullandigimiz alanlari. */
interface InfoJson {
  _type?: string;
  live_status?: string | null;
  chapters?: unknown[] | null;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  upload_date?: string;
  extractor_key?: string;
  duration?: number;
  thumbnail?: string;
  formats?: YtdlpFormat[];
  entries?: {
    id?: string;
    url?: string;
    title?: string;
    channel?: string;
    uploader?: string;
    duration?: number | null;
    thumbnails?: { url?: string }[];
  }[];
}

/** Silinmis/gizli videolar listede yer tutar ama indirilemez. */
const UNAVAILABLE_TITLES = new Set(['[Private video]', '[Deleted video]']);

export function parseInfo(json: string, url: string): VideoInfo {
  const data = JSON.parse(json) as InfoJson;
  if (data._type === 'playlist') {
    const entries: PlaylistEntry[] = (data.entries ?? [])
      .filter((e) => (e.url || e.id) && !UNAVAILABLE_TITLES.has(e.title ?? ''))
      .map((e) => ({
        url: e.url ?? `https://www.youtube.com/watch?v=${e.id}`,
        title: e.title ?? msg().formats.unknownVideo,
        duration: e.duration ?? undefined,
        thumbnail: e.thumbnails?.[e.thumbnails.length - 1]?.url,
        meta: { id: e.id, channel: e.channel ?? e.uploader ?? data.channel ?? data.uploader, site: data.extractor_key },
      }));
    return { title: data.title ?? msg().formats.playlist, url, formats: playlistOptions(), entries };
  }
  return {
    title: data.title ?? msg().formats.unknownVideo,
    url,
    duration: data.duration,
    thumbnail: data.thumbnail,
    formats: buildOptions(data.formats ?? []),
    meta: {
      id: data.id,
      channel: data.channel ?? data.uploader,
      // YYYYMMDD -> YYYY-MM-DD (yt-dlp sablonundaki bicim).
      date: data.upload_date?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      site: data.extractor_key,
      subtitles: Object.keys(data.subtitles ?? {}).filter((l) => l !== 'live_chat'),
      // YouTube her dile ceviri sunar; yalnizca konusmanin ozgun dili (`xx-orig`) gosterilir.
      chapters: data.chapters?.length,
      live: data.live_status === 'is_live' || data.live_status === 'is_upcoming' ? data.live_status : undefined,
      autoSubtitles: Object.keys(data.automatic_captions ?? {}).filter((l) => l.endsWith('-orig')).map((l) => l.slice(0, -5)),
    },
  };
}

/** `watch?v=..&list=..`: video tek basina indirilir, istenirse liste ayrica eklenir. */
export function isVideoInPlaylist(url: string): boolean {
  return /[?&]v=/.test(url) && /[?&]list=/.test(url);
}

/**
 * YouTube imza cozumu icin yt-dlp'ye paketlenmis deno'yu gosterir;
 * yt-dlp deno'yu kendiliginden yalnizca PATH'te arar.
 */
export function jsRuntimeArgs(denoPath?: string | null): string[] {
  return denoPath ? ['--js-runtimes', `deno:${denoPath}`] : [];
}

export function networkArgs({ cookiesFromBrowser, proxy, videoPassword, netrc, ageLimit }: NetworkOptions): string[] {
  return [
    ...(cookiesFromBrowser ? ['--cookies-from-browser', cookiesFromBrowser] : []),
    ...(proxy ? ['--proxy', proxy] : []),
    ...(videoPassword ? ['--video-password', videoPassword] : []),
    ...(netrc ? ['--netrc', ...(typeof netrc === 'string' ? ['--netrc-location', netrc] : [])] : []),
    ...(ageLimit ? ['--age-limit', String(ageLimit)] : []),
  ];
}

/** Link en sonda ve `--` ardindan: `-` ile baslayan bir metin yt-dlp secenegi olarak okunmaz. */
const urlArgs = (url: string) => ['--', url];

export interface InfoArgsInput extends NetworkOptions {
  url: string;
  denoPath?: string | null;
  playlist?: boolean;
}

export function buildInfoArgs({ url, denoPath, playlist, ...network }: InfoArgsInput): string[] {
  return [
    '-J',
    // Liste girdileri tek tek acilmaz; yuzlerce videoluk listede saniyeler yerine dakikalar surerdi.
    '--flat-playlist',
    playlist ? '--yes-playlist' : '--no-playlist',
    ...networkArgs(network),
    ...jsRuntimeArgs(denoPath),
    ...urlArgs(url),
  ];
}

/** `12:05` / `1:02:03` ya da saniye; dosya adlarinda `:` kullanilamadigi icin `.` ile yazilir. */
export function formatClock(seconds: number, sep = ':'): string {
  const s = Math.floor(seconds);
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const [h, m, sec] = parts.map((n) => String(n).padStart(2, '0'));
  return parts[0] ? [h, m, sec].join(sep) : [m, sec].join(sep);
}

/** `90`, `1:30`, `01:02:03` -> saniye; gecersizse null. */
export function parseClock(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(text)) return null;
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** Klasor adi olarak guvenli metin; `%` yt-dlp sablonunda kacirilir. */
export function safeFolderName(name: string): string {
  const cleaned = name
    // Kontrol karakterleri dosya adlarinda gecersiz; bilerek eslesiyor.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|[. ]+$/g, '')
    .slice(0, 100)
    .trim();
  return (cleaned || msg().formats.playlist).replace(/%/g, '%%');
}

export interface TemplateExtras {
  subfolder?: string;
  section?: TimeRange;
  /** Listedeki sira, orn. `03`. */
  playlistIndex?: string;
}

/**
 * Ayni videonun farkli kalitesi ayni ada yazilsaydi yt-dlp "already downloaded" deyip
 * eskisini dondururdu; cozunurluk ve bolum ekiyle her secim ayri dosyadir.
 */
export function outputTemplate(option: DownloadOption, pattern?: string, extras: TemplateExtras = {}): string {
  const base = toYtdlpTemplate(pattern ?? DEFAULT_PATTERN, extras.playlistIndex);
  const quality = option.kind === 'format'
    ? ' [%(format_id)s]'
    : option.kind === 'video' || option.kind === 'best-video' || option.kind === 'best' ? ' [%(height)sp]' : '';
  const { section, subfolder } = extras;
  const clip = section
    ? ` [${formatClock(section.start, '.')}-${section.end != null ? formatClock(section.end, '.') : msg().formats.sectionEnd}]`
    : '';
  const file = `${base}${quality}${clip}.%(ext)s`;
  return subfolder ? `${safeFolderName(subfolder)}/${file}` : file;
}

export interface DownloadArgsInput extends NetworkOptions, PostProcessing {
  url: string;
  option: DownloadOption;
  outDir: string;
  ffmpegPath?: string | null;
  subtitles: boolean;
  embedMetadata?: boolean;
  filenamePattern?: string;
  rateLimit?: string;
  denoPath?: string | null;
  subtitleLangs?: string;
  subfolder?: string;
  section?: TimeRange;
  sponsorBlock?: SponsorBlockMode;
  subtitleFile?: boolean;
  autoSubtitles?: boolean;
  concurrentFragments?: number;
  sleepInterval?: number;
  maxFilesize?: string;
  mp3Quality?: string;
  playlistIndex?: string;
  /** YYYYMMDD; daha once yuklenen videolar indirilmez. */
  dateAfter?: string;
  liveFromStart?: boolean;
  waitForVideo?: boolean;
}

/** Kopan baglantida indirme yarida kalmasin: istek ve parca basina 10 deneme, artan bekleme. */
const RETRY_ARGS = ['--retries', '10', '--fragment-retries', '10', '--retry-sleep', 'fragment:exp=1:20'];

/** Kesilince videonun konusu bozulmayan SponsorBlock kategorileri; isaretlemede hepsi bolum olur. */
const SPONSOR_REMOVE = 'sponsor,selfpromo,interaction';

export function buildDownloadArgs({
  url, option, outDir, ffmpegPath, subtitles, embedMetadata, filenamePattern, rateLimit, denoPath,
  subtitleLangs, subfolder, section, sponsorBlock, subtitleFile, autoSubtitles, concurrentFragments,
  sleepInterval, maxFilesize, mp3Quality, playlistIndex, dateAfter, liveFromStart, waitForVideo,
  splitChapters, removeChapters, remux, parseArtist, writeThumbnail, writeDescription, writeInfoJson, writeComments,
  serverMtime, ...network
}: DownloadArgsInput): string[] {
  const args = [
    '-o', joinPath(outDir, outputTemplate(option, filenamePattern, { subfolder, section, playlistIndex })),
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
    case 'best':
      // Kap secilmez: VP9/AV1 + Opus gibi kombinasyonlar icin yt-dlp MKV/WebM secer.
      args.push('-f', 'bv*+ba/b');
      break;
    case 'best-audio':
      args.push('-f', 'ba/b');
      break;
    case 'mp3':
      args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', mp3Quality || '0');
      break;
    case 'audio':
      args.push('-f', 'ba/b', '-x', '--audio-format', option.codec);
      break;
    case 'm4a':
      args.push('-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a');
      break;
    case 'format':
      // Kap secilmez: yt-dlp kodeklere uyan kabi (mp4, webm ya da mkv) kendisi secer.
      args.push('-f', option.video && !option.audio ? `${option.formatId}+ba/${option.formatId}` : option.formatId);
      break;
  }

  const audioOnly = isAudioOnlyOption(option);
  if (subtitles && !audioOnly) {
    args.push('--embed-subs');
    // `--write-subs` ile altyazi dosyasi gomulduktan sonra da diskte kalir.
    if (subtitleFile) args.push('--write-subs', '--convert-subs', 'srt');
    if (autoSubtitles) args.push('--write-auto-subs');
    args.push('--sub-langs', subtitleLangs?.trim() || 'tr,en');
    // Bir altyazi dili alinamazsa (YouTube cevirilerde sik sik 429 verir) video yine iner;
    // `-i` ile bu yalnizca uyari olur, asil indirme hatalari cikis kodu 1 ile doner.
    args.push('--ignore-errors');
  }
  if (section) {
    args.push('--download-sections', `*${section.start}-${section.end ?? 'inf'}`);
  }
  if (sponsorBlock === 'mark') args.push('--sponsorblock-mark', 'all');
  if (sponsorBlock === 'remove') args.push('--sponsorblock-remove', SPONSOR_REMOVE);

  // MP4/MP3/M4A'da ffprobe olmadan calisir (webp kapak ffmpeg ile PNG'ye cevrilir).
  if (embedMetadata) {
    // Ham ses formatlari webm olabilir; yt-dlp webm'e kapak gomemez ve indirmeyi hatayla bitirir.
    // Videolarda sorun yok: yt-dlp kapak icin webm yerine mkv secer.
    // WAV kapak tasiyamaz.
    const noCover = option.kind === 'best-audio' || (option.kind === 'audio' && option.codec === 'wav')
      || (option.kind === 'format' && !option.video);
    if (!noCover) args.push('--embed-thumbnail');
    args.push('--embed-metadata');
  }
  if (rateLimit) args.push('--limit-rate', rateLimit);
  args.push(...RETRY_ARGS);
  if (concurrentFragments && concurrentFragments > 1) args.push('-N', String(concurrentFragments));
  if (sleepInterval) args.push('--sleep-interval', String(sleepInterval), '--sleep-requests', '1');
  if (maxFilesize) args.push('--max-filesize', maxFilesize);
  if (dateAfter) args.push('--dateafter', dateAfter);
  if (liveFromStart) args.push('--live-from-start');
  // Yayin baslayana kadar 30 sn ile 10 dk arasi araliklarla tekrar bakilir.
  if (waitForVideo) args.push('--wait-for-video', '30-600');
  args.push(...postProcessingArgs(option, outDir, subfolder, {
    splitChapters, removeChapters, remux, parseArtist, writeThumbnail, writeDescription, writeInfoJson, writeComments, serverMtime,
  }));
  if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath);
  args.push(...networkArgs(network), ...jsRuntimeArgs(denoPath), ...urlArgs(url));
  return args;
}

/** Sonuc yalnizca ses dosyasi mi (altyazi, kap degistirme uygulanmaz). */
const isAudioOnlyOption = (option: DownloadOption) => option.kind === 'mp3' || option.kind === 'm4a' || option.kind === 'audio'
  || option.kind === 'best-audio' || (option.kind === 'format' && !option.video);

/** Indirme sonrasi islemler: bolumler, kap, etiketler, ek dosyalar, dosya tarihi. */
export function postProcessingArgs(option: DownloadOption, outDir: string, subfolder: string | undefined, p: PostProcessing): string[] {
  const args: string[] = [];
  if (p.splitChapters) {
    // Bolumler videonun adiyla bir klasore: "Baslik/01 - Bolum adi.mp4". Ana dosya da kalir.
    const dir = subfolder ? joinPath(outDir, safeFolderName(subfolder)) : outDir;
    args.push('--split-chapters', '-o', `chapter:${joinPath(dir, '%(title)s/%(section_number)02d - %(section_title)s.%(ext)s')}`);
  }
  if (p.removeChapters?.trim()) args.push('--remove-chapters', p.removeChapters.trim());
  if (p.remux && !isAudioOnlyOption(option)) args.push('--remux-video', p.remux);
  // Indirmeden sonra: dosya adi ozgun basligi korur, yalnizca gomulen etiketler ayrilir.
  if (p.parseArtist) args.push('--parse-metadata', 'post_process:title:%(artist)s - %(title)s');
  if (p.writeThumbnail) args.push('--write-thumbnail', '--convert-thumbnails', 'jpg');
  if (p.writeDescription) args.push('--write-description');
  if (p.writeInfoJson || p.writeComments) args.push('--write-info-json');
  if (p.writeComments) args.push('--write-comments');
  if (p.serverMtime) args.push('--mtime');
  return args;
}

export type OutputLine =
  | { type: 'progress'; percent: number; speed: string; eta: string; downloaded?: string }
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
    ...(!total && p.downloaded_bytes && p.status !== 'finished' ? { downloaded: formatFilesize(p.downloaded_bytes) } : {}),
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
