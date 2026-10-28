// Kuyruk uygulama kapaninca kaybolmasin diye webview localStorage'inda tutulur.
// Bitenler zaten gecmiste oldugu icin saklanmaz.

import type { Task } from '../../types';
import { msg } from '../../i18n';

const KEY = 'vidra.queue.v1';
const SAVE_DELAY_MS = 500;


/** Kapanista yarida kalan gorevleri yeniden baslatilabilir duruma getirir. */
export function restoreTasks(saved: Task[]): Task[] {
  return saved
    .filter((t) => t.status !== 'complete')
    .map((t): Task => {
      if (t.status === 'queued' || t.status === 'downloading') {
        // yt-dlp `.part` dosyasindan devam eder (varsayilan --continue). Bilesenler hazir olunca
        // bootstrap kendiliginden baslatir; olmazsa kullanici Indir ile surdurur.
        return { ...t, status: 'ready-to-select', resume: true, percent: 0, speed: '', eta: '', message: msg().queue.interrupted };
      }
      if (t.status === 'analyzing') {
        return { ...t, status: 'error', title: t.url, message: msg().queue.analysisInterrupted };
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
