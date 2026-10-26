import type { FormatOption } from '../../engine';
import type { AppSettings } from '../../types';

/** Ayarlardaki varsayilan format/kaliteye en yakin secenek. */
export function pickDefaultFormat(formats: FormatOption[], settings: AppSettings | null | undefined): string | undefined {
  if (settings?.defaultFormat === 'mp3') {
    return formats.find((f) => f.formatId === 'audio-mp3')?.formatId;
  }
  const maxHeight = Number(settings?.defaultQuality) || Infinity;
  const videos = formats.filter((f) => f.formatId.startsWith('video-'));
  return (videos.find((f) => (parseInt(f.resolution) || 0) <= maxHeight) ?? videos[videos.length - 1] ?? formats[0])?.formatId;
}
