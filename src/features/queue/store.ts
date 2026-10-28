// Indirme kuyrugu: tek kaynak Zustand store'u. Sayfa degisince kaybolmaz,
// React disindan (pano izleyici, testler) da kullanilabilir.

import { create } from 'zustand';
import { engine } from '../../engine';
import { EngineError } from '../../engine/errors';
import type { InfoOptions, NetworkOptions, TimeRange, VideoInfo } from '../../engine/types';
import { formatFilesize, optionLabel, parseOption } from '../../engine/ytdlp';
import { appApi } from '../../lib/appApi';
import type { AppSettings, Task } from '../../types';
import { addHistory, fetchHistory } from '../history/queries';
import { fetchSettings } from '../settings/queries';
import { pickDefaultFormat } from './defaultFormat';
import { splitUrls, videoKey } from './duplicates';
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
  /** URL kutusundaki linkleri (birden fazla olabilir) analiz eder; ilk gorevin kimligini dondurur. */
  analyze(): Promise<string | null>;
  /** `watch?v=..&list=..` gorevini listenin tum videolariyla degistirir. */
  expandPlaylist(id: string): Promise<void>;
  selectFormat(id: string, formatId: string): void;
  /** Yalnizca bir araligi indirmek icin; `undefined` tum videoyu secer. */
  setSection(id: string, section: TimeRange | undefined): void;
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

export const DUPLICATE_IN_QUEUE = 'Bu video kuyrukta zaten var.';
export const DUPLICATE_IN_HISTORY = 'Bu video daha önce indirildi; Geçmiş sayfasında bulabilirsiniz.';

/**
 * Bir arada baslatilan indirmeler bitince tek bildirim ve tek klasor penceresi:
 * 50 videoluk listede her dosya icin pencere acilmasin.
 */
interface Batch {
  count: number;
  lastTitle: string;
  lastPath: string;
}
let batch: Batch = { count: 0, lastTitle: '', lastPath: '' };

export const useQueueStore = create<QueueState>()((set, get) => {
  /** Iptal edilmis gorevler gec gelen sonuclarla geri acilmaz. */
  const update = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && t.status !== 'cancelled' ? { ...t, ...patch } : t)) }));
  const force = (id: string, patch: Partial<Task>) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const find = (id: string) => get().tasks.find((t) => t.id === id);

  /** Kuyrukta ya da gecmiste ayni video varsa karta yazilacak uyari. */
  async function duplicateMessage(id: string, url: string): Promise<string | undefined> {
    const key = videoKey(url);
    const inQueue = get().tasks.some((t) => t.id !== id && t.status !== 'cancelled' && t.status !== 'error' && videoKey(t.url) === key);
    if (inQueue) return DUPLICATE_IN_QUEUE;
    const history = await fetchHistory().catch(() => []);
    return history.some((h) => videoKey(h.url) === key) ? DUPLICATE_IN_HISTORY : undefined;
  }

  /** Liste analizinin yer tutucusunu, listedeki videolarla ayni yerde degistirir. */
  async function replaceWithEntries(id: string, info: VideoInfo, settings: AppSettings | null) {
    const entries = info.entries ?? [];
    if (entries.length === 0) {
      update(id, { status: 'error', title: info.title, message: 'Listede indirilebilir video yok.' });
      return;
    }
    const selectedFormatId = pickDefaultFormat(info.formats, settings);
    const downloaded = new Set((await fetchHistory().catch(() => [])).map((h) => videoKey(h.url)));
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
      message: downloaded.has(videoKey(e.url)) ? DUPLICATE_IN_HISTORY : undefined,
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
        await replaceWithEntries(id, info, settings);
        return;
      }
      const message = await duplicateMessage(id, url);
      update(id, {
        status: 'ready-to-select',
        title: info.title,
        thumbnail: info.thumbnail,
        formats: info.formats,
        selectedFormatId: pickDefaultFormat(info.formats, settings),
        message,
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

  /** Son indirme de bitince toplu bildirim ve klasor; hata/iptal de topluluk icindedir. */
  function finishBatchIfIdle(autoOpenFolder: boolean) {
    if (get().tasks.some(isActive) || batch.count === 0) return;
    const done = batch;
    batch = { count: 0, lastTitle: '', lastPath: '' };
    notifyComplete(done.count === 1 ? done.lastTitle : `${done.count} indirme tamamlandı.`);
    if (autoOpenFolder) void appApi.openFileLocation(done.lastPath);
  }

  return {
    url: '',
    tasks: loadTasks(),

    setUrl: (url) => set({ url }),

    async analyze() {
      const urls = splitUrls(get().url);
      if (urls.length === 0) return null;
      const added: Task[] = urls.map((url) => ({
        id: newId(), url, title: 'Video kaynakları analiz ediliyor...', percent: 0, speed: '', eta: '', status: 'analyzing',
      }));
      set((s) => ({ url: '', tasks: [...added, ...s.tasks] }));
      // Sirayla: ayni anda onlarca yt-dlp acilmaz, tekrar uyarisi da onceki linkleri gorur.
      for (const t of added) await runAnalysis(t.id, t.url);
      return added[0].id;
    },

    async expandPlaylist(id) {
      const task = find(id);
      if (!task) return;
      force(id, { status: 'analyzing', title: 'Oynatma listesi analiz ediliyor...', message: undefined, detail: undefined });
      await runAnalysis(id, task.url, { playlist: true });
    },

    selectFormat: (id, formatId) => update(id, { selectedFormatId: formatId }),

    setSection: (id, section) => update(id, { section }),

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
              subtitleLangs: settings.subtitleLangs,
              subfolder: (settings.playlistSubfolder ?? true) ? task.playlist : undefined,
              section: task.section,
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
          batch = { count: batch.count + 1, lastTitle: task.title, lastPath: result.filePath };
          await saveCompleted(find(id) ?? task, formatId, result.filePath, result.fileSize);
        }
        finishBatchIfIdle(settings.autoOpenFolder ?? true);
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
