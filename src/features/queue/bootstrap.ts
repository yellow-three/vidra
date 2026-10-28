// Uygulama acilisi: sidecar kontrolu ve pano izleme. Durum cubugu bu store'u okur.

import { create } from 'zustand';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { appApi } from '../../lib/appApi';
import { hasActiveDownloads, useQueueStore } from './store';
import { checkForAppUpdateInBackground } from '../settings/appUpdate';
import { autoUpdateYtdlp } from '../settings/ytdlpAutoUpdate';

interface AppStatus {
  status: string;
  depsReady: boolean;
}

export const useAppStatus = create<AppStatus>()(() => ({
  status: 'Bileşenler kontrol ediliyor...',
  depsReady: false,
}));

// Sidecar'lar uygulamayla gelir; burada yalnizca eksik kurulum yakalanir.
async function checkDependencies(): Promise<void> {
  const deps = await appApi.checkDependencies();
  const missing = [!deps.ytdlp && 'yt-dlp', !deps.ffmpeg && 'FFmpeg', !deps.deno && 'deno'].filter(Boolean);
  if (missing.length) throw new Error(`${missing.join(', ')} bulunamadı; uygulamayı yeniden kurun.`);
}

/** Suren indirme varken pencere kapatilirsa sorar; indirmeler kapaninca durur (process.rs kill_all). */
function confirmCloseWithActiveDownloads(): void {
  void getCurrentWindow().onCloseRequested(async (event) => {
    if (!hasActiveDownloads()) return;
    const close = await ask('Süren indirmeler durdurulacak. Bir sonraki açılışta kaldıkları yerden devam ettirebilirsiniz.', {
      title: 'Vidra kapatılsın mı?',
      kind: 'warning',
      okLabel: 'Kapat',
      cancelLabel: 'Vazgeç',
    });
    if (!close) event.preventDefault();
  });
}

/** Uygulama omru boyunca bir kez cagrilir (StrictMode cift efektine karsi korumali). */
let started = false;
export function startApp(): void {
  if (started) return;
  started = true;

  checkDependencies()
    .then(() => {
      useAppStatus.setState({ status: 'Sistem hazır.', depsReady: true });
      void autoUpdateYtdlp();
    })
    .catch((error) => useAppStatus.setState({ status: `Eksik bileşen: ${error instanceof Error ? error.message : String(error)}` }));

  void appApi.onStatusUpdate((status) => useAppStatus.setState({ status }));
  void appApi.onClipboardLink((link) => useQueueStore.getState().setUrl(link));
  void appApi.startClipboardMonitor();
  checkForAppUpdateInBackground();
  confirmCloseWithActiveDownloads();
}
