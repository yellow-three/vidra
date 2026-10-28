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
