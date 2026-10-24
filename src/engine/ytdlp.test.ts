import { describe, expect, it } from 'vitest';
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

describe('parseOption', () => {
  it('UI secenek kimliklerini cozer', () => {
    expect(parseOption('video-1080')).toEqual({ kind: 'video', height: 1080 });
    expect(parseOption('video-best')).toEqual({ kind: 'best-video' });
    expect(parseOption('audio-mp3')).toEqual({ kind: 'mp3' });
    expect(parseOption('audio-m4a')).toEqual({ kind: 'm4a' });
    expect(parseOption('137')).toBeNull();
    expect(parseOption('video-abc')).toBeNull();
  });
});

describe('parseOutputLine', () => {
  it('%(progress)j satirindan yuzde, hiz ve kalan sureyi cikarir', () => {
    const line = '[progress] ' + JSON.stringify({
      status: 'downloading',
      downloaded_bytes: 2_500_000,
      total_bytes: 10_000_000,
      speed: 1_258_291.2,
      eta: 72,
    });
    expect(parseOutputLine(line)).toEqual({
      type: 'progress',
      percent: 25,
      speed: '1.2 MB/s',
      eta: '01:12',
    });
  });

  it('toplam bilinmiyorsa tahmini toplami kullanir, eksik alanlari bos birakir', () => {
    const line = '[progress] ' + JSON.stringify({
      status: 'downloading',
      downloaded_bytes: 500,
      total_bytes: null,
      total_bytes_estimate: 1000,
      speed: null,
      eta: null,
    });
    expect(parseOutputLine(line)).toEqual({ type: 'progress', percent: 50, speed: '', eta: '' });
  });

  it('bitmis indirmeyi %100 sayar', () => {
    const line = '[progress] ' + JSON.stringify({ status: 'finished', downloaded_bytes: 10, total_bytes: null });
    expect(parseOutputLine(line)).toEqual({ type: 'progress', percent: 100, speed: '', eta: '' });
  });

  it('hedef ve son dosya yolu satirlarini tanir', () => {
    expect(parseOutputLine('DEST:/out/Video.mp4')).toEqual({ type: 'destination', path: '/out/Video.mp4' });
    expect(parseOutputLine('FILE:/out/Video.mp4')).toEqual({ type: 'file', path: '/out/Video.mp4' });
  });

  it('tanimadigi satirlari yok sayar', () => {
    expect(parseOutputLine('[download] 45.3% of 10MiB')).toBeNull();
    expect(parseOutputLine('[progress] {bozuk json')).toBeNull();
  });
});

describe('buildOptions', () => {
  const formats: YtdlpFormat[] = [
    { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 1_000_000 },
    { format_id: '137', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080, filesize: 9_000_000 },
    { format_id: '248', ext: 'webm', vcodec: 'vp9', acodec: 'none', height: 1080 },
    { format_id: '136', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 720 },
    { format_id: 'sb0', ext: 'mhtml', vcodec: 'none', acodec: 'none' },
  ];

  it('her cozunurluk icin bir video, arti MP3/M4A uretir', () => {
    const options = buildOptions(formats);
    expect(options.map((o) => o.formatId)).toEqual(['video-1080', 'video-720', 'audio-mp3', 'audio-m4a']);
    expect(options[0].filesize).toBe('9.5 MB');
  });

  it('cozunurluk bilgisi yoksa en iyi videoya duser', () => {
    expect(buildOptions([]).map((o) => o.formatId)).toEqual(['video-best', 'audio-mp3', 'audio-m4a']);
  });
});

describe('partialFilesToRemove', () => {
  const started = 1_000_000;

  it('yalnizca iptal edilen indirmenin bu oturumdaki dosyalarini secer', () => {
    const entries = [
      { name: 'Video.mp3', mtimeMs: started - 60_000 },
      { name: 'Video.f137.mp4.part', mtimeMs: started + 10 },
      { name: 'Video.en.vtt', mtimeMs: started + 20 },
      { name: 'Video 2.mp4', mtimeMs: started + 30 },
    ];
    expect(partialFilesToRemove('/out/Video.mp4', entries, started)).toEqual(['Video.f137.mp4.part', 'Video.en.vtt']);
  });

  it('kaba mtime saatine 2 sn tolerans tanir', () => {
    const entries = [{ name: 'Video.temp.mp4', mtimeMs: started - 5 }];
    expect(partialFilesToRemove('/out/Video.mp4', entries, started)).toEqual(['Video.temp.mp4']);
  });

  it('Windows yollarini da ayristirir', () => {
    const entries = [{ name: 'Video.mp4.part', mtimeMs: started }];
    expect(partialFilesToRemove('C:\\Users\\a\\Video.mp4', entries, started)).toEqual(['Video.mp4.part']);
  });
});

describe('buildDownloadArgs', () => {
  it('MP3 icin sesi ayiklar ve altyaziyi atlar', () => {
    const args = buildDownloadArgs({
      url: 'U',
      option: { kind: 'mp3' },
      outDir: '/out',
      ffmpegPath: '/ff',
      subtitles: true,
    });
    const joined = args.join(' ');
    expect(joined).toContain('-x --audio-format mp3');
    expect(joined).toContain('--ffmpeg-location /ff');
    expect(joined).not.toContain('--embed-subs');
    expect(args).toContain('/out/%(title)s.%(ext)s');
    expect(args).toContain('download:[progress] %(progress)j');
  });

  it('videoda yuksekligi sinirlar, once cozunurlugu siralar ve MP4 birlestirir', () => {
    const args = buildDownloadArgs({
      url: 'U',
      option: { kind: 'video', height: 720 },
      outDir: '/out',
      subtitles: true,
    });
    const joined = args.join(' ');
    expect(joined).toContain('-f bv*[height<=720]+ba/b[height<=720]/bv*+ba/b');
    expect(joined).toContain('-S res,vcodec:h264,acodec:m4a');
    expect(joined).toContain('--merge-output-format mp4');
    expect(joined).toContain('--embed-subs');
    expect(joined).not.toContain('--write-subs');
    expect(joined).not.toContain('--ffmpeg-location');
  });

  it('paketlenmis deno\'yu acik yoluyla verir (yt-dlp yalnizca PATH\'te arardi)', () => {
    const args = buildDownloadArgs({ url: 'U', option: { kind: 'mp3' }, outDir: '/out', subtitles: false, denoPath: '/app/deno' });
    expect(args.join(' ')).toContain('--js-runtimes deno:/app/deno');
    const without = buildDownloadArgs({ url: 'U', option: { kind: 'mp3' }, outDir: '/out', subtitles: false });
    expect(without).not.toContain('--js-runtimes');
  });

  it('analiz argumanlarina da deno yolunu ekler', () => {
    expect(buildInfoArgs('U', '/app/deno')).toEqual(['U', '-J', '--no-playlist', '--js-runtimes', 'deno:/app/deno']);
  });
});

describe('lastErrorLines', () => {
  it('uyari ve debug satirlarini atip son iki hatayi verir', () => {
    const stderr = '[debug] x\nWARNING: y\nERROR: a\n\nERROR: b\nERROR: c\n';
    expect(lastErrorLines(stderr)).toBe('ERROR: b\nERROR: c');
  });
});
