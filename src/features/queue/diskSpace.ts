// Indirmeden once bos alan kontrolu: yt-dlp disk dolunca yarim dosya birakip "No space left" ile durur.

import { formatFilesize } from '../../engine/ytdlp';
import { msg } from '../../i18n';

/** Birlestirme ve donusturme gecici dosyalari icin pay; boyutu bilinmeyen indirmede de istenir. */
export const DISK_MARGIN_BYTES = 200 * 1024 ** 2;

/** Yer yetmiyorsa kullaniciya gosterilecek mesaj; bos alan olculemediyse kontrol atlanir. */
export function diskShortage(freeBytes: number | null, requiredBytes: number | undefined): string | null {
  if (freeBytes == null) return null;
  const needed = (requiredBytes ?? 0) + DISK_MARGIN_BYTES;
  if (freeBytes >= needed) return null;
  return msg().queue.diskFull(formatFilesize(needed), formatFilesize(freeBytes));
}
