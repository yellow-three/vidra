import { describe, expect, it } from 'vitest';
import { buildConvertArgs } from './ffmpeg';

describe('buildConvertArgs', () => {
  it('MP3 icin kaliteye gore bit hizi secer ve ciktiyi girdinin yanina yazar', () => {
    const { args, outputPath } = buildConvertArgs('/v/Klip.webm', 'mp3', 'high');
    expect(outputPath).toBe('/v/Klip_converted.mp3');
    expect(args).toEqual(['-i', '/v/Klip.webm', '-y', '-vn', '-acodec', 'libmp3lame', '-ab', '320k', '/v/Klip_converted.mp3']);
  });

  it('bilinmeyen formatta LGPL uyumlu OpenH264 ile MP4 uretir', () => {
    // LGPL FFmpeg build'inde GPL'li libx264 yoktur; OpenH264 CRF desteklemez, bit hizi kullanilir.
    const { args, outputPath } = buildConvertArgs('C:\\v\\Klip.mov', 'xyz', 'low');
    expect(outputPath).toBe('C:\\v\\Klip_converted.mp4');
    expect(args.join(' ')).toContain('-c:v libopenh264 -b:v 1500k -c:a aac');
    expect(args).not.toContain('libx264');
  });
});
