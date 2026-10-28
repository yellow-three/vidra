// Platformdan bagimsiz indirme motoru sozlesmesi (PLAN.md: DownloadEngine).

export type DownloadOption =
  | { kind: 'video'; height: number }
  | { kind: 'best-video' }
  | { kind: 'mp3' }
  | { kind: 'm4a' };

/** UI'da secilebilen sade indirme secenegi. */
export interface FormatOption {
  formatId: string;
  resolution: string;
  ext: string;
  note: string;
  filesize: string;
}

/** Oynatma listesindeki bir video; formatlari indirirken secilir, onceden analiz edilmez. */
export interface PlaylistEntry {
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export interface VideoInfo {
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formats: FormatOption[];
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
  /** FILENAME_TEMPLATES anahtari. */
  filenameTemplate?: string;
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
  | { status: 'error'; message: string; detail?: string };

export interface DownloadEngine {
  getInfo(url: string, options?: InfoOptions): Promise<VideoInfo>;
  download(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult>;
  cancel(id: string): Promise<void>;
  updateEngine(): Promise<string | null>;
  engineVersion(): Promise<string | null>;
}
