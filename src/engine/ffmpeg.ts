// FFmpeg ile yerel dosya donusturme argumanlari (Donustur sayfasi).

import { joinPath, splitPath, stem } from './paths';

export type ConvertQuality = 'high' | 'medium' | 'low' | string;

function crf(quality: ConvertQuality): string {
  return quality === 'high' ? '18' : quality === 'medium' ? '28' : '35';
}

function codecArgs(format: string, quality: ConvertQuality): { ext: string; args: string[] } {
  switch (format) {
    case 'mp3': {
      const bitrate = quality === 'high' ? '320k' : quality === 'medium' ? '192k' : '96k';
      return { ext: 'mp3', args: ['-vn', '-acodec', 'libmp3lame', '-ab', bitrate] };
    }
    case 'webm':
      return { ext: 'webm', args: ['-c:v', 'libvpx', '-crf', crf(quality), '-b:v', '0', '-c:a', 'libvorbis'] };
    default:
      return { ext: 'mp4', args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', crf(quality), '-c:a', 'aac'] };
  }
}

export function buildConvertArgs(inputPath: string, format: string, quality: ConvertQuality): { args: string[]; outputPath: string } {
  const { dir, name } = splitPath(inputPath);
  const { ext, args } = codecArgs(format, quality);
  const outputPath = joinPath(dir, `${stem(name)}_converted.${ext}`);
  return { args: ['-i', inputPath, '-y', ...args, outputPath], outputPath };
}
