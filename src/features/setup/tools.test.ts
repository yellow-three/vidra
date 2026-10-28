import { describe, expect, it } from 'vitest';
import type { ToolStatus } from '../../types/app-api';
import { installSteps, missingTools, outdatedTools } from './tools';

const tool = (id: ToolStatus['id'], patch: Partial<ToolStatus> = {}): ToolStatus => ({
  id, installed: false, bundled: false, outdated: false, downloadable: true, downloadMb: 10, ...patch,
});

describe('kurulum adimlari', () => {
  it('eksik zorunlu bilesenleri sirayla indirir, ffprobe FFmpeg arsivinden gelir', () => {
    const tools = [tool('yt-dlp'), tool('deno'), tool('ffmpeg'), tool('ffprobe')];
    expect(missingTools(tools)).toEqual(['yt-dlp', 'deno', 'ffmpeg']);
    expect(installSteps(tools, true)).toEqual([
      { tool: 'yt-dlp', withFfprobe: false, downloadMb: 10 },
      { tool: 'deno', withFfprobe: false, downloadMb: 10 },
      { tool: 'ffmpeg', withFfprobe: true, downloadMb: 10 },
    ]);
  });

  it('paketlenmis ffmpeg varsa ffprobe ayri adimdir; kurulu olanlar atlanir', () => {
    const tools = [tool('yt-dlp', { installed: true }), tool('deno', { installed: true, outdated: true }), tool('ffmpeg', { installed: true, bundled: true }), tool('ffprobe')];
    expect(missingTools(tools)).toEqual([]);
    expect(outdatedTools(tools)).toEqual(['deno']);
    expect(installSteps(tools, true).map((s) => s.tool)).toEqual(['deno', 'ffprobe']);
    expect(installSteps(tools, false).map((s) => s.tool)).toEqual(['deno']);
  });

  it('indirilemeyen bilesen adim olmaz ama eksik sayilir', () => {
    const tools = [tool('yt-dlp', { installed: true }), tool('deno', { installed: true }), tool('ffmpeg', { downloadable: false }), tool('ffprobe', { downloadable: false })];
    expect(missingTools(tools)).toEqual(['ffmpeg']);
    expect(installSteps(tools, true)).toEqual([]);
  });
});
