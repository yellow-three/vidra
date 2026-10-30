import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { countByFilter, filterTasks } from './queueFilter';

const task = (id: string, status: Task['status'], title: string, playlist?: string): Task =>
  ({ id, url: `https://v.test/${id}`, title, status, percent: 0, speed: '', eta: '', playlist });

const tasks = [
  task('a', 'downloading', 'İstanbul gezisi'),
  task('b', 'paused', 'Kedi videosu', 'Hayvanlar'),
  task('c', 'complete', 'Köpek'),
  task('d', 'cancelled', 'Kuş'),
  task('e', 'error', 'Bozuk'),
];

describe('filterTasks', () => {
  it('durum grubuna gore suzer', () => {
    expect(filterTasks(tasks, 'pending', '').map((t) => t.id)).toEqual(['b']);
    expect(filterTasks(tasks, 'complete', '').map((t) => t.id)).toEqual(['c', 'd']);
    expect(countByFilter(tasks, 'all')).toBe(5);
  });

  it('baslik, link ve liste adinda Turkce buyuk/kucuk harfe duyarsiz arar', () => {
    expect(filterTasks(tasks, 'all', 'istanbul').map((t) => t.id)).toEqual(['a']);
    expect(filterTasks(tasks, 'all', 'HAYVAN').map((t) => t.id)).toEqual(['b']);
    expect(filterTasks(tasks, 'all', 'v.test/e').map((t) => t.id)).toEqual(['e']);
    expect(filterTasks(tasks, 'error', 'kedi')).toEqual([]);
  });
});
