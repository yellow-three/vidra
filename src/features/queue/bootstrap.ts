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

// Sidecar'lar uygulamayla gelir; burada yalnizca eksik kurulum yakalanir. Eksiklerin adlarini dondurur.
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

/** Uygulama omru boyunca bir kez cagrilir (StrictMode cift efektine karsi korumali). */
let started = false;
export function startApp(): void {
  if (started) return;
  started = true;

  missingDependencies()
    .then((missing) => {
      if (missing.length) {
        setStatus((m) => m.status.missing(missing.join(', ')));
        return;
      }
      useAppStatus.setState({ status: (m) => m.status.ready, depsReady: true });
      void autoUpdateYtdlp();
    })
    .catch((error) => setStatus(() => (error instanceof Error ? error.message : String(error))));
  void appApi.onClipboardLink((link) => useQueueStore.getState().setUrl(link));
  void appApi.startClipboardMonitor();
  checkForAppUpdateInBackground();
  confirmCloseWithActiveDownloads();
}
