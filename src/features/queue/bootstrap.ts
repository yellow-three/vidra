// Uygulama acilisi: sidecar kontrolu ve pano izleme. Durum cubugu bu store'u okur.

import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { msg } from '../../i18n';
import { appApi } from '../../lib/appApi';
import { setStatus, useAppStatus } from './appStatus';
import { hasActiveDownloads, useQueueStore } from './store';
import { checkForAppUpdateInBackground } from '../settings/appUpdate';
import { autoUpdateYtdlp } from '../settings/ytdlpAutoUpdate';

export { useAppStatus };

// Araclar ilk acilista kurulum ekranindan indirilir (features/setup). Eksiklerin adlarini dondurur.
async function missingDependencies(): Promise<string[]> {
  const deps = await appApi.checkDependencies();
  return [!deps.ytdlp && 'yt-dlp', !deps.ffmpeg && 'FFmpeg', !deps.deno && 'deno'].filter((n): n is string => Boolean(n));
}

/** Suren indirme varken pencere kapatilirsa sorar; indirmeler kapaninca durur (process.rs kill_all). */
function confirmCloseWithActiveDownloads(): void {
  void getCurrentWindow().onCloseRequested(async (event) => {
    if (!hasActiveDownloads()) return;
    const m = msg().closeDialog;
    const close = await ask(m.body, { title: m.title, kind: 'warning', okLabel: m.ok, cancelLabel: m.cancel });
    if (!close) event.preventDefault();
  });
}

/** Acilista ve kurulum ekrani bilesenleri indirdikten sonra durum cubugunu gunceller. */
let ytdlpUpdateStarted = false;
export async function refreshDependencyStatus(): Promise<void> {
  try {
    const missing = await missingDependencies();
    if (missing.length) {
      useAppStatus.setState({ status: (m) => m.status.missing(missing.join(', ')), depsReady: false });
      return;
    }
    useAppStatus.setState({ status: (m) => m.status.ready, depsReady: true });
    if (!ytdlpUpdateStarted) {
      ytdlpUpdateStarted = true;
      void autoUpdateYtdlp();
    }
  } catch (error) {
    setStatus(() => (error instanceof Error ? error.message : String(error)));
  }
}

/** Uygulama omru boyunca bir kez cagrilir (StrictMode cift efektine karsi korumali). */
let started = false;
export function startApp(): void {
  if (started) return;
  started = true;

  void refreshDependencyStatus();
  void appApi.onClipboardLink((link) => useQueueStore.getState().setUrl(link));
  void appApi.startClipboardMonitor();
  checkForAppUpdateInBackground();
  confirmCloseWithActiveDownloads();
}
