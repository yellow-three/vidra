import { describe, expect, it, vi } from 'vitest';

vi.mock('../../app/queryClient', () => ({ queryClient: {} }));
vi.mock('../../engine', () => ({ engine: {} }));
vi.mock('../../lib/appApi', () => ({ appApi: {} }));
vi.mock('./queries', () => ({}));

const { shouldAutoUpdate } = await import('./ytdlpAutoUpdate');

const DAY = 24 * 60 * 60 * 1000;

describe('shouldAutoUpdate', () => {
  it('hic guncellenmemisse ya da bir hafta gectiyse gunceller', () => {
    expect(shouldAutoUpdate({}, 10 * DAY)).toBe(true);
    expect(shouldAutoUpdate({ ytdlpCheckedAt: 3 * DAY }, 10 * DAY)).toBe(true);
  });

  it('son bir haftada guncellendiyse ya da kapatildiysa beklemez', () => {
    expect(shouldAutoUpdate({ ytdlpCheckedAt: 5 * DAY }, 10 * DAY)).toBe(false);
    expect(shouldAutoUpdate({ autoUpdateYtdlp: false }, 10 * DAY)).toBe(false);
  });
});
