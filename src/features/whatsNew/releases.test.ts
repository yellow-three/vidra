import { describe, expect, it } from 'vitest';
import { compareVersions, releasesSince } from './releases';

describe('yenilikler', () => {
  it('surumleri sayi olarak karsilastirir', () => {
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0);
    expect(compareVersions('0.5.0', '0.5.0')).toBe(0);
  });

  it('atlanan surumlerin notlarini da gosterir; ilk kez ise yalnizca bu surumu', () => {
    expect(releasesSince('0.4.0', '0.6.0').map((r) => r.version)).toEqual(['0.6.0', '0.5.0']);
    expect(releasesSince('0.5.0', '0.6.0').map((r) => r.version)).toEqual(['0.6.0']);
    expect(releasesSince(undefined, '0.6.0').map((r) => r.version)).toEqual(['0.6.0']);
  });
});
