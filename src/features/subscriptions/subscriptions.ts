// Abonelikler: takip edilen kanal ve listelerin yeni videolari. yt-dlp'nin --download-archive'i
// kullanilmaz (ayni videonun baska kalitesini indirmeyi engellerdi); gecmis ve gorulenler listesi yeter.

import { engine } from '../../engine';
import type { VideoInfo } from '../../engine/types';
import { appApi } from '../../lib/appApi';
import { log } from '../../lib/log';
import type { AppSettings, Subscription } from '../../types';
import { fetchHistory } from '../history/queries';
import { pickDefaultFormat } from '../queue/defaultFormat';
import { videoKey } from '../queue/duplicates';
import { useQueueStore } from '../queue/store';
import { fetchSettings, invalidateSettings } from '../settings/queries';

/** Acilista en son kontrolden bu kadar sure gectiyse abonelikler yeniden kontrol edilir. */
export const AUTO_CHECK_MS = 6 * 60 * 60 * 1000;

const network = (s: AppSettings) => ({ cookiesFromBrowser: s.cookiesFromBrowser || undefined, proxy: s.proxy?.trim() || undefined });

async function saveSubscriptions(update: (subs: Subscription[]) => Subscription[]): Promise<void> {
  const settings = await fetchSettings();
  await appApi.saveSettings({ subscriptions: update(settings.subscriptions ?? []) });
  await invalidateSettings();
}

/** Listedeki tum videolar goruldu sayilir; bir sonraki kontrolde yalnizca bunlardan sonrakiler yeni olur. */
const markSeen = (id: string, info: VideoInfo) => saveSubscriptions((subs) => subs.map((s) => (s.id === id
  ? { ...s, title: info.title, checkedAt: Date.now(), seen: [...new Set([...s.seen, ...(info.entries ?? []).map((e) => videoKey(e.url))])] }
  : s)));

export async function addSubscription(url: string, info: VideoInfo, seenAll: boolean): Promise<Subscription> {
  const sub: Subscription = {
    id: String(Date.now()),
    url,
    title: info.title,
    addedAt: Date.now(),
    checkedAt: Date.now(),
    seen: seenAll ? (info.entries ?? []).map((e) => videoKey(e.url)) : [],
  };
  await saveSubscriptions((subs) => [...subs.filter((s) => s.url !== url), sub]);
  return sub;
}

export const removeSubscription = (id: string) => saveSubscriptions((subs) => subs.filter((s) => s.id !== id));

/**
 * Aboneligin listesini yeniden okur. Gorulmemis ve indirilmemis videolar varsa secim penceresi
 * bunlar isaretli olarak acilir; pencere kapaninca hepsi goruldu sayilir. Yeni video sayisini dondurur.
 */
export async function checkSubscription(sub: Subscription): Promise<number> {
  const settings = await fetchSettings();
  const info = await engine.getInfo(sub.url, { ...network(settings), playlist: true });
  const downloaded = new Set((await fetchHistory().catch(() => [])).map((h) => videoKey(h.url)));
  const seen = new Set(sub.seen);
  const fresh = (info.entries ?? []).filter((e) => !seen.has(videoKey(e.url)) && !downloaded.has(videoKey(e.url)));
  if (fresh.length === 0) {
    await markSeen(sub.id, info);
    return 0;
  }
  useQueueStore.getState().offerPick({
    info,
    formatId: pickDefaultFormat(info.formats, settings),
    downloaded,
    fresh: new Set(fresh.map((e) => e.url)),
    onDone: () => void markSeen(sub.id, info),
  });
  return fresh.length;
}

/** Acilista: uzun suredir kontrol edilmeyen abonelikler sirayla kontrol edilir (ayar kapatilabilir). */
export async function checkDueSubscriptions(): Promise<void> {
  const settings = await fetchSettings().catch(() => null);
  if (!settings || settings.checkSubscriptionsOnStart === false) return;
  for (const sub of settings.subscriptions ?? []) {
    if (Date.now() - (sub.checkedAt ?? 0) < AUTO_CHECK_MS) continue;
    await checkSubscription(sub).catch((error) => log.warn(`Abonelik kontrol edilemedi ${sub.url}: ${error}`));
  }
}
