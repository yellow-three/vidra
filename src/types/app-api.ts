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
  getLegacyHistory(): Promise<import('.').HistoryItem[]>;
  clearLegacyHistory(): Promise<IpcResult>;
  openFileLocation(filePath: string): Promise<IpcResult>;
  openFile(filePath: string): Promise<IpcResult>;
  filesExist(paths: string[]): Promise<boolean[]>;
  checkDependencies(): Promise<{ ytdlp: boolean; ffmpeg: boolean; deno: boolean; ytdlpPath: string | null; ffmpegPath: string | null; denoPath: string | null }>;
  getPlatform(): Promise<string>;
}
