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

export interface VideoInfo {
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formats: FormatOption[];
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadRequest {
  id: string;
  url: string;
  formatId: string;
  outDir: string;
  subtitles: boolean;
}

export type DownloadResult =
  | { status: 'complete'; filePath: string; fileSize?: number }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface DownloadEngine {
  getInfo(url: string): Promise<VideoInfo>;
  download(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult>;
  cancel(id: string): Promise<void>;
  updateEngine(): Promise<string | null>;
  engineVersion(): Promise<string | null>;
}
