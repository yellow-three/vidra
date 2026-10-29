import { describe, expect, it } from 'vitest';
import { ISSUES_URL, issueUrl } from './reportIssue';

const env = { appVersion: '0.2.2', ytdlpVersion: '2026.10.26', platform: 'Linux x86_64' };

describe('issueUrl', () => {
  it('hata, link, yt-dlp ciktisi ve surumlerle dolu bir issue taslagi acar', () => {
    const url = new URL(issueUrl({ url: 'https://youtu.be/x', message: 'Video gizli.', detail: 'ERROR: Private video', selectedFormatId: 'video-720' }, env));
    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
    expect(url.searchParams.get('title')).toBe('İndirme hatası: Video gizli.');
    const body = url.searchParams.get('body')!;
    for (const part of ['Video gizli.', 'https://youtu.be/x', 'ERROR: Private video', 'Vidra: 0.2.2', 'yt-dlp: 2026.10.26', 'Format: video-720', 'Linux x86_64']) {
      expect(body).toContain(part);
    }
  });

  it('cok uzun ciktinin yalnizca sonunu alir', () => {
    const detail = 'a'.repeat(10_000) + 'SON';
    const body = new URL(issueUrl({ url: 'u', message: 'm', detail }, env)).searchParams.get('body')!;
    expect(body).toContain('SON');
    expect(body.length).toBeLessThan(5000);
  });
});
