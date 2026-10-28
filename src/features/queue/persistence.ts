// Kuyruk uygulama kapaninca kaybolmasin diye webview localStorage'inda tutulur.
// Bitenler zaten gecmiste oldugu icin saklanmaz.

import type { Task } from '../../types';

const KEY = 'vidra.queue.v1';
const SAVE_DELAY_MS = 500;

export const INTERRUPTED_MESSAGE = 'Uygulama kapandığında yarıda kaldı; İndir ile kaldığı yerden devam eder.';

/** Kapanista yarida kalan gorevleri yeniden baslatilabilir duruma getirir. */
export function restoreTasks(saved: Task[]): Task[] {
  return saved
    .filter((t) => t.status !== 'complete')
    .map((t): Task => {
      if (t.status === 'queued' || t.status === 'downloading') {
        // yt-dlp `.part` dosyasindan devam eder (varsayilan --continue).
        return { ...t, status: 'ready-to-select', percent: 0, speed: '', eta: '', message: INTERRUPTED_MESSAGE };
      }
      if (t.status === 'analyzing') {
        return { ...t, status: 'error', title: t.url, message: 'Analiz yarıda kaldı; tekrar deneyin.' };
      }
      return t;
    });
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? restoreTasks(JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Ilerleme her yuzde bir guncellenir; yazma ertelenip birlestirilir. */
export function saveTasks(tasks: Task[]): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks.filter((t) => t.status !== 'complete')));
    } catch {
      // localStorage yoksa (testler) ya da doluysa kuyruk yalnizca bu oturumda yasar.
    }
  }, SAVE_DELAY_MS);
}
