export type IpcResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string };

export interface QueueProgressData {
  id: string;
  status: 'analyzing' | 'ready-to-select' | 'downloading' | 'complete' | 'cancelled' | 'error';
  title?: string;
  duration?: number;
  thumbnail?: string;
  formats?: Array<{
    formatId: string;
    resolution: string;
    ext: string;
    note: string;
    filesize: string;
  }>;
  percent?: number;
  speed?: string;
  eta?: string;
  message?: string;
}

export interface ConvertProgressData {
  id: string;
  percent: number;
  status?: string;
  outputPath?: string;
}

export interface AppApi {
  addToQueue(task: { id: string; url: string }): Promise<IpcResult>;
  startDownloadTask(task: { id: string; url: string; formatId: string }): Promise<IpcResult>;
  cancelTask(id: string): Promise<IpcResult>;
  onStatusUpdate(callback: (msg: string) => void): Promise<() => void>;
  onQueueProgress(callback: (data: QueueProgressData) => void): Promise<() => void>;
  startClipboardMonitor(): Promise<void>;
  stopClipboardMonitor(): Promise<void>;
  onClipboardMonitorStopped(callback: () => void): Promise<() => void>;
  onClipboardLink(callback: (link: string) => void): Promise<() => void>;
  getDownloadFolder(): Promise<string>;
  selectDownloadFolder(): Promise<IpcResult<{ path?: string }>>;
  getSettings(): Promise<import('.').AppSettings>;
  saveSettings(settings: Partial<import('.').AppSettings>): Promise<IpcResult>;
  getYtdlpVersion(): Promise<{ version: string | null }>;
  updateYtdlp(): Promise<IpcResult<{ version?: string }>>;
  checkForUpdates(): Promise<{ updateAvailable: boolean; version?: string }>;
  getHistory(): Promise<import('.').HistoryItem[]>;
  clearHistory(): Promise<IpcResult>;
  openFileLocation(filePath: string): Promise<IpcResult>;
  deleteHistoryItem(id: string): Promise<IpcResult>;
  startConvert(params: { id: string; inputPath: string; outputFormat: string; quality: string }): Promise<IpcResult>;
  cancelConvert(id: string): Promise<void>;
  onConvertProgress(callback: (data: ConvertProgressData) => void): Promise<() => void>;
  checkDependencies(): Promise<{ ytdlp: boolean; ffmpeg: boolean; ytdlpPath: string; ffmpegPath: string | null }>;
  installYtdlp(): Promise<IpcResult>;
  installFfmpeg(): Promise<IpcResult>;
  getPlatform(): Promise<string>;
}
