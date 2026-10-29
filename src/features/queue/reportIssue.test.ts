import { describe, expect, it } from 'vitest';
import { ISSUES_URL, issueUrl } from './reportIssue';

const env = { appVersion: '0.2.2', ytdlpVersion: '2026.10.26', platform: 'Linux x86_64' };

describe('issueUrl', () => {
  it('hata formunun alanlarini hata, link, yt-dlp ciktisi ve surumlerle doldurur', () => {
    const url = new URL(issueUrl({ url: 'https://youtu.be/x', message: 'Video gizli.', detail: 'ERROR: Private video', selectedFormatId: 'video-720' }, env));
    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: 'bug_report.yml',
      title: 'İndirme hatası: Video gizli.',
      what: 'Video gizli.',
      link: 'https://youtu.be/x',
      output: 'ERROR: Private video',
      versions: 'Vidra 0.2.2, yt-dlp 2026.10.26, format video-720, Linux x86_64',
    });
  });

  it('cok uzun ciktinin yalnizca sonunu alir', () => {
    const detail = 'a'.repeat(10_000) + 'SON';
    const output = new URL(issueUrl({ url: 'u', message: 'm', detail }, env)).searchParams.get('output')!;
    expect(output.endsWith('SON')).toBe(true);
    expect(output.length).toBe(4000);
  });
});
