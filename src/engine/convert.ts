// Donustur sayfasi: FFmpeg'i surec calistirici uzerinden calistirir.

import { buildConvertArgs } from './ffmpeg';
import { killProcess, spawnProcess } from './process';

export type ConvertResult = { status: 'complete'; outputPath: string } | { status: 'cancelled' } | { status: 'error'; message: string };

export async function startConvert(inputPath: string, format: string, quality: string) {
  const { args, outputPath } = buildConvertArgs(inputPath, format, quality);
  const stderr: string[] = [];
  const proc = await spawnProcess('ffmpeg', args, { onStderr: (l) => stderr.push(l) });

  const result: Promise<ConvertResult> = proc.exit.then((exit) => {
    if (exit.killed) return { status: 'cancelled' };
    if (exit.code === 0) return { status: 'complete', outputPath };
    return { status: 'error', message: stderr.slice(-1)[0] ?? 'Dönüştürme hatası' };
  });
  return { result, cancel: () => killProcess(proc.id) };
}
