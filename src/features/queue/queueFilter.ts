// Indirme sayfasindaki arama ve durum filtresi (uzun listelerde aradigini bulmak icin).

import type { Task, TaskStatus } from '../../types';

export type QueueFilter = 'all' | 'pending' | 'downloading' | 'complete' | 'error';

const GROUPS: Record<Exclude<QueueFilter, 'all'>, TaskStatus[]> = {
  pending: ['analyzing', 'ready-to-select', 'queued', 'paused'],
  downloading: ['downloading'],
  complete: ['complete', 'cancelled'],
  error: ['error'],
};

export const matchesFilter = (task: Task, filter: QueueFilter) => filter === 'all' || GROUPS[filter].includes(task.status);

export const countByFilter = (tasks: Task[], filter: QueueFilter) => tasks.filter((t) => matchesFilter(t, filter)).length;

/** Baslikta, linkte ya da liste adinda gecen metin; buyuk/kucuk harf ve Turkce I/i farki gozetilmez. */
export function filterTasks(tasks: Task[], filter: QueueFilter, query: string, locale = 'tr'): Task[] {
  const q = query.trim().toLocaleLowerCase(locale);
  return tasks.filter((t) =>
    matchesFilter(t, filter)
    && (!q || [t.title, t.url, t.playlist ?? ''].some((text) => text.toLocaleLowerCase(locale).includes(q))));
}
