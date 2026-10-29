import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AppSettings, HistoryItem } from '../types';
import type { AppApi, IpcResult } from '../types/app-api';

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
  onClipboardLink: (callback) => subscribe<string>('clipboard-link-detected', callback),
  onClipboardMonitorStopped: (callback) => subscribe<void>('clipboard-monitor-stopped', callback),

  startClipboardMonitor: async () => { await invoke('start_clipboard_monitor'); },
  stopClipboardMonitor: async () => { await invoke('stop_clipboard_monitor'); },

  getDownloadFolder: () => invoke<string>('get_download_folder'),
  selectDownloadFolder: () => invokeResult<{ path?: string }>('select_download_folder'),
  getSettings: () => invoke<AppSettings>('get_settings'),
  saveSettings: (settings) => invokeResult('save_settings', { settings }),

  checkForUpdates: async () => ({ updateAvailable: false }),

  getLegacyHistory: () => invoke<HistoryItem[]>('get_legacy_history'),
  clearLegacyHistory: () => invokeResult('clear_legacy_history'),
  openFileLocation: (filePath) => invokeResult('open_file_location', { filePath }),
  openFile: (filePath) => invokeResult('open_file', { filePath }),
  filesExist: (paths) => invoke<boolean[]>('files_exist', { paths }),
  freeSpace: (path) => invoke<number | null>('free_space', { path }),

  checkDependencies: () => invoke('check_dependencies'),
  toolsStatus: () => invoke('tools_status'),
  installTool: async (tool, { withFfprobe, proxy }, onProgress) => {
    const channel = new Channel<number>();
    channel.onmessage = onProgress;
    await invoke('install_tool', { tool, withFfprobe: withFfprobe ?? false, proxy: proxy || null, onProgress: channel });
  },
  removeFfprobe: () => invoke('remove_ffprobe'),
  getPlatform: () => invoke<string>('get_platform'),
};
