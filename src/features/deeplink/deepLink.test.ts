import { describe, expect, it } from 'vitest';
import { parseVidraLink } from './deepLink';

const link = (params: string) => `vidra://download?${params}`;

describe('parseVidraLink', () => {
  it('http(s) linkini ve modu okur', () => {
    expect(parseVidraLink(link(`url=${encodeURIComponent('https://youtu.be/x?t=5')}&mode=mp3`)))
      .toEqual({ url: 'https://youtu.be/x?t=5', mode: 'mp3' });
    expect(parseVidraLink(link('url=https%3A%2F%2Fvimeo.com%2F1'))).toEqual({ url: 'https://vimeo.com/1', mode: 'video' });
    expect(parseVidraLink('vidra:///download/?url=https%3A%2F%2Fa.com%2Fv')).toEqual({ url: 'https://a.com/v', mode: 'video' });
  });

  it('baska sema, eylem, http olmayan ya da cok uzun linki yok sayar', () => {
    expect(parseVidraLink('https://download?url=https://a.com')).toBeNull();
    expect(parseVidraLink('vidra://delete?url=https%3A%2F%2Fa.com')).toBeNull();
    expect(parseVidraLink(link('url=file%3A%2F%2F%2Fetc%2Fpasswd'))).toBeNull();
    expect(parseVidraLink(link(`url=${encodeURIComponent('--exec=rm')}`))).toBeNull();
    expect(parseVidraLink(link(`url=https%3A%2F%2Fa.com%2F${'x'.repeat(3000)}`))).toBeNull();
    expect(parseVidraLink('bozuk')).toBeNull();
  });
});
