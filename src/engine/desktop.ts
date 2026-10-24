// Masaustu motoru: yt-dlp'yi Rust surec calistiricisi uzerinden calistirir.

import { invoke } from '@tauri-apps/api/core';
import { readDir, remove, stat } from '@tauri-apps/plugin-fs';
import { joinPath, splitPath, stem } from './paths';
import { killProcess, runProcess, spawnProcess } from './process';
import type { DownloadEngine, DownloadOption, DownloadProgress, DownloadRequest, DownloadResult, VideoInfo } from './types';
import {
  buildDownloadArgs,
  buildInfoArgs,
  buildOptions,
  lastErrorLines,
  parseOption,
  parseOutputLine,
  partialFilesToRemove,
  type YtdlpFormat,
} from './ytdlp';

interface Dependencies {
  ytdlp: boolean;
  ffmpeg: boolean;
  ffmpegPath: string | null;
  denoPath: string | null;
}

const getDependencies = () => invoke<Dependencies>('check_dependencies');

/** Iptal edilen indirmenin yazdigi dosyalari siler; hata olursa indirme sonucunu bozmaz. */
async function removePartialFiles(destination: string, startedMs: number): Promise<void> {
  const { dir, name } = splitPath(destination);
  const prefix = stem(name) + '.';
  try {
    const candidates = (await readDir(dir)).filter((e) => e.isFile && e.name.startsWith(prefix));
    const entries = await Promise.all(candidates.map(async (e) => ({
      name: e.name,
      mtimeMs: (await stat(joinPath(dir, e.name))).mtime?.getTime() ?? 0,
    })));
    await Promise.all(partialFilesToRemove(destination, entries, startedMs).map((n) => remove(joinPath(dir, n))));
  } catch (error) {
    console.warn('Yarim dosyalar silinemedi:', error);
  }
}

export class DesktopEngine implements DownloadEngine {
  /** Indirme kimligi -> surec kimligi, ya da surec baslamadan onceki durum. */
  private processes = new Map<string, number | 'starting' | 'cancel-requested'>();

  async getInfo(url: string): Promise<VideoInfo> {
    const deps = await getDependencies();
    if (!deps.ytdlp) throw new Error('yt-dlp bulunamadı; uygulama eksik kurulmuş olabilir.');

    const result = await runProcess('yt-dlp', buildInfoArgs(url, deps.denoPath));
    if (result.code !== 0) throw new Error(lastErrorLines(result.stderr) || 'Analiz hatası');

    const data = JSON.parse(result.stdout) as {
      title?: string;
      duration?: number;
      thumbnail?: string;
      formats?: YtdlpFormat[];
    };
    return {
      title: data.title ?? 'Bilinmeyen video',
      url,
      duration: data.duration,
      thumbnail: data.thumbnail,
      formats: buildOptions(data.formats ?? []),
    };
  }

  async download(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult> {
    const option = parseOption(request.formatId);
    if (!option) return { status: 'error', message: `Bilinmeyen format: ${request.formatId}` };
    this.processes.set(request.id, 'starting');
    try {
      return await this.runDownload(request, option, onProgress);
    } finally {
      this.processes.delete(request.id);
    }
  }

  private async runDownload(
    request: DownloadRequest,
    option: DownloadOption,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<DownloadResult> {
    const deps = await getDependencies();
    if (!deps.ytdlp) return { status: 'error', message: 'yt-dlp bulunamadı.' };
    if (!deps.ffmpeg) return { status: 'error', message: 'FFmpeg bulunamadı; video birleştirme ve MP3 için gerekli.' };

    const args = buildDownloadArgs({
      url: request.url,
      option,
      outDir: request.outDir,
      ffmpegPath: deps.ffmpegPath,
      subtitles: request.subtitles,
      denoPath: deps.denoPath,
    });

    let destination = '';
    let filePath = '';
    let lastPercent = -1;
    const stderr: string[] = [];
    const startedMs = Date.now();

    const proc = await spawnProcess('yt-dlp', args, {
      onStderr: (line) => stderr.push(line),
      onStdout: (line) => {
        const parsed = parseOutputLine(line);
        if (!parsed) return;
        if (parsed.type === 'destination') destination = parsed.path;
        else if (parsed.type === 'file') filePath = parsed.path;
        else if (Math.floor(parsed.percent) !== lastPercent) {
          lastPercent = Math.floor(parsed.percent);
          onProgress({ percent: lastPercent, speed: parsed.speed, eta: parsed.eta });
        }
      },
    });

    // Surec baslatilirken iptal geldiyse hemen sonlandir.
    if (this.processes.get(request.id) === 'cancel-requested') await killProcess(proc.id);
    this.processes.set(request.id, proc.id);

    const exit = await proc.exit;
    if (exit.killed) {
      if (destination) await removePartialFiles(destination, startedMs);
      return { status: 'cancelled' };
    }
    if (exit.code === 0) {
      const fileSize = await stat(filePath).then((s) => s.size, () => undefined);
      return { status: 'complete', filePath, fileSize };
    }
    return { status: 'error', message: lastErrorLines(stderr.join('\n')) || 'İndirme hatası' };
  }

  async cancel(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (state === 'starting') this.processes.set(id, 'cancel-requested');
    else if (typeof state === 'number') await killProcess(state);
  }

  async updateEngine(): Promise<string | null> {
    const res = await invoke<{ version?: string | null }>('update_ytdlp');
    return res.version ?? null;
  }

  async engineVersion(): Promise<string | null> {
    return (await invoke<{ version: string | null }>('get_ytdlp_version')).version;
  }
}
