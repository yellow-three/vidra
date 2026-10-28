// yt-dlp'nin Ingilizce hata satirlarini kullaniciya ne yapacagini soyleyen mesajlara cevirir (src/i18n).
// Taninmayan hatalar oldugu gibi gosterilir; ham metin her durumda `detail`de kalir.

import { msg, type Messages } from '../i18n';

export interface FriendlyError {
  message: string;
  detail?: string;
}

type ErrorKey = keyof Messages['errors'];

const RULES: [RegExp, ErrorKey][] = [
  [/confirm you.re not a bot|not a bot/i, 'bot'],
  [/confirm your age|age.restricted|inappropriate for some users/i, 'age'],
  [/members.only|join this channel/i, 'members'],
  [/private video/i, 'private'],
  [/could not (?:find|copy) .*cookie|failed to decrypt|cookies? database/i, 'cookies'],
  [/not available in your country|geo.?restrict/i, 'geo'],
  [/video (?:is )?unavailable|has been removed|account .* terminated/i, 'unavailable'],
  [/premieres in|live event will begin|is upcoming/i, 'upcoming'],
  [/unsupported url|is not a valid url/i, 'unsupported'],
  [/requested format is not available/i, 'format'],
  [/HTTP Error 403/i, 'forbidden'],
  [/HTTP Error 429|too many requests/i, 'rateLimited'],
  [/proxy/i, 'proxy'],
  [/getaddrinfo|name or service not known|network is unreachable|timed out|connection (?:refused|reset)|unable to download webpage/i, 'network'],
  [/no space left on device|disk full/i, 'diskFull'],
  [/permission denied|access is denied/i, 'permission'],
];

export function friendlyError(raw: string): FriendlyError {
  const text = raw.trim();
  const match = RULES.find(([pattern]) => pattern.test(text));
  if (!match) return { message: text || msg().engine.unknownError };
  return { message: msg().errors[match[1]], detail: text };
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
