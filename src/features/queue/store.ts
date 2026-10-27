// Indirme kuyrugu: tek kaynak Zustand store'u. Sayfa degisince kaybolmaz,
// React disindan (pano izleyici, testler) da kullanilabilir.

import { create } from 'zustand';
import { engine } from '../../engine';
import { EngineError } from '../../engine/errors';
import type { InfoOptions, NetworkOptions, VideoInfo } from '../../engine/types';
import { formatFilesize, optionLabel, parseOption } from '../../engine/ytdlp';
import { appApi } from '../../lib/appApi';
import type { AppSettings, Task } from '../../types';
import { addHistory } from '../history/queries';
import { fetchSettings } from '../settings/queries';
import { pickDefaultFormat } from './defaultFormat';
import { createLimiter } from './limiter';
import { notifyComplete } from './notify';
import { loadTasks, saveTasks } from './persistence';

export const DEFAULT_CONCURRENT_DOWNLOADS = 2;
const limiter = createLimiter(DEFAULT_CONCURRENT_DOWNLOADS);

const errorFields = (error: unknown): Pick<Task, 'message' | 'detail'> => ({
  message: error instanceof Error ? error.message : String(error),
  detail: error instanceof EngineError ? error.detail : undefined,
});

const networkOptions = (s: AppSettings | null): NetworkOptions => ({
  cookiesFromBrowser: s?.cookiesFromBrowser || undefined,
  proxy: s?.proxy?.trim() || undefined,
});

interface QueueState {
  url: string;
  tasks: Task[];
  setUrl(url: string): void;
  /** URL kutusundaki linki analiz eder; olusan gorevin kimligini dondurur. */
  analyze(): Promise<string | null>;
  /** `watch?v=..&list=..` gorevini listenin tum videolariyla degistirir. */
  expandPlaylist(id: string): Promise<void>;
  selectFormat(id: string, formatId: string): void;
  startDownload(id: string): Promise<void>;
  /** Format secimini bekleyen tum gorevleri listedeki sirayla kuyruga alir. */
  startAll(): Promise<void>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  move(id: string, direction: 'up' | 'down'): void;
  /** Tamamlanan ve iptal edilen gorevleri listeden kaldirir. */
  clearFinished(): void;
}

let lastId = 0;
/** Zamana dayali kimlik; ayni milisaniyede eklenen gorevler (testler, hizli yapistirma) cakismaz. */
function newId(): string {
  lastId = Math.max(Date.now(), lastId + 1);
  return String(lastId);
}

const isActive = (t: Task) => t.status === 'queued' || t.status === 'downloading';

export const useQueueStore = create<QueueState>()((set, get) => {
  /** Iptal edilmis gorevler gec gelen sonuclarla geri acilmaz. */
  const update = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && t.status !== 'cancelled' ? { ...t, ...patch } : t)) }));
  const force = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const find = (id: string) => get().tasks.find((t) => t.id === id);

  /** Liste analizinin yer tutucusunu, listedeki videolarla ayni yerde degistirir. */
  function replaceWithEntries(id: string, info: VideoInfo, settings: AppSettings | null) {
    const entries = info.entries ?? [];
    if (entries.length === 0) {
      update(id, { status: 'error', title: info.title, message: 'Listede indirilebilir video yok.' });
      return;
    }
    const selectedFormatId = pickDefaultFormat(info.formats, settings);
    const tasks: Task[] = entries.map((e) => ({
      id: newId(),
      url: e.url,
      title: e.title,
      thumbnail: e.thumbnail,
      playlist: info.title,
      formats: info.formats,
      selectedFormatId,
      percent: 0,
      speed: '',
      eta: '',
      status: 'ready-to-select',
    }));
    set((s) => ({
      tasks: s.tasks.flatMap((t) => (t.id === id && t.status !== 'cancelled' ? tasks : [t])),
    }));
  }

  async function runAnalysis(id: string, url: string, options: Pick<InfoOptions, 'playlist'> = {}) {
    try {
      const settings = await fetchSettings().catch(() => null);
      const info = await engine.getInfo(url, { ...networkOptions(settings), ...options });
      if (info.entries) {
        replaceWithEntries(id, info, settings);
        return;
      }
      update(id, {
        status: 'ready-to-select',
        title: info.title,
        thumbnail: info.thumbnail,
        formats: info.formats,
        selectedFormatId: pickDefaultFormat(info.formats, settings),
        message: undefined,
        detail: undefined,
      });
    } catch (error) {
      update(id, { status: 'error', ...errorFields(error) });
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
    tasks: loadTasks(),

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

    async expandPlaylist(id) {
      const task = find(id);
      if (!task) return;
      force(id, { status: 'analyzing', title: 'Oynatma listesi analiz ediliyor...', message: undefined, detail: undefined });
      await runAnalysis(id, task.url, { playlist: true });
    },

    selectFormat: (id, formatId) => update(id, { selectedFormatId: formatId }),

    async startDownload(id) {
      const task = find(id);
      const formatId = task?.selectedFormatId || task?.formats?.[0]?.formatId;
      if (!task || !formatId) return;
      force(id, { status: 'queued', selectedFormatId: formatId, percent: 0, speed: '', eta: '', message: undefined, detail: undefined });

      try {
        const settings = await fetchSettings();
        const outDir = settings.downloadDir || (await appApi.getDownloadFolder());
        limiter.setMax(settings.maxConcurrentDownloads ?? DEFAULT_CONCURRENT_DOWNLOADS);
        const result = await limiter.run(id, async () => {
          // Ayarlar okunurken iptal edildiyse hic baslama.
          if (find(id)?.status === 'cancelled') return { status: 'cancelled' } as const;
          update(id, { status: 'downloading' });
          return engine.download(
            {
              id,
              url: task.url,
              formatId,
              outDir,
              subtitles: settings.downloadSubtitles ?? false,
              embedMetadata: settings.embedMetadata ?? true,
              filenameTemplate: settings.filenameTemplate,
              rateLimit: settings.rateLimit || undefined,
              ...networkOptions(settings),
            },
            (p) => update(id, { percent: p.percent, speed: p.speed, eta: p.eta }),
          );
        });

        if (result === null || result.status === 'cancelled') {
          force(id, { status: 'cancelled', message: undefined });
        } else if (result.status === 'error') {
          update(id, { status: 'error', message: result.message, detail: result.detail });
        } else {
          update(id, { status: 'complete', percent: 100 });
          await saveCompleted(find(id) ?? task, formatId, result.filePath, result.fileSize);
          notifyComplete(task.title);
          if (settings.autoOpenFolder ?? true) void appApi.openFileLocation(result.filePath);
        }
      } catch (error) {
        update(id, { status: 'error', ...errorFields(error) });
      }
    },

    async startAll() {
      const ready = get().tasks.filter((t) => t.status === 'ready-to-select');
      await Promise.all(ready.map((t) => get().startDownload(t.id)));
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
      force(id, { status: 'analyzing', percent: 0, speed: '', eta: '', message: undefined, detail: undefined });
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
      // Siradaki indirmeler listedeki yeni siralariyla baslar.
      limiter.reorder(get().tasks.map((t) => t.id));
    },

    clearFinished: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== 'complete' && t.status !== 'cancelled') })),
  };
});

useQueueStore.subscribe((s) => saveTasks(s.tasks));

/** Kapanis uyarisi icin: suren ya da siradaki indirme var mi. */
export const hasActiveDownloads = () => useQueueStore.getState().tasks.some(isActive);
