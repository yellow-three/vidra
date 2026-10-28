import { describe, expect, it } from 'vitest';
import { buildOptions } from '../../engine/ytdlp';
import { pickDefaultFormat } from './defaultFormat';

const formats = buildOptions([
  { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080 },
  { format_id: '136', vcodec: 'avc1', acodec: 'none', height: 720 },
  { format_id: '18', vcodec: 'avc1', acodec: 'mp4a', height: 360 },
]);

describe('pickDefaultFormat', () => {
  it('ayar yoksa en yuksek cozunurlugu secer', () => {
    expect(pickDefaultFormat(formats, null)).toBe('video-1080');
  });

  it('varsayilan kaliteyi asmayan en yuksek cozunurlugu secer', () => {
    expect(pickDefaultFormat(formats, { defaultQuality: '720' })).toBe('video-720');
    expect(pickDefaultFormat(formats, { defaultQuality: '480' })).toBe('video-360');
  });

  it('hicbiri sigmiyorsa en dusuk videoyu secer', () => {
    expect(pickDefaultFormat(formats, { defaultQuality: '144' })).toBe('video-360');
  });

  it('varsayilan format MP3 ise sesi secer', () => {
    expect(pickDefaultFormat(formats, { defaultFormat: 'mp3' })).toBe('audio-mp3');
  });
});
