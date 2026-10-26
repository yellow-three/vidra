// Indirme kuyrugu: tek kaynak Zustand store'u. Sayfa degisince kaybolmaz,
// React disindan (pano izleyici, testler) da kullanilabilir.

import { create } from 'zustand';
import { engine } from '../../engine';
import { formatFilesize, optionLabel, parseOption } from '../../engine/ytdlp';
import { appApi } from '../../lib/appApi';
import type { Task } from '../../types';
import { addHistory } from '../history/queries';
import { fetchSettings } from '../settings/queries';
import { pickDefaultFormat } from './defaultFormat';
import { createLimiter } from './limiter';
import { notifyComplete } from './notify';

export const MAX_CONCURRENT_DOWNLOADS = 2;
const limiter = createLimiter(MAX_CONCURRENT_DOWNLOADS);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface QueueState {
  url: string;
  tasks: Task[];
  setUrl(url: string): void;
  /** URL kutusundaki linki analiz eder; olusan gorevin kimligini dondurur. */
  analyze(): Promise<string | null>;
  selectFormat(id: string, formatId: string): void;
  startDownload(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  move(id: string, direction: 'up' | 'down'): void;
}

let lastId = 0;
/** Zamana dayali kimlik; ayni milisaniyede eklenen gorevler (testler, hizli yapistirma) cakismaz. */
function newId(): string {
  lastId = Math.max(Date.now(), lastId + 1);
  return String(lastId);
}

export const useQueueStore = create<QueueState>()((set, get) => {
  /** Iptal edilmis gorevler gec gelen sonuclarla geri acilmaz. */
  const update = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && t.status !== 'cancelled' ? { ...t, ...patch } : t)) }));
  const force = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const find = (id: string) => get().tasks.find((t) => t.id === id);

  async function runAnalysis(id: string, url: string) {
    try {
      const [info, settings] = await Promise.all([engine.getInfo(url), fetchSettings().catch(() => null)]);
      update(id, {
        status: 'ready-to-select',
        title: info.title,
        thumbnail: info.thumbnail,
        formats: info.formats,
        selectedFormatId: pickDefaultFormat(info.formats, settings),
      });
    } catch (error) {
      update(id, { status: 'error', message: errorMessage(error) });
    }
  }

  async function saveCompleted(task: Task, formatId: string, filePath: string, size?: number) {
    const option = parseOption(formatId);
    await addHistory({
      id: task.id,
      title: task.title,
      url: task.url,
      thumbnail: task.thumbnail,
      formatId,
      quality: option ? optionLabel(option) : '',
      ext: filePath.split('.').pop() ?? '',
      fileSize: size != null ? formatFilesize(size) : '',
      filePath,
      completedAt: String(Math.floor(Date.now() / 1000)),
    });
  }

  return {
    url: '',
    tasks: [],

    setUrl: (url) => set({ url }),

    async analyze() {
      const url = get().url.trim();
      if (!url) return null;
      const id = newId();
      set((s) => ({
        url: '',
        tasks: [{ id, url, title: 'Video kaynakları analiz ediliyor...', percent: 0, speed: '', eta: '', status: 'analyzing' }, ...s.tasks],
      }));
      await runAnalysis(id, url);
      return id;
    },

    selectFormat: (id, formatId) => update(id, { selectedFormatId: formatId }),

    async startDownload(id) {
      const task = find(id);
      const formatId = task?.selectedFormatId ?? task?.formats?.[0]?.formatId;
      if (!task || !formatId) return;
      force(id, { status: 'downloading', selectedFormatId: formatId, percent: 0, speed: '', eta: '', message: 'Sırada bekliyor...' });

      try {
        const settings = await fetchSettings();
        const outDir = settings.downloadDir || (await appApi.getDownloadFolder());
        const result = await limiter.run(id, () => {
          update(id, { message: undefined });
          return engine.download(
            { id, url: task.url, formatId, outDir, subtitles: settings.downloadSubtitles ?? false },
            (p) => update(id, { percent: p.percent, speed: p.speed, eta: p.eta }),
          );
        });

        if (result === null || result.status === 'cancelled') {
          force(id, { status: 'cancelled', message: undefined });
        } else if (result.status === 'error') {
          update(id, { status: 'error', message: result.message });
        } else {
          update(id, { status: 'complete', percent: 100 });
          await saveCompleted(find(id) ?? task, formatId, result.filePath, result.fileSize);
          notifyComplete(task.title);
          if (settings.autoOpenFolder ?? true) void appApi.openFileLocation(result.filePath);
        }
      } catch (error) {
        update(id, { status: 'error', message: errorMessage(error) });
      }
    },

    async cancel(id) {
      // Siradaki is hic baslamaz.
      if (limiter.dequeue(id)) {
        force(id, { status: 'cancelled', message: undefined });
        return;
      }
      const task = find(id);
      if (task && task.status !== 'downloading') {
        force(id, { status: 'cancelled' });
        return;
      }
      // Calisan indirmeyi motor sonlandirir; startDownload sonucu "cancelled" olarak isler.
      try {
        await engine.cancel(id);
      } catch (error) {
        console.warn('İptal başarısız:', error);
      }
    },

    async retry(id) {
      const task = find(id);
      if (!task) return;
      force(id, { status: 'analyzing', percent: 0, speed: '', eta: '', message: undefined });
      await runAnalysis(id, task.url);
    },

    move(id, direction) {
      set((s) => {
        const idx = s.tasks.findIndex((t) => t.id === id);
        const next = direction === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || next < 0 || next >= s.tasks.length) return s;
        const tasks = [...s.tasks];
        [tasks[idx], tasks[next]] = [tasks[next], tasks[idx]];
        return { tasks };
      });
    },
  };
});
