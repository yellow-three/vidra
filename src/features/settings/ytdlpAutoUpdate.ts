// yt-dlp YouTube degistikce bozulur; uygulama acilisinda haftada bir kendiliginden guncellenir.

import { queryClient } from '../../app/queryClient';
import { engine } from '../../engine';
import { appApi } from '../../lib/appApi';
import type { AppSettings } from '../../types';
import { setStatus } from '../queue/appStatus';
import { fetchSettings, invalidateSettings } from './queries';

export const ytdlpVersionKey = ['ytdlp-version'] as const;

const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAutoUpdate(settings: AppSettings, now: number): boolean {
  if (settings.autoUpdateYtdlp === false) return false;
  return now - (settings.ytdlpCheckedAt ?? 0) >= INTERVAL_MS;
}

/** `yt-dlp -U`; durum cubugu ve Ayarlar'daki surum birlikte guncellenir. */
export async function updateYtdlp(): Promise<string | null> {
  setStatus((m) => m.status.ytdlpUpdating);
  try {
    const version = await engine.updateEngine();
    queryClient.setQueryData(ytdlpVersionKey, version);
    if (version) setStatus((m) => m.status.ytdlpUpdated(version));
    return version;
  } catch (error) {
    setStatus((m) => m.status.ready);
    throw error;
  }
}

/** Basarisiz olursa (orn. cevrimdisi) zaman kaydedilmez; sonraki acilista yeniden denenir. */
export async function autoUpdateYtdlp(): Promise<void> {
  try {
    if (!shouldAutoUpdate(await fetchSettings(), Date.now())) return;
    await updateYtdlp();
    await appApi.saveSettings({ ytdlpCheckedAt: Date.now() });
    await invalidateSettings();
  } catch (error) {
    console.warn('yt-dlp otomatik güncellenemedi:', error);
  }
}
