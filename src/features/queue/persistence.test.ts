import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import tr from '../../i18n/tr';
import { restoreTasks } from './persistence';

const base = { url: 'U', title: 'T', percent: 40, speed: '1 MB/s', eta: '00:10' };

describe('restoreTasks', () => {
  it('yarida kalan indirmeleri devam ettirilebilir yapar, bitenleri atar', () => {
    const saved: Task[] = [
      { ...base, id: '1', status: 'downloading', selectedFormatId: 'video-720' },
      { ...base, id: '2', status: 'queued' },
      { ...base, id: '3', status: 'complete' },
      { ...base, id: '4', status: 'analyzing' },
      { ...base, id: '5', status: 'error', message: 'x' },
    ];
    const restored = restoreTasks(saved);
    expect(restored.map((t) => [t.id, t.status])).toEqual([
      ['1', 'ready-to-select'], ['2', 'ready-to-select'], ['4', 'error'], ['5', 'error'],
    ]);
    expect(restored[0]).toMatchObject({ percent: 0, speed: '', selectedFormatId: 'video-720', resume: true, message: tr.queue.interrupted });
    expect(restored[1].resume).toBe(true);
    expect(restored[3].resume).toBeUndefined();
    expect(restored[3].message).toBe('x');
  });
});
