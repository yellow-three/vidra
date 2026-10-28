import { describe, expect, it } from 'vitest';
import {
  buildDownloadArgs,
  buildInfoArgs,
  buildOptions,
  isVideoInPlaylist,
  lastErrorLines,
  formatClock,
  outputTemplate,
  parseClock,
  safeFolderName,
  parseInfo,
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
    expect(joined).not.toContain('--embed-thumbnail');
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

  it('kapak/metadata, hiz siniri, cerez ve proxy argumanlarini ekler', () => {
    const args = buildDownloadArgs({
      url: 'U',
      option: { kind: 'mp3' },
      outDir: '/out',
      subtitles: false,
      embedMetadata: true,
      rateLimit: '5M',
      cookiesFromBrowser: 'firefox',
      proxy: 'socks5://127.0.0.1:1080',
    }).join(' ');
    expect(args).toContain('--embed-thumbnail --embed-metadata');
    expect(args).toContain('--limit-rate 5M');
    expect(args).toContain('--cookies-from-browser firefox');
    expect(args).toContain('--proxy socks5://127.0.0.1:1080');
  });

  it('video dosya adina cozunurluk ekler; ayni videonun farkli kaliteleri cakismaz', () => {
    const args = buildDownloadArgs({ url: 'U', option: { kind: 'video', height: 720 }, outDir: '/out', subtitles: false });
    // `-` ile baslayan bir link yt-dlp secenegi olarak okunmasin.
    expect(args.slice(-2)).toEqual(['--', 'U']);
    expect(args).toContain('/out/%(title)s [%(height)sp].%(ext)s');
    expect(outputTemplate({ kind: 'best-video' }, 'uploader-title')).toBe('%(uploader)s - %(title)s [%(height)sp].%(ext)s');
    expect(outputTemplate({ kind: 'm4a' }, 'title-id')).toBe('%(title)s [%(id)s].%(ext)s');
    expect(outputTemplate({ kind: 'mp3' }, 'bilinmeyen')).toBe('%(title)s.%(ext)s');
  });
});

describe('buildInfoArgs', () => {
  it('listeleri hizli (flat) okur, deno yolunu ve ag seceneklerini ekler', () => {
    expect(buildInfoArgs({ url: 'U', denoPath: '/app/deno' }))
      .toEqual(['-J', '--flat-playlist', '--no-playlist', '--js-runtimes', 'deno:/app/deno', '--', 'U']);
    expect(buildInfoArgs({ url: 'U', playlist: true, cookiesFromBrowser: 'chrome:/p' }))
      .toEqual(['-J', '--flat-playlist', '--yes-playlist', '--cookies-from-browser', 'chrome:/p', '--', 'U']);
  });
});

describe('parseInfo', () => {
  it('tek videoyu sade seceneklere cevirir', () => {
    const info = parseInfo(JSON.stringify({ title: 'Klip', duration: 5, formats: [] }), 'U');
    expect(info).toMatchObject({ title: 'Klip', url: 'U', duration: 5 });
    expect(info.entries).toBeUndefined();
  });

  it('oynatma listesinden indirilebilir girdileri cikarir', () => {
    const json = JSON.stringify({
      _type: 'playlist',
      title: 'Liste',
      entries: [
        { id: 'a', url: 'https://www.youtube.com/watch?v=a', title: 'A', duration: 10, thumbnails: [{ url: 'k' }, { url: 'b' }] },
        { id: 'b', title: 'B' },
        { id: 'c', url: 'https://www.youtube.com/watch?v=c', title: '[Private video]' },
      ],
    });
    const info = parseInfo(json, 'L');
    expect(info.title).toBe('Liste');
    expect(info.entries).toEqual([
      { url: 'https://www.youtube.com/watch?v=a', title: 'A', duration: 10, thumbnail: 'b' },
      { url: 'https://www.youtube.com/watch?v=b', title: 'B', duration: undefined, thumbnail: undefined },
    ]);
    expect(info.formats.map((f) => f.formatId)).toContain('video-1080');
  });

  it('listedeki videoyu tanir', () => {
    expect(isVideoInPlaylist('https://www.youtube.com/watch?v=a&list=PL1')).toBe(true);
    expect(isVideoInPlaylist('https://www.youtube.com/playlist?list=PL1')).toBe(false);
    expect(isVideoInPlaylist('https://youtu.be/a')).toBe(false);
  });
});

describe('lastErrorLines', () => {
  it('uyari ve debug satirlarini atip son iki hatayi verir', () => {
    const stderr = '[debug] x\nWARNING: y\nERROR: a\n\nERROR: b\nERROR: c\n';
    expect(lastErrorLines(stderr)).toBe('ERROR: b\nERROR: c');
  });
});

describe('bolum ve klasor', () => {
  it('sureyi okur ve yazar', () => {
    expect(parseClock('90')).toBe(90);
    expect(parseClock('1:30')).toBe(90);
    expect(parseClock('01:02:03')).toBe(3723);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3723, '.')).toBe('01.02.03');
  });

  it('klasor adini guvenli yapar, yuzdeyi kacirir', () => {
    expect(safeFolderName('Mix: a/b? %100 ')).toBe('Mix_ a_b_ %%100');
    expect(safeFolderName(' ... ')).toBe('Oynatma listesi');
  });

  it('bolumu, liste klasorunu ve altyazi dillerini argumanlara ekler', () => {
    const args = buildDownloadArgs({
      url: 'U', option: { kind: 'video', height: 720 }, outDir: '/out', subtitles: true, subtitleLangs: 'de,fr',
      subfolder: 'Liste', section: { start: 65, end: 90 },
    });
    expect(args[args.indexOf('-o') + 1]).toBe('/out/Liste/%(title)s [%(height)sp] [01.05-01.30].%(ext)s');
    expect(args[args.indexOf('--download-sections') + 1]).toBe('*65-90');
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('de,fr');
    expect(outputTemplate({ kind: 'mp3' }, undefined, { section: { start: 10 } })).toBe('%(title)s [00.10-son].%(ext)s');
    expect(buildDownloadArgs({ url: 'U', option: { kind: 'mp3' }, outDir: '/o', subtitles: false, section: { start: 3 } }))
      .toContain('*3-inf');
  });

  it('SponsorBlock modunu argumanlara cevirir', () => {
    const base = { url: 'U', option: { kind: 'mp3' } as const, outDir: '/o', subtitles: false };
    expect(buildDownloadArgs({ ...base, sponsorBlock: 'mark' })).toEqual(expect.arrayContaining(['--sponsorblock-mark', 'all']));
    expect(buildDownloadArgs({ ...base, sponsorBlock: 'remove' }))
      .toEqual(expect.arrayContaining(['--sponsorblock-remove', 'sponsor,selfpromo,interaction']));
    expect(buildDownloadArgs({ ...base, sponsorBlock: 'off' }).join(' ')).not.toContain('sponsorblock');
  });
});
