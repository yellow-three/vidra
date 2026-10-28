import { describe, expect, it } from 'vitest';
import { buildConvertArgs, convertPercent, outputCandidates, parseDuration, parseProgressLine } from './ffmpeg';

describe('buildConvertArgs', () => {
  it('MP3 icin kaliteye gore bit hizi secer ve ciktiyi girdinin yanina yazar', () => {
    const { args, outputPath } = buildConvertArgs('/v/Klip.webm', 'mp3', 'high');
    expect(outputPath).toBe('/v/Klip_converted.mp3');
    expect(args).toEqual([
      '-i', '/v/Klip.webm', '-n', '-progress', 'pipe:1', '-nostats',
      '-vn', '-acodec', 'libmp3lame', '-ab', '320k', '/v/Klip_converted.mp3',
    ]);
  });

  it('bilinmeyen formatta LGPL uyumlu OpenH264 ile MP4 uretir', () => {
    // LGPL FFmpeg build'inde GPL'li libx264 yoktur; OpenH264 CRF desteklemez, bit hizi kullanilir.
    const { args, outputPath } = buildConvertArgs('C:\\v\\Klip.mov', 'xyz', 'low');
    expect(outputPath).toBe('C:\\v\\Klip_converted.mp4');
    expect(args.join(' ')).toContain('-c:v libopenh264 -b:v 1500k -c:a aac');
    expect(buildConvertArgs('/v/a.webm', 'mp4', 'low', 'libx264').args.join(' ')).toContain('-c:v libx264 -b:v 1500k');
    expect(args).not.toContain('libx264');
  });
});

describe('outputCandidates', () => {
  it('onceki ciktilarin uzerine yazmamak icin numarali adlar onerir', () => {
    const names = outputCandidates('/v/Klip.webm', 'mp3');
    expect(names.slice(0, 3)).toEqual(['/v/Klip_converted.mp3', '/v/Klip_converted (2).mp3', '/v/Klip_converted (3).mp3']);
    expect(buildConvertArgs('/v/Klip.webm', 'mp3', 'high', 'libopenh264', names[1]).args.slice(-1)[0]).toBe('/v/Klip_converted (2).mp3');
  });
});

describe('FFmpeg ilerlemesi', () => {
  it('stderr Duration satirindan toplam sureyi saniye olarak okur', () => {
    expect(parseDuration('  Duration: 01:02:03.50, start: 0.000000, bitrate: 128 kb/s')).toBe(3723.5);
    expect(parseDuration('  Duration: N/A, bitrate: N/A')).toBeNull();
    expect(parseDuration('Stream #0:0: Video: h264')).toBeNull();
  });

  it('-progress ciktisindan islenen sureyi ve bitisi okur', () => {
    expect(parseProgressLine('out_time_us=9500000')).toEqual({ type: 'time', seconds: 9.5 });
    expect(parseProgressLine('out_time_us=N/A')).toBeNull();
    expect(parseProgressLine('progress=end')).toEqual({ type: 'end' });
    expect(parseProgressLine('progress=continue')).toBeNull();
    expect(parseProgressLine('bitrate= 128.0kbits/s')).toBeNull();
  });

  it('yuzdeyi 0-99 arasinda tutar; sure bilinmiyorsa 0 doner', () => {
    expect(convertPercent(9.5, 19)).toBe(50);
    expect(convertPercent(25, 19)).toBe(99);
    expect(convertPercent(-1, 19)).toBe(0);
    expect(convertPercent(5, null)).toBe(0);
  });
});
