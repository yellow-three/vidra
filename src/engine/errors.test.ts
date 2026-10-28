import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('bot dogrulamasinda cerez ayarini onerir, ham metni saklar', () => {
    const raw = "ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies";
    expect(friendlyError(raw)).toEqual({ message: expect.stringContaining('Ağ ve hesap'), detail: raw });
  });

  it('yas kisitlamasini, gizli videoyu ve ag hatasini tanir', () => {
    expect(friendlyError('ERROR: Sign in to confirm your age.').message).toContain('yaş kısıtlamalı');
    expect(friendlyError('ERROR: [youtube] aaaaaaaaaaa: This video is unavailable').message).toContain('kullanılamıyor');
    expect(friendlyError('ERROR: [youtube] x: Private video. Sign in if you\'ve been granted access').message).toContain('gizli');
    expect(friendlyError('ERROR: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution> (getaddrinfo)').message)
      .toContain('İnternete');
  });

  it('403 hatasinda yt-dlp guncellemesini onerir', () => {
    expect(friendlyError('ERROR: unable to download video data: HTTP Error 403: Forbidden').message).toContain('güncelleyip');
  });

  it('taninmayan hatayi oldugu gibi gosterir', () => {
    expect(friendlyError('ERROR: tuhaf bir sey')).toEqual({ message: 'ERROR: tuhaf bir sey' });
    expect(friendlyError('  ')).toEqual({ message: 'Bilinmeyen hata' });
  });

  it('secilen dilde mesaj verir', () => {
    setLanguage('en');
    try {
      expect(friendlyError('ERROR: Private video').message).toContain('private');
      expect(friendlyError('').message).toBe('Unknown error');
    } finally {
      setLanguage('tr');
    }
  });
});
