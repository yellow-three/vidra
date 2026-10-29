// Ayni videonun tekrar eklenmesini yakalamak icin link -> video kimligi.

const YOUTUBE_ID = /^[\w-]{11}$/;

/** YouTube linklerinde video kimligi; digerlerinde sondaki `/` atilmis link. */
export function videoKey(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    const id = host === 'youtu.be'
      ? u.pathname.slice(1).split('/')[0]
      : host === 'youtube.com'
        ? u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1]
        : undefined;
    if (id && YOUTUBE_ID.test(id)) return `yt:${id}`;
    return `${u.host}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
}

/** Kutuya yapistirilan metindeki linkler; bosluk, satir sonu ya da bitisik `https://` ile ayrilir. */
export function splitUrls(text: string): string[] {
  const parts = text.split(/\s+/).flatMap((p) => p.split(/(?=https?:\/\/)/)).filter(Boolean);
  return [...new Set(parts)];
}

/** Yalnizca http(s) linkleri yt-dlp'ye gider; `-` ile baslayan metin secenek olarak okunurdu. */
export function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

const YOUTUBE_HOST = /^(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)$/;

const isYoutubeUrl = (text: string) => isHttpUrl(text) && YOUTUBE_HOST.test(new URL(text).hostname);

/** Pano izleme: kapali, yalnizca YouTube linkleri ya da her http(s) linki (yt-dlp yuzlerce siteyi destekler). */
export type ClipboardMode = 'off' | 'youtube' | 'all';

/**
 * Panodan gelen metnin linklerini kutudakilere ekler; kutuda yazilani silmez,
 * kutuda zaten olan link tekrar eklenmez. Eklenecek link yoksa kutu aynen kalir.
 */
export function mergeClipboardLinks(box: string, clipboard: string, mode: ClipboardMode = 'youtube'): string {
  if (mode === 'off') return box;
  const accept = mode === 'all' ? isHttpUrl : isYoutubeUrl;
  const present = new Set(splitUrls(box).map(videoKey));
  const fresh = splitUrls(clipboard).filter((u) => accept(u) && !present.has(videoKey(u)));
  if (fresh.length === 0) return box;
  return [box.trim(), ...new Set(fresh)].filter(Boolean).join(' ');
}
