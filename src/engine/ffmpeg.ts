// FFmpeg ile yerel dosya donusturme argumanlari (Donustur sayfasi).

import { joinPath, splitPath, stem } from './paths';

export type ConvertQuality = 'high' | 'medium' | 'low' | string;

function crf(quality: ConvertQuality): string {
  return quality === 'high' ? '18' : quality === 'medium' ? '28' : '35';
}

/** `h264Encoder`: paketlenen/indirilen LGPL FFmpeg'de libopenh264, sistemdeki FFmpeg'de genelde libx264. */
function codecArgs(format: string, quality: ConvertQuality, h264Encoder: string): { ext: string; args: string[] } {
  switch (format) {
    case 'mp3': {
      const bitrate = quality === 'high' ? '320k' : quality === 'medium' ? '192k' : '96k';
      return { ext: 'mp3', args: ['-vn', '-acodec', 'libmp3lame', '-ab', bitrate] };
    }
    case 'webm':
      return { ext: 'webm', args: ['-c:v', 'libvpx', '-crf', crf(quality), '-b:v', '0', '-c:a', 'libvorbis'] };
    default: {
      // Indirilen FFmpeg LGPL'dir; GPL'li libx264 yerine OpenH264 (CRF yok, bit hizi var).
      const bitrate = quality === 'high' ? '8000k' : quality === 'medium' ? '4000k' : '1500k';
      return { ext: 'mp4', args: ['-c:v', h264Encoder, '-b:v', bitrate, '-c:a', 'aac'] };
    }
  }
}

const MAX_OUTPUT_CANDIDATES = 50;

/** Girdinin yanindaki cikti adlari, tercih sirasiyla: `Ad_converted.mp4`, `Ad_converted (2).mp4`, ... */
export function outputCandidates(inputPath: string, format: string): string[] {
  const { dir, name } = splitPath(inputPath);
  const { ext } = codecArgs(format, 'medium', 'libopenh264');
  return Array.from({ length: MAX_OUTPUT_CANDIDATES }, (_, i) =>
    joinPath(dir, `${stem(name)}_converted${i ? ` (${i + 1})` : ''}.${ext}`));
}

/**
 * `outputPath` verilmezse ilk aday kullanilir. `-n`: ayni adli dosya varsa FFmpeg uzerine yazmak yerine durur;
 * adi bos olan aday onceden secildigi icin bu yalnizca ayni anda iki donusturmede olur.
 */
export function buildConvertArgs(
  inputPath: string, format: string, quality: ConvertQuality, h264Encoder = 'libopenh264',
  outputPath = outputCandidates(inputPath, format)[0],
): { args: string[]; outputPath: string } {
  const { args } = codecArgs(format, quality, h264Encoder);
  // -progress makinece okunur ilerlemeyi stdout'a yazar; -nostats stderr'i sade tutar.
  return { args: ['-i', inputPath, '-n', '-progress', 'pipe:1', '-nostats', ...args, outputPath], outputPath };
}

/** FFmpeg stderr'indeki `Duration: HH:MM:SS.ss` satirindan toplam sure (ffprobe paketlenmiyor). */
export function parseDuration(line: string): number | null {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

export type ProgressLine = { type: 'time'; seconds: number } | { type: 'end' };

/** `-progress pipe:1` ciktisindaki `anahtar=deger` satirlari. */
export function parseProgressLine(line: string): ProgressLine | null {
  if (line.trim() === 'progress=end') return { type: 'end' };
  const m = /^out_time_us=(\d+)$/.exec(line.trim());
  return m ? { type: 'time', seconds: Number(m[1]) / 1_000_000 } : null;
}

/** %100'u yalnizca surec basariyla bitince gosteririz. */
export function convertPercent(seconds: number, duration: number | null): number {
  if (!duration || duration <= 0) return 0;
  return Math.max(0, Math.min(99, Math.floor((seconds / duration) * 100)));
}
