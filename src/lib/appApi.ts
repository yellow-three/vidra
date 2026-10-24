import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AppSettings, HistoryItem } from '../types';
import type { AppApi, ConvertProgressData, IpcResult, QueueProgressData } from '../types/app-api';

async function invokeResult<T extends object = {}>(command: string, args?: Record<string, unknown>): Promise<IpcResult<T>> {
  try {
    return await invoke<IpcResult<T>>(command, args);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function subscribe<T>(event: string, callback: (payload: T) => void): Promise<() => void> {
  return listen<T>(event, ({ payload }) => callback(payload));
}

export const appApi: AppApi = {
  addToQueue: async ({ id, url }) => invokeResult('add_to_queue', { id, url }),
  startDownloadTask: async ({ id, url, formatId }) => invokeResult('start_download_task', { id, url, formatId }),
  cancelTask: async (id) => invokeResult('cancel_task', { id }),

  onStatusUpdate: (callback) => subscribe<string>('dependency-status', callback),
  onQueueProgress: (callback) => subscribe<QueueProgressData>('queue-progress', callback),
  onClipboardLink: (callback) => subscribe<string>('clipboard-link-detected', callback),
  onClipboardMonitorStopped: (callback) => subscribe<void>('clipboard-monitor-stopped', callback),

  startClipboardMonitor: async () => { await invoke('start_clipboard_monitor'); },
  stopClipboardMonitor: async () => { await invoke('stop_clipboard_monitor'); },

  getDownloadFolder: () => invoke<string>('get_download_folder'),
  selectDownloadFolder: () => invokeResult<{ path?: string }>('select_download_folder'),
  getSettings: () => invoke<AppSettings>('get_settings'),
  saveSettings: (settings) => invokeResult('save_settings', { settings }),

  getYtdlpVersion: () => invoke<{ version: string | null }>('get_ytdlp_version'),
  updateYtdlp: async () => invokeResult('install_ytdlp'),
  checkForUpdates: async () => ({ updateAvailable: false }),

  getHistory: () => invoke<HistoryItem[]>('get_history'),
  clearHistory: () => invokeResult('clear_history'),
  openFileLocation: (filePath) => invokeResult('open_file_location', { filePath }),
  deleteHistoryItem: (id) => invokeResult('delete_history_item', { id }),

  startConvert: async (params) => invokeResult('start_convert', params),
  cancelConvert: async (id) => { await invoke('cancel_convert', { id }); },
  onConvertProgress: (callback) => subscribe<ConvertProgressData>('convert-progress', callback),

  checkDependencies: () => invoke('check_dependencies'),
  installYtdlp: () => invokeResult('install_ytdlp'),
  installFfmpeg: () => invokeResult('install_ffmpeg'),
  getPlatform: () => invoke<string>('get_platform'),
};
