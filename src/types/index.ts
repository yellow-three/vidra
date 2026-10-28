import type { SponsorBlockMode, TimeRange } from '../engine/types';

export interface VideoFormat {
  formatId: string;
  resolution: string;
  ext: string;
  note: string;
  filesize: string;
}

export interface Task {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  /** Oynatma listesinden geldiyse listenin adi. */
  playlist?: string;
  formats?: VideoFormat[];
  selectedFormatId?: string;
  percent: number;
  speed: string;
  eta: string;
  status: TaskStatus;
  message?: string;
  /** Hata mesajinin cevrilmeden onceki ham hali. */
  detail?: string;
  /** Yalnizca bu aralik indirilir. */
  section?: TimeRange;
  /** Uygulama kapanirken indiriliyordu ya da siradaydi; acilista kendiliginden surer. */
  resume?: boolean;
}

export type TaskStatus = 'analyzing' | 'ready-to-select' | 'queued' | 'downloading' | 'complete' | 'cancelled' | 'error';

export interface AppSettings {
  downloadDir?: string;
  defaultQuality?: string;
  defaultFormat?: string;
  /** 'system', 'vidra-dark' | 'vidra-light' ya da bir daisyUI tema adi. */
  theme?: string;
  autoOpenFolder?: boolean;
  downloadSubtitles?: boolean;
  /** `--sub-langs` degeri (varsayilan `tr,en`). */
  subtitleLangs?: string;
  /** Oynatma listesi videolari liste adiyla bir alt klasore iner (varsayilan acik). */
  playlistSubfolder?: boolean;
  /** ffprobe kurulu degilse uygulanmaz. */
  sponsorBlock?: SponsorBlockMode;
  /** Kapak resmi ve baslik/kanal bilgilerini dosyaya gomer (varsayilan acik). */
  embedMetadata?: boolean;
  /** Ayni anda calisan indirme sayisi (varsayilan 2). */
  maxConcurrentDownloads?: number;
  /** engine/ytdlp.ts FILENAME_TEMPLATES anahtari. */
  filenameTemplate?: string;
  /** yt-dlp `--limit-rate` degeri; bos ise sinirsiz. */
  rateLimit?: string;
  /** `--cookies-from-browser` icin tarayici adi (firefox, chrome...); bos ise kapali. */
  cookiesFromBrowser?: string;
  proxy?: string;
  /** Acilista haftada bir yt-dlp -U (varsayilan acik). */
  autoUpdateYtdlp?: boolean;
  /** Son basarili otomatik yt-dlp guncellemesi, Unix ms. */
  ytdlpCheckedAt?: number;
  legalAccepted?: boolean;
  /** Arayuz dili; bos ise sistem dili. */
  language?: 'tr' | 'en';
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formatId: string;
  quality: string;
  ext: string;
  fileSize: string;
  filePath: string;
  completedAt: string;
}

export type { AppApi, IpcResult } from './app-api';

