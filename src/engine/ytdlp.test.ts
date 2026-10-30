import { describe, expect, it } from 'vitest';
import {
  networkArgs,
  postProcessingArgs,
  rawOptions,
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

  it('her cozunurluk icin bir video, arti MP3/M4A, ardindan yt-dlp\'nin tum formatlarini uretir', () => {
    const options = buildOptions(formats);
    expect(options.map((o) => o.formatId)).toEqual([
      // En iyi video + en iyi ses (orijinal kap) en basta.
      'best-av',
      'video-1080', 'video-720', 'audio-best', 'audio-mp3', 'audio-m4a', 'audio-opus', 'audio-flac', 'audio-wav',
      // Cozunurluge gore en iyiden kotuye, sonra ses; storyboard (mhtml) atlanir.
      'fmt-v-137', 'fmt-v-248', 'fmt-v-136', 'fmt-a-140',
    ]);
    expect(options[0]).toMatchObject({ note: 'en iyi video (1080p) + en iyi ses · dönüştürmesiz', bytes: 10_000_000 });
    expect(options[1]).toMatchObject({ filesize: '9.5 MB', bytes: 10_000_000 });
    expect(options.find((o) => o.formatId === 'audio-best')).toMatchObject({ ext: 'm4a', bytes: 1_000_000 });
    // Tum formatlar listesinde en iyi video ve en iyi ses isaretlenir.
    expect(options.filter((o) => o.note.startsWith('★')).map((o) => o.formatId)).toEqual(['fmt-v-137', 'fmt-a-140']);
  });

  it('ham formatlari cozunurluk, fps, kodek ve ses bilgisiyle etiketler', () => {
    const raw = rawOptions([
      { format_id: '251', ext: 'webm', vcodec: 'none', acodec: 'opus', abr: 130.4, filesize: 3_000_000 },
      { format_id: '303', ext: 'webm', vcodec: 'vp09.00.40.08', acodec: 'none', width: 1920, height: 1080, fps: 60, dynamic_range: 'HDR10' },
      { format_id: '18', ext: 'mp4', vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', width: 640, height: 360, fps: 30 },
      { format_id: 'http-720p', ext: 'mp4', format_note: '720p' },
    ], 1_000);
    expect(raw).toEqual([
      expect.objectContaining({ formatId: 'fmt-v-303', resolution: '1920x1080 60fps HDR10', note: '★ en iyi · vp09 · en iyi sesle' }),
      expect.objectContaining({ formatId: 'fmt-av-18', resolution: '640x360', ext: 'mp4', note: 'avc1 + mp4a' }),
      // Cozunurluk bilinmeyen: yt-dlp'nin notu gosterilir.
      expect.objectContaining({ formatId: 'fmt-av-http-720p', resolution: '720p', note: '' }),
      expect.objectContaining({ formatId: 'fmt-a-251', resolution: 'Ses', note: '★ en iyi · opus 130k · yalnız ses', bytes: 3_000_000 }),
    ]);
  });

  it('yalnizca ses sunan sitede video secenegi sunmaz', () => {
    const audio: YtdlpFormat[] = [{ format_id: 'hls_aac_160k', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2' }];
    expect(buildOptions(audio).map((o) => o.formatId)).toEqual(['audio-best', 'audio-mp3', 'audio-m4a', 'audio-opus', 'audio-flac', 'audio-wav', 'fmt-a-hls_aac_160k']);
    // Kodek bilgisi vermeyen site (archive.org): video olabilir.
    expect(buildOptions([{ format_id: '0', ext: 'mp4' }]).map((o) => o.formatId)[0]).toBe('video-best');
  });

  it('cozunurluk bilgisi yoksa en iyi videoya duser', () => {
    expect(buildOptions([]).map((o) => o.formatId)).toEqual(['video-best', 'audio-mp3', 'audio-m4a', 'audio-opus', 'audio-flac', 'audio-wav']);
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

describe('grup 1: hiz, altyazi, ses', () => {
  const base = { url: 'U', outDir: '/o' };

  it('her indirmede yeniden dener; parca, bekleme ve boyut sinirini ayardan alir', () => {
    const plain = buildDownloadArgs({ ...base, option: { kind: 'video', height: 720 }, subtitles: false });
    expect(plain.join(' ')).toContain('--retries 10 --fragment-retries 10 --retry-sleep fragment:exp=1:20');
    expect(plain).not.toContain('-N');
    expect(plain).not.toContain('--max-filesize');
    const tuned = buildDownloadArgs({
      ...base, option: { kind: 'video', height: 720 }, subtitles: false, concurrentFragments: 4, sleepInterval: 3, maxFilesize: '1G',
    });
    expect(tuned.join(' ')).toContain('-N 4');
    expect(tuned.join(' ')).toContain('--sleep-interval 3 --sleep-requests 1');
    expect(tuned.join(' ')).toContain('--max-filesize 1G');
  });

  it('altyaziyi gomer; istenirse .srt olarak da yazar ve otomatik altyazilari kullanir', () => {
    const embed = buildDownloadArgs({ ...base, option: { kind: 'video', height: 720 }, subtitles: true, subtitleLangs: 'de' });
    expect(embed.join(' ')).toContain('--embed-subs --sub-langs de');
    expect(embed).not.toContain('--write-subs');
    const all = buildDownloadArgs({
      ...base, option: { kind: 'video', height: 720 }, subtitles: true, subtitleFile: true, autoSubtitles: true,
    });
    expect(all.join(' ')).toContain('--embed-subs --write-subs --convert-subs srt --write-auto-subs --sub-langs tr,en --ignore-errors');
    // Altyazi kapaliysa .srt ayari tek basina bir sey yapmaz.
    const off = buildDownloadArgs({ ...base, option: { kind: 'video', height: 720 }, subtitles: false, subtitleFile: true });
    expect(off).not.toContain('--write-subs');
  });

  it('Opus/FLAC/WAV\'a donusturur; WAV\'a kapak gomulmez; MP3 kalitesi secilir', () => {
    expect(parseOption('audio-flac')).toEqual({ kind: 'audio', codec: 'flac' });
    const flac = buildDownloadArgs({ ...base, option: parseOption('audio-flac')!, subtitles: true, embedMetadata: true });
    expect(flac.join(' ')).toContain('-x --audio-format flac');
    expect(flac).toContain('--embed-thumbnail');
    expect(flac).not.toContain('--embed-subs');
    const wav = buildDownloadArgs({ ...base, option: parseOption('audio-wav')!, subtitles: false, embedMetadata: true });
    expect(wav).not.toContain('--embed-thumbnail');
    const mp3 = buildDownloadArgs({ ...base, option: { kind: 'mp3' }, subtitles: false, mp3Quality: '192K' });
    expect(mp3.join(' ')).toContain('--audio-quality 192K');
  });

  it('videodaki elle eklenmis altyazilari ve otomatik altyazinin ozgun dilini okur', () => {
    const info = parseInfo(JSON.stringify({
      title: 'K', formats: [],
      subtitles: { tr: [], en: [], live_chat: [] },
      automatic_captions: { 'en-orig': [], en: [], de: [] },
    }), 'U');
    expect(info.meta).toMatchObject({ subtitles: ['tr', 'en'], autoSubtitles: ['en'] });
  });
});

describe('grup 3: sonradan isleme', () => {
  it('bolumleri klasore ayirir, bolum keser, kabi degistirir, etiketleri ve ek dosyalari yazar', () => {
    const args = postProcessingArgs({ kind: 'best' }, '/out', 'Liste', {
      splitChapters: true, removeChapters: ' (?i)intro ', remux: 'mp4', parseArtist: true,
      writeThumbnail: true, writeDescription: true, writeComments: true, serverMtime: true,
    });
    expect(args).toEqual([
      '--split-chapters', '-o', 'chapter:/out/Liste/%(title)s/%(section_number)02d - %(section_title)s.%(ext)s',
      '--remove-chapters', '(?i)intro',
      '--remux-video', 'mp4',
      '--parse-metadata', 'post_process:title:%(artist)s - %(title)s',
      '--write-thumbnail', '--convert-thumbnails', 'jpg',
      '--write-description',
      // Yorumlar bilgi dosyasina yazildigi icin o da acilir.
      '--write-info-json', '--write-comments',
      '--mtime',
    ]);
    expect(postProcessingArgs({ kind: 'mp3' }, '/out', undefined, { remux: 'mkv' })).toEqual([]);
    expect(postProcessingArgs({ kind: 'best' }, '/out', undefined, {})).toEqual([]);
  });
});

describe('grup 4: canli yayin, sifre, giris, yas siniri', () => {
  it('ag seceneklerine sifre, .netrc ve yas sinirini ekler', () => {
    expect(networkArgs({ videoPassword: 'gizli', netrc: true, ageLimit: 13 }))
      .toEqual(['--video-password', 'gizli', '--netrc', '--age-limit', '13']);
    expect(networkArgs({ netrc: '/home/u/.netrc' })).toEqual(['--netrc', '--netrc-location', '/home/u/.netrc']);
  });

  it('canli yayini bastan kaydeder ya da baslamasini bekler', () => {
    const args = buildDownloadArgs({ url: 'U', outDir: '/o', option: { kind: 'best' }, subtitles: false, liveFromStart: true, waitForVideo: true });
    expect(args.join(' ')).toContain('--live-from-start --wait-for-video 30-600');
  });

  it('toplami bilinmeyen (canli) indirmede inen miktari verir; yayin durumunu okur', () => {
    const line = '[progress] ' + JSON.stringify({ status: 'downloading', downloaded_bytes: 5 * 1024 ** 2, speed: 1024 });
    expect(parseOutputLine(line)).toMatchObject({ percent: 0, downloaded: '5.0 MB' });
    expect(parseInfo(JSON.stringify({ title: 'Y', formats: [], live_status: 'is_live' }), 'U').meta?.live).toBe('is_live');
    expect(parseInfo(JSON.stringify({ title: 'Y', formats: [], live_status: 'was_live' }), 'U').meta?.live).toBeUndefined();
  });
});

describe('grup 5: ag ve dosya sistemi', () => {
  it('tarayici taklidi, bolge ve IP surumunu ag seceneklerine ekler', () => {
    expect(networkArgs({ impersonate: 'chrome', xff: 'US', ipVersion: 4 }))
      .toEqual(['--impersonate', 'chrome', '--xff', 'US', '--force-ipv4']);
  });

  it('klasor duzeni, dosya adi kurallari, uzerine yazma ve aria2', () => {
    const args = buildDownloadArgs({
      url: 'U', outDir: '/out', option: { kind: 'mp3' }, subtitles: false,
      folderLayout: 'channel-year', filenameChars: 'ascii', trimFilenames: 120, overwrite: true, aria2: true,
    });
    expect(args[args.indexOf('-o') + 1]).toBe('/out/%(channel,uploader,uploader_id)s/%(upload_date>%Y)s/%(title)s.%(ext)s');
    // Sinir indirme klasorunun ("/out" + "/") uzerine eklenir.
    expect(args.join(' ')).toContain('--restrict-filenames --trim-filenames 125 --force-overwrites --downloader http:aria2c');
    const plain = buildDownloadArgs({ url: 'U', outDir: '/out', option: { kind: 'mp3' }, subtitles: false, folderLayout: 'bilinmeyen' });
    expect(plain[plain.indexOf('-o') + 1]).toBe('/out/%(title)s.%(ext)s');
  });
});

describe('en iyi kombinasyonlar', () => {
  it('en iyi video + sesi kabi degistirmeden, en iyi sesi donusturmeden indirir', () => {
    const best = buildDownloadArgs({ url: 'U', option: parseOption('best-av')!, outDir: '/o', subtitles: true, embedMetadata: true });
    expect(best.join(' ')).toContain('-f bv*+ba/b');
    expect(best).not.toContain('--merge-output-format');
    expect(best).toContain('--embed-subs');
    expect(best).toContain('--embed-thumbnail');
    const audio = buildDownloadArgs({ url: 'U', option: parseOption('audio-best')!, outDir: '/o', subtitles: true, embedMetadata: true });
    expect(audio.join(' ')).toContain('-f ba/b');
    expect(audio).not.toContain('-x');
    expect(audio).not.toContain('--embed-subs');
    // Opus/WebM'e kapak gomulemez.
    expect(audio).not.toContain('--embed-thumbnail');
  });
});

describe('ham format secimi', () => {
  it('kimlikten turu cozer; kisa cizgili format kimlikleri de olur', () => {
    expect(parseOption('fmt-v-hls-1080p')).toEqual({ kind: 'format', formatId: 'hls-1080p', video: true, audio: false });
    expect(parseOption('fmt-a-251')).toEqual({ kind: 'format', formatId: '251', video: false, audio: true });
  });

  it('yalniz goruntuye en iyi sesi ekler, kabi yt-dlp\'ye birakir, ses formatina altyazi koymaz', () => {
    const video = buildDownloadArgs({ url: 'U', option: parseOption('fmt-v-303')!, outDir: '/o', subtitles: true });
    expect(video.join(' ')).toContain('-f 303+ba/303');
    expect(video).not.toContain('--merge-output-format');
    expect(video).toContain('--embed-subs');
    expect(video.join(' ')).toContain('[%(format_id)s].%(ext)s');
    const audio = buildDownloadArgs({ url: 'U', option: parseOption('fmt-a-251')!, outDir: '/o', subtitles: true });
    expect(audio.join(' ')).toContain('-f 251 ');
    expect(audio).not.toContain('--embed-subs');
    expect(audio).not.toContain('-x');
    const withMeta = buildDownloadArgs({ url: 'U', option: parseOption('fmt-a-251')!, outDir: '/o', subtitles: false, embedMetadata: true });
    expect(withMeta).toContain('--embed-metadata');
    expect(withMeta).not.toContain('--embed-thumbnail');
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
    expect(outputTemplate({ kind: 'best-video' }, '{channel} - {title}')).toBe('%(channel,uploader,uploader_id)s - %(title)s [%(height)sp].%(ext)s');
    expect(outputTemplate({ kind: 'm4a' }, '{title} [{id}]')).toBe('%(title)s [%(id)s].%(ext)s');
    // Gecersiz kalip basliga duser.
    expect(outputTemplate({ kind: 'mp3' }, '{bilinmeyen}')).toBe('%(title)s.%(ext)s');
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
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=a', title: 'A', duration: 10, thumbnail: 'b', meta: expect.objectContaining({ id: 'a' }) }),
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=b', title: 'B', duration: undefined, thumbnail: undefined }),
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
