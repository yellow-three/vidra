// Donustur sayfasi: FFmpeg'i surec calistirici uzerinden calistirir.

import { invoke } from '@tauri-apps/api/core';
import { buildConvertArgs, convertPercent, outputCandidates, parseDuration, parseProgressLine } from './ffmpeg';
import { killProcess, spawnProcess } from './process';
import { msg } from '../i18n';
import { appApi } from '../lib/appApi';

export type ConvertResult = { status: 'complete'; outputPath: string } | { status: 'cancelled' } | { status: 'error'; message: string };

export async function startConvert(inputPath: string, format: string, quality: string, onPercent: (percent: number) => void) {
  const { h264Encoder } = await invoke<{ h264Encoder?: string }>('check_dependencies');
  // Onceki donusturmelerin ciktilari ezilmez; ilk bos ad secilir.
  const candidates = outputCandidates(inputPath, format);
  const taken = await appApi.filesExist(candidates);
  const free = candidates.find((_, i) => !taken[i]);
  if (!free) throw new Error(msg().convert.noFreeName);
  const { args, outputPath } = buildConvertArgs(inputPath, format, quality, h264Encoder, free);
  const stderr: string[] = [];
  let duration: number | null = null;
  let lastPercent = -1;

  const proc = await spawnProcess('ffmpeg', args, {
    onStderr: (line) => {
      stderr.push(line);
      duration ??= parseDuration(line);
    },
    onStdout: (line) => {
      const progress = parseProgressLine(line);
      if (progress?.type !== 'time') return;
      const percent = convertPercent(progress.seconds, duration);
      if (percent !== lastPercent) onPercent((lastPercent = percent));
    },
  });

  const result: Promise<ConvertResult> = proc.exit.then((exit) => {
    if (exit.killed) return { status: 'cancelled' };
    if (exit.code === 0) return { status: 'complete', outputPath };
    return { status: 'error', message: stderr.filter((l) => l.trim()).slice(-1)[0] ?? msg().convert.failed };
  });
  return { result, cancel: () => killProcess(proc.id) };
}
