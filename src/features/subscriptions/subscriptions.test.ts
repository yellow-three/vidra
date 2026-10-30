import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, Subscription } from '../../types';

const mocks = vi.hoisted(() => ({
  getInfo: vi.fn(),
  saveSettings: vi.fn(),
  fetchHistory: vi.fn(),
  settings: {} as AppSettings,
}));

vi.mock('../../engine', () => ({ engine: { getInfo: mocks.getInfo } }));
vi.mock('../../lib/appApi', () => ({
  appApi: {
    saveSettings: async (patch: Partial<AppSettings>) => {
      mocks.saveSettings(patch);
      Object.assign(mocks.settings, patch);
      return { success: true };
    },
  },
}));
vi.mock('../settings/queries', () => ({ fetchSettings: async () => mocks.settings, invalidateSettings: async () => {} }));
vi.mock('../history/queries', () => ({ fetchHistory: mocks.fetchHistory, addHistory: vi.fn() }));

const { checkSubscription, checkDueSubscriptions } = await import('./subscriptions');
const { useQueueStore } = await import('../queue/store');

const entries = (...ids: string[]) => ids.map((id) => ({ url: `https://www.youtube.com/watch?v=${id.padEnd(11, 'x')}`, title: id }));
const sub = (seen: string[], checkedAt = 0): Subscription => ({
  id: 's1', url: 'https://www.youtube.com/@kanal', title: 'Kanal', addedAt: 0, checkedAt, seen: seen.map((id) => `yt:${id.padEnd(11, 'x')}`),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchHistory.mockResolvedValue([]);
  useQueueStore.setState({ tasks: [], playlistPicks: [] });
});

describe('abonelik kontrolu', () => {
  it('gorulmemis ve indirilmemis videolari isaretli acar; pencere kapaninca hepsini gorulmus sayar', async () => {
    mocks.getInfo.mockResolvedValue({ title: 'Kanal', url: 'K', formats: [], entries: entries('a', 'b', 'c') });
    mocks.fetchHistory.mockResolvedValue([{ url: 'https://youtu.be/cxxxxxxxxxx' }]);
    mocks.settings = { subscriptions: [sub(['a'])] };

    expect(await checkSubscription(sub(['a']))).toBe(1);
    expect(mocks.getInfo).toHaveBeenCalledWith('https://www.youtube.com/@kanal', expect.objectContaining({ playlist: true }));
    const [pick] = useQueueStore.getState().playlistPicks;
    expect([...pick.fresh!]).toEqual(['https://www.youtube.com/watch?v=bxxxxxxxxxx']);

    useQueueStore.getState().dismissPlaylist(pick.taskId);
    await vi.waitFor(() => expect(mocks.saveSettings).toHaveBeenCalled());
    expect(mocks.settings.subscriptions![0].seen).toEqual(['yt:axxxxxxxxxx', 'yt:bxxxxxxxxxx', 'yt:cxxxxxxxxxx']);
  });

  it('yeni video yoksa pencere acmaz; acilista yalnizca suresi gelenleri kontrol eder', async () => {
    mocks.getInfo.mockResolvedValue({ title: 'Kanal', url: 'K', formats: [], entries: entries('a') });
    mocks.settings = { subscriptions: [sub(['a'], Date.now()), { ...sub(['a']), id: 's2' }] };
    await checkDueSubscriptions();
    expect(mocks.getInfo).toHaveBeenCalledTimes(1);
    expect(useQueueStore.getState().playlistPicks).toEqual([]);

    mocks.settings.checkSubscriptionsOnStart = false;
    await checkDueSubscriptions();
    expect(mocks.getInfo).toHaveBeenCalledTimes(1);
  });
});
