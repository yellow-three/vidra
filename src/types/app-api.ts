export type IpcResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string };

export interface AppApi {
  onStatusUpdate(callback: (msg: string) => void): Promise<() => void>;
  startClipboardMonitor(): Promise<void>;
  stopClipboardMonitor(): Promise<void>;
  onClipboardMonitorStopped(callback: () => void): Promise<() => void>;
  onClipboardLink(callback: (link: string) => void): Promise<() => void>;
  getDownloadFolder(): Promise<string>;
  selectDownloadFolder(): Promise<IpcResult<{ path?: string }>>;
  getSettings(): Promise<import('.').AppSettings>;
  saveSettings(settings: Partial<import('.').AppSettings>): Promise<IpcResult>;
  checkForUpdates(): Promise<{ updateAvailable: boolean; version?: string }>;
  getHistory(): Promise<import('.').HistoryItem[]>;
  addHistoryItem(item: import('.').HistoryItem): Promise<IpcResult>;
  clearHistory(): Promise<IpcResult>;
  openFileLocation(filePath: string): Promise<IpcResult>;
  deleteHistoryItem(id: string): Promise<IpcResult>;
  checkDependencies(): Promise<{ ytdlp: boolean; ffmpeg: boolean; ytdlpPath: string; ffmpegPath: string | null; jsRuntime: string | null }>;
  installYtdlp(): Promise<IpcResult>;
  installFfmpeg(): Promise<IpcResult>;
  getPlatform(): Promise<string>;
}
