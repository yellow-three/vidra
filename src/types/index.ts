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
  formats?: VideoFormat[];
  selectedFormatId?: string;
  percent: number;
  speed: string;
  eta: string;
  status: 'analyzing' | 'ready-to-select' | 'downloading' | 'complete' | 'cancelled' | 'error';
  message?: string;
}

export interface AppSettings {
  downloadDir?: string;
  defaultQuality?: string;
  defaultFormat?: string;
  /** 'system', 'vidra-dark' | 'vidra-light' ya da bir daisyUI tema adi. */
  theme?: string;
  autoOpenFolder?: boolean;
  downloadSubtitles?: boolean;
  legalAccepted?: boolean;
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

