// yt-dlp'nin Ingilizce hata satirlarini kullaniciya ne yapacagini soyleyen Turkce mesajlara cevirir.
// Taninmayan hatalar oldugu gibi gosterilir; ham metin her durumda `detail`de kalir.

export interface FriendlyError {
  message: string;
  detail?: string;
}

const COOKIES_HINT = 'Ayarlar > Ağ ve hesap bölümünden YouTube\'a giriş yaptığınız tarayıcıyı seçin.';

const RULES: [RegExp, string][] = [
  [/confirm you.re not a bot|not a bot/i, `YouTube bot doğrulaması istedi. ${COOKIES_HINT}`],
  [/confirm your age|age.restricted|inappropriate for some users/i, `Video yaş kısıtlamalı. ${COOKIES_HINT}`],
  [/members.only|join this channel/i, `Video yalnızca kanal üyelerine açık. ${COOKIES_HINT}`],
  [/private video/i, 'Video gizli; yalnızca sahibinin izin verdiği hesaplar izleyebilir.'],
  [/could not (?:find|copy) .*cookie|failed to decrypt|cookies? database/i,
    'Tarayıcı çerezleri okunamadı. Tarayıcıyı kapatıp tekrar deneyin ya da Ayarlar\'dan başka bir tarayıcı seçin (Windows\'ta Firefox önerilir).'],
  [/not available in your country|geo.?restrict/i, 'Video bölgenizde yayınlanmıyor. Proxy ayarı ile deneyebilirsiniz.'],
  [/video (?:is )?unavailable|has been removed|account .* terminated/i, 'Video kullanılamıyor; silinmiş veya kaldırılmış olabilir.'],
  [/premieres in|live event will begin|is upcoming/i, 'Video henüz yayınlanmadı.'],
  [/unsupported url|is not a valid url/i, 'Bu link desteklenmiyor. YouTube video veya oynatma listesi linki yapıştırın.'],
  [/requested format is not available/i, 'Seçilen format bu video için yok. Başka bir kalite seçin.'],
  [/HTTP Error 403/i, 'YouTube indirmeyi reddetti (403). Ayarlar\'dan yt-dlp\'yi güncelleyip tekrar deneyin.'],
  [/HTTP Error 429|too many requests/i, 'YouTube çok fazla istek aldığı için geçici olarak engelledi. Bir süre bekleyin veya çerez kullanın.'],
  [/proxy/i, 'Proxy\'ye bağlanılamadı. Ayarlar\'daki proxy adresini kontrol edin.'],
  [/getaddrinfo|name or service not known|network is unreachable|timed out|connection (?:refused|reset)|unable to download webpage/i,
    'İnternete bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.'],
  [/no space left on device|disk full/i, 'Diskte yer kalmadı.'],
  [/permission denied|access is denied/i, 'İndirme klasörüne yazılamıyor. Ayarlar\'dan başka bir klasör seçin.'],
];

export function friendlyError(raw: string): FriendlyError {
  const text = raw.trim();
  const match = RULES.find(([pattern]) => pattern.test(text));
  if (!match) return { message: text || 'Bilinmeyen hata' };
  return { message: match[1], detail: text };
}

/** Analiz gibi istisna firlatan cagrilarda ham metni de tasir. */
export class EngineError extends Error {
  readonly detail?: string;

  constructor(friendly: FriendlyError) {
    super(friendly.message);
    this.name = 'EngineError';
    this.detail = friendly.detail;
  }
}
