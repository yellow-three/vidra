// Tarayici eklentisinden gelen `vidra://download?url=...&mode=video|mp3` linkleri.
// Link indirmeyi baslatmaz: video analiz edilir, kullanici formati secip kendisi indirir; boylece
// bir web sitesi `vidra://` linkiyle istenmeyen indirme baslatamaz.

import { isHttpUrl } from '../queue/duplicates';

export type LinkMode = 'video' | 'mp3';

export interface VidraLink {
  url: string;
  mode: LinkMode;
}

const MAX_URL = 2048;

/** Gecersiz, cok uzun ya da http(s) olmayan linkler yok sayilir (null). */
export function parseVidraLink(raw: string): VidraLink | null {
  let link: URL;
  try {
    link = new URL(raw);
  } catch {
    return null;
  }
  // `vidra://download?...` tarayiciya gore host ya da yol olarak gelir.
  const action = (link.host || link.pathname.replace(/^\/+/, '')).replace(/\/+$/, '');
  if (link.protocol !== 'vidra:' || action !== 'download') return null;
  const url = link.searchParams.get('url')?.trim() ?? '';
  if (!url || url.length > MAX_URL || !isHttpUrl(url)) return null;
  const mode = link.searchParams.get('mode') === 'mp3' ? 'mp3' : 'video';
  return { url, mode };
}

/** Gelen linkleri isler; React disinda calisir, sayfa gecisi icin `goToQueue` verilir. */
export function createLinkHandler(goToQueue: () => void) {
  return async (raws: string[]) => {
    const [{ useQueueStore }, { showWindow }, { log }] = await Promise.all([
      import('../queue/store'), import('../../app/tray'), import('../../lib/log'),
    ]);
    for (const raw of raws) {
      const link = parseVidraLink(raw);
      if (!link) {
        log.warn(`Gecersiz vidra linki yok sayildi: ${raw.slice(0, 200)}`);
        continue;
      }
      goToQueue();
      void showWindow().catch(() => {});
      const store = useQueueStore.getState();
      store.setUrl(link.url);
      const id = await store.analyze();
      // MP3 istendiyse analizden sonra ses secilir; indirmeyi yine kullanici baslatir.
      const task = id ? useQueueStore.getState().tasks.find((t) => t.id === id) : undefined;
      if (task && link.mode === 'mp3' && task.formats?.some((f) => f.formatId === 'audio-mp3')) {
        store.selectFormat(task.id, 'audio-mp3');
      }
    }
  };
}
