import { describe, expect, it } from 'vitest';
import { splitUrls, videoKey } from './duplicates';

describe('videoKey', () => {
  it('farkli YouTube link bicimlerini ayni videoya indirger', () => {
    const keys = [
      'https://www.youtube.com/watch?v=jNQXAC9IVRw&t=5',
      'https://youtu.be/jNQXAC9IVRw?si=x',
      'https://m.youtube.com/watch?v=jNQXAC9IVRw',
      'https://www.youtube.com/shorts/jNQXAC9IVRw',
    ].map(videoKey);
    expect(new Set(keys)).toEqual(new Set(['yt:jNQXAC9IVRw']));
  });

  it('diger linklerde sondaki egik cizgiyi yok sayar', () => {
    expect(videoKey('https://vimeo.com/123/')).toBe(videoKey('https://vimeo.com/123'));
    expect(videoKey('duz metin')).toBe('duz metin');
  });
});

describe('splitUrls', () => {
  it('satir, bosluk ve bitisik linkleri ayirir; tekrarlari atar', () => {
    expect(splitUrls(' https://a.com/1\n https://a.com/2https://a.com/1 ')).toEqual(['https://a.com/1', 'https://a.com/2']);
    expect(splitUrls('   ')).toEqual([]);
  });
});
