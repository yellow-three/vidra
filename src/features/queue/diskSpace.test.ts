import { describe, expect, it } from 'vitest';
import { DISK_MARGIN_BYTES, diskShortage } from './diskSpace';

const MB = 1024 ** 2;

describe('diskShortage', () => {
  it('dosya boyutu artı pay kadar bos alan ister', () => {
    expect(diskShortage(500 * MB, 100 * MB)).toBeNull();
    expect(diskShortage(250 * MB, 100 * MB)).toBe(
      'Diskte yeterli boş alan yok: yaklaşık 300.0 MB gerekiyor, 250.0 MB boş. Yer açın ya da Ayarlar\'dan başka bir indirme klasörü seçin.',
    );
  });

  it('boyut bilinmiyorsa yalnizca payi, bos alan olculemiyorsa hicbir seyi kontrol etmez', () => {
    expect(diskShortage(DISK_MARGIN_BYTES - 1, undefined)).not.toBeNull();
    expect(diskShortage(DISK_MARGIN_BYTES, undefined)).toBeNull();
    expect(diskShortage(null, 10 ** 12)).toBeNull();
  });
});
