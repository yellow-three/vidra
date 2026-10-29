export type IpcResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string };

export type ToolId = 'yt-dlp' | 'deno' | 'ffmpeg' | 'ffprobe';

/** Ilk acilista indirilen bilesenin durumu (src-tauri/src/tools.rs). */
export interface ToolStatus {
  id: ToolId;
  installed: boolean;
  /** Uygulamayla paketlenmis kopya kullaniliyor. */
  bundled: boolean;
  /** Sistemde kurulu uygun bir surum kullaniliyor. */
  system: boolean;
  /** Calisir ama uygulamanin istedigi surum degil; yeniden indirilmeli. */
  outdated: boolean;
  downloadable: boolean;
  downloadMb: number;
}

export interface InstallToolOptions {
  /** Yalnizca ffmpeg: ayni arsivden ffprobe'u da cikarir. */
  withFfprobe?: boolean;
  proxy?: string;
}

export interface AppApi {
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
  /** Klasorun diskindeki bos alan (bayt); olculemezse null. */
  freeSpace(path: string): Promise<number | null>;
  openLogFolder(): Promise<IpcResult>;
  checkDependencies(): Promise<{ ytdlp: boolean; ffmpeg: boolean; deno: boolean; ffprobe: boolean; ytdlpPath: string | null; ffmpegPath: string | null; denoPath: string | null }>;
  toolsStatus(): Promise<ToolStatus[]>;
  /** Bileseni indirip kurar; ilerleme 0-100. */
  installTool(tool: ToolId, options: InstallToolOptions, onProgress: (percent: number) => void): Promise<void>;
  removeFfprobe(): Promise<void>;
  getPlatform(): Promise<string>;
}
