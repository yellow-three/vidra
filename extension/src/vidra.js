// Linki Vidra masaustu uygulamasina gonderir: `vidra://download?url=...&mode=video|mp3`.
// Eklenti indirme yapmaz; uygulama videoyu analiz eder, indirmeyi kullanici baslatir.
// Gonderme tek fonksiyonda: ileride native messaging'e gecilirse yalnizca burasi degisir.

/** Chrome'da `chrome`, Firefox'ta `browser`; ikisi de ayni Promise tabanli API'yi sunar. */
export const api = globalThis.browser ?? globalThis.chrome;

const MAX_URL = 2048;

/** Yalnizca http(s) linkleri gonderilir (uygulama da ayrica dogrular). */
export function isSendable(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && url.length <= MAX_URL;
  } catch {
    return false;
  }
}

export function vidraLink(url, mode) {
  return `vidra://download?url=${encodeURIComponent(url)}&mode=${mode === 'mp3' ? 'mp3' : 'video'}`;
}

/**
 * Tarayici `vidra://` linkini isletim sistemine verir ("Vidra acilsin mi?" sorusu); sekme yerinde kalir.
 * Gonderilemezse false.
 */
export async function sendToVidra(url, mode, tabId) {
  if (!isSendable(url)) return false;
  await api.tabs.update(tabId, { url: vidraLink(url, mode) });
  return true;
}

export const RELEASES_URL = 'https://github.com/yellow-three/vidra/releases/latest';
