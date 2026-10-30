import { describe, expect, it } from 'vitest';
import { patternError, previewFilename, resolvePattern, toYtdlpTemplate } from './filename';

const labels = { title: 'başlık', channel: 'kanal', id: 'kimlik', date: 'tarih', site: 'site' };

describe('dosya adi kaliplari', () => {
  it('kalibi yt-dlp sablonuna cevirir; duz metindeki % ve gecersiz karakterleri kacirir', () => {
    expect(toYtdlpTemplate('{channel} - {date} - {title} [{id}]'))
      .toBe('%(channel,uploader,uploader_id)s - %(upload_date>%Y-%m-%d)s - %(title)s [%(id)s]');
    expect(toYtdlpTemplate('%100 {title}: a/b')).toBe('%%100 %(title)s_ a_b');
    expect(toYtdlpTemplate('{site} {title}')).toBe('%(extractor_key)s %(title)s');
  });

  it('bos, alansiz ya da bilinmeyen alanli kalibi reddeder ve basliga duser', () => {
    expect(patternError('  ')).toBe('empty');
    expect(patternError('video')).toBe('noField');
    expect(patternError('{baslik}')).toBe('unknownField');
    expect(patternError('{title}')).toBeNull();
    expect(toYtdlpTemplate('video')).toBe('%(title)s');
  });

  it('ayardaki secimden kalip cikarir; eski anahtar da calisir', () => {
    expect(resolvePattern('channel-title-id')).toBe('{channel} - {title} [{id}]');
    expect(resolvePattern('uploader-title')).toBe('{channel} - {title}');
    expect(resolvePattern('custom', '{date} {title}')).toBe('{date} {title}');
    expect(resolvePattern('custom', 'gecersiz')).toBe('{title}');
    expect(resolvePattern(undefined)).toBe('{title}');
  });

  it('onizlemede bilinen degerleri, bilinmeyenler icin alan adini kullanir', () => {
    expect(previewFilename('{channel} - {title} [{id}]', { title: 'Klip: 1', channel: 'Kanal' }, labels)).toBe('Kanal - Klip_ 1 [kimlik]');
  });

  it('liste sirasini yazar; liste disinda sira alanini ve ardindaki ayiraci atar', () => {
    expect(toYtdlpTemplate('{index} - {title}', '03')).toBe('03 - %(title)s');
    expect(toYtdlpTemplate('{index} - {title}')).toBe('%(title)s');
    expect(patternError('{index}')).toBe('noField');
    expect(previewFilename('{index}. {title}', { title: 'A', index: '07' }, { ...labels, index: 'sıra' })).toBe('07. A');
  });
});
