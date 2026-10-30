// Platformdan bagimsiz indirme motoru sozlesmesi (DownloadEngine).

export type DownloadOption =
  | { kind: 'video'; height: number }
  | { kind: 'best-video' }
  /** En iyi video + en iyi ses, kodek ve kap degistirilmeden (MKV/WebM/MP4). */
  | { kind: 'best' }
  /** En iyi ses, donusturulmeden (Opus/WebM ya da M4A). */
  | { kind: 'best-audio' }
  | { kind: 'mp3' }
  | { kind: 'm4a' }
  /** Diger ses bicimlerine donusturme. */
  | { kind: 'audio'; codec: AudioCodec }
  /** yt-dlp'nin listeledigi bir format, oldugu gibi; yalnizca goruntu olanlara en iyi ses eklenir. */
  | { kind: 'format'; formatId: string; video: boolean; audio: boolean };

export type AudioCodec = 'opus' | 'flac' | 'wav';

/** UI'da secilebilen sade indirme secenegi. */
export interface FormatOption {
  formatId: string;
  resolution: string;
  ext: string;
  note: string;
  filesize: string;
  /** Bilinen ya da tahmini boyut (bayt); disk alani kontrolu icin. */
  bytes?: number;
}

/** Oynatma listesindeki bir video; formatlari indirirken secilir, onceden analiz edilmez. */
/** Dosya adi onizlemesi icin videonun bilinen alanlari (engine/filename.ts). */
export interface VideoMeta {
  id?: string;
  channel?: string;
  date?: string;
  site?: string;
  /** Videonun elle eklenmis altyazi dilleri (orn. `tr`, `en`). */
  subtitles?: string[];
  /** Otomatik altyazinin ozgun dili (YouTube); ceviriler sayilmaz. */
  autoSubtitles?: string[];
}

export interface PlaylistEntry {
  url: string;
  title: string;
  meta?: VideoMeta;
  duration?: number;
  thumbnail?: string;
}

export interface VideoInfo {
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formats: FormatOption[];
  meta?: VideoMeta;
  /** Link bir oynatma listesiyse girdileri. */
  entries?: PlaylistEntry[];
}

/** Hem analizde hem indirmede kullanilan ag secenekleri. */
export interface NetworkOptions {
  /** `--cookies-from-browser` degeri, orn. `firefox` ya da `chrome:/profil/yolu`. */
  cookiesFromBrowser?: string;
  proxy?: string;
}

export interface InfoOptions extends NetworkOptions {
  /** `watch?v=..&list=..` linkinde videonun yerine listenin tamamini getirir. */
  playlist?: boolean;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadRequest extends NetworkOptions {
  id: string;
  url: string;
  formatId: string;
  outDir: string;
  subtitles: boolean;
  /** Kapak resmi, baslik, kanal, tarih ve bolumleri dosyaya gomer. */
  embedMetadata: boolean;
  /** Dosya adi kalibi, orn. `{channel} - {title}` (engine/filename.ts). */
  filenamePattern?: string;
  /** yt-dlp `--limit-rate` degeri, orn. `5M`. */
  rateLimit?: string;
  /** `--sub-langs` degeri, orn. `tr,en`; bos ise `tr,en`. */
  subtitleLangs?: string;
  /** Dosyanin indirme klasoru icindeki alt klasoru (orn. oynatma listesinin adi). */
  subfolder?: string;
  /** Yalnizca bu araligi indirir (saniye); `end` yoksa videonun sonuna kadar. */
  section?: TimeRange;
  /** ffprobe kurulu degilse motor yok sayar (src-tauri/src/ffprobe.rs). */
  sponsorBlock?: SponsorBlockMode;
  /** Duraklatilip surdurulen indirmenin ilk basladigi an (Unix ms); iptalde o andan beri yazilanlar silinir. */
  partialSince?: number;
  /** Altyaziyi ayrica .srt dosyasi olarak da kaydeder. */
  subtitleFile?: boolean;
  /** Otomatik (konusmadan uretilen) altyazilari da kullanir. */
  autoSubtitles?: boolean;
  /** Ayni anda indirilen parca sayisi (`-N`); HLS/DASH videolarda hizlandirir. */
  concurrentFragments?: number;
  /** Indirmeden once bekleme, saniye (`--sleep-interval`); uzun listelerde engellenmeyi azaltir. */
  sleepInterval?: number;
  /** Bundan buyuk dosyalar indirilmez, orn. `1G` (`--max-filesize`). */
  maxFilesize?: string;
  /** MP3 kalitesi: `0` en iyi VBR ya da `320K` gibi sabit bit hizi. */
  mp3Quality?: string;
}

/** `mark`: sponsor bolumleri dosyaya bolum olarak eklenir; `remove`: dosyadan kesilir. */
export type SponsorBlockMode = 'off' | 'mark' | 'remove';

export interface TimeRange {
  start: number;
  end?: number;
}

export type DownloadResult =
  | { status: 'complete'; filePath: string; fileSize?: number }
  | { status: 'cancelled' }
  /** Yarim dosyalar diskte kalir; ayni istekle yeniden indirilince yt-dlp kaldigi yerden surer. */
  | { status: 'paused'; destination: string; startedMs: number }
  | { status: 'error'; message: string; detail?: string };

export interface DownloadEngine {
  getInfo(url: string, options?: InfoOptions): Promise<VideoInfo>;
  download(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult>;
  cancel(id: string): Promise<void>;
  /** Indirmeyi durdurur ama yarim dosyalari silmez; `download` sonucu `paused` olur. */
  pause(id: string): Promise<void>;
  /** Duraklatilmis indirmenin yarim dosyalarini siler (duraklatilmisken iptal). */
  discardPartial(destination: string, sinceMs: number): Promise<void>;
  updateEngine(): Promise<string | null>;
  engineVersion(): Promise<string | null>;
}
