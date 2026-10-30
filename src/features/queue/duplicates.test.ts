import { describe, expect, it } from 'vitest';
import { isHttpUrl, linksFromBatchFile, mergeClipboardLinks, splitUrls, videoKey } from './duplicates';

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

describe('linksFromBatchFile', () => {
  it('yt-dlp toplu dosyasi gibi okur: yorum satirlarini ve link olmayanlari atlar', () => {
    const text = '# liste\r\nhttps://a.com/1\n; not\n] eski\n  https://a.com/2  \n\n--exec rm\nhttps://a.com/1\n';
    expect(linksFromBatchFile(text)).toEqual(['https://a.com/1', 'https://a.com/2']);
    expect(linksFromBatchFile('')).toEqual([]);
    const many = Array.from({ length: 600 }, (_, i) => `https://a.com/${i}`).join('\n');
    expect(linksFromBatchFile(many)).toHaveLength(500);
  });
});

describe('isHttpUrl', () => {
  it('yalnizca http(s) linklerini kabul eder', () => {
    expect(isHttpUrl('https://youtu.be/x')).toBe(true);
    expect(isHttpUrl('http://a.com')).toBe(true);
    for (const text of ['--exec=rm', '-o', 'file:///etc/passwd', 'youtu.be/x', 'merhaba']) expect(isHttpUrl(text)).toBe(false);
  });
});

describe('mergeClipboardLinks', () => {
  it('bos kutuya yalnizca metindeki YouTube linklerini koyar', () => {
    expect(mergeClipboardLinks('', 'Su videoya bak https://youtu.be/jNQXAC9IVRw cok iyi https://vimeo.com/1'))
      .toBe('https://youtu.be/jNQXAC9IVRw');
  });

  it('kutuda yazilani silmez, ayni videoyu tekrar eklemez', () => {
    const box = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    expect(mergeClipboardLinks(box, 'https://youtu.be/jNQXAC9IVRw')).toBe(box);
    expect(mergeClipboardLinks(`${box} `, 'https://www.youtube.com/playlist?list=PL1'))
      .toBe(`${box} https://www.youtube.com/playlist?list=PL1`);
    expect(mergeClipboardLinks('yaziyorum', 'notyoutube.com/x --exec=rm')).toBe('yaziyorum');
  });
});
