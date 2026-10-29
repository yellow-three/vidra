// Indirme kuyrugu: tek kaynak Zustand store'u. Sayfa degisince kaybolmaz,
// React disindan (pano izleyici, testler) da kullanilabilir.

import { create } from 'zustand';
import { engine } from '../../engine';
import { EngineError } from '../../engine/errors';
import type { DownloadResult, InfoOptions, NetworkOptions, TimeRange, VideoInfo } from '../../engine/types';
import { formatFilesize, optionLabel, parseOption } from '../../engine/ytdlp';
import { appApi } from '../../lib/appApi';
import type { AppSettings, Task } from '../../types';
import { addHistory, fetchHistory } from '../history/queries';
import { fetchSettings } from '../settings/queries';
import { pickDefaultFormat } from './defaultFormat';
import { isHttpUrl, mergeClipboardLinks, splitUrls, videoKey, type ClipboardMode } from './duplicates';
import { createLimiter } from './limiter';
import { diskShortage } from './diskSpace';
import { notifyComplete } from './notify';
import { loadTasks, saveTasks } from './persistence';
import { msg } from '../../i18n';

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
  /**
   * URL kutusundaki linkleri (birden fazla olabilir) analiz eder; ilk gorevin kimligini dondurur.
   * Link olmayan parcalar kutuda birakilir.
   */
  analyze(): Promise<string | null>;
  /** Panoda yakalanan metnin linklerini kutuya ekler. */
  addClipboardText(text: string, mode?: ClipboardMode): void;
  /** Uygulama kapanirken suren ya da siradaki indirmeleri yeniden baslatir. */
  resumeInterrupted(): Promise<void>;
  /** `watch?v=..&list=..` gorevini listenin tum videolariyla degistirir. */
  expandPlaylist(id: string): Promise<void>;
  selectFormat(id: string, formatId: string): void;
  /** Yalnizca bir araligi indirmek icin; `undefined` tum videoyu secer. */
  setSection(id: string, section: TimeRange | undefined): void;
  startDownload(id: string): Promise<void>;
  /** Format secimini bekleyen tum gorevleri listedeki sirayla kuyruga alir. */
  startAll(): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Siradaki ya da suren indirmeyi durdurur; yarim dosya kalir. */
  pause(id: string): Promise<void>;
  /** Duraklatilan indirmeyi kaldigi yerden surdurur. */
  resume(id: string): Promise<void>;
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


/** Bir arada baslatilan indirmeler bitince tek bildirim: 50 videoluk listede her dosya icin bildirim gitmesin. */
interface Batch {
  count: number;
  lastTitle: string;
}
let batch: Batch = { count: 0, lastTitle: '' };

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
    if (inQueue) return msg().queue.duplicateInQueue;
    const history = await fetchHistory().catch(() => []);
    return history.some((h) => videoKey(h.url) === key) ? msg().queue.duplicateInHistory : undefined;
  }

  /** Liste analizinin yer tutucusunu, listedeki videolarla ayni yerde degistirir. */
  async function replaceWithEntries(id: string, info: VideoInfo, settings: AppSettings | null) {
    const entries = info.entries ?? [];
    if (entries.length === 0) {
      update(id, { status: 'error', title: info.title, message: msg().queue.emptyPlaylist });
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
      message: downloaded.has(videoKey(e.url)) ? msg().queue.duplicateInHistory : undefined,
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

  /** Son indirme de bitince toplu bildirim; hata/iptal de topluluk icindedir. */
  function finishBatchIfIdle() {
    if (get().tasks.some(isActive) || batch.count === 0) return;
    const done = batch;
    batch = { count: 0, lastTitle: '' };
    notifyComplete(done.count === 1 ? done.lastTitle : msg().notify.batch(done.count));
  }

  return {
    url: '',
    tasks: loadTasks(),

    setUrl: (url) => set({ url }),

    addClipboardText: (text, mode) => set((s) => ({ url: mergeClipboardLinks(s.url, text, mode) })),

    async resumeInterrupted() {
      const interrupted = get().tasks.filter((t) => t.resume && t.status === 'ready-to-select');
      await Promise.all(interrupted.map((t) => get().startDownload(t.id)));
    },

    async analyze() {
      const parts = splitUrls(get().url);
      const urls = parts.filter(isHttpUrl);
      const rest = parts.filter((p) => !isHttpUrl(p)).join(' ');
      if (urls.length === 0) {
        set({ url: rest });
        return null;
      }
      const added: Task[] = urls.map((url) => ({
        id: newId(), url, title: msg().queue.analyzingTitle, percent: 0, speed: '', eta: '', status: 'analyzing',
      }));
      set((s) => ({ url: rest, tasks: [...added, ...s.tasks] }));
      // Sirayla: ayni anda onlarca yt-dlp acilmaz, tekrar uyarisi da onceki linkleri gorur.
      for (const t of added) await runAnalysis(t.id, t.url);
      return added[0].id;
    },

    async expandPlaylist(id) {
      const task = find(id);
      if (!task) return;
      force(id, { status: 'analyzing', title: msg().queue.analyzingPlaylist, message: undefined, detail: undefined });
      await runAnalysis(id, task.url, { playlist: true });
    },

    selectFormat: (id, formatId) => update(id, { selectedFormatId: formatId }),

    setSection: (id, section) => update(id, { section }),

    async startDownload(id) {
      const task = find(id);
      const formatId = task?.selectedFormatId || task?.formats?.[0]?.formatId;
      if (!task || !formatId) return;
      // Surdurulen indirme yuzdesini korur; yt-dlp kaldigi yerden raporlar.
      const percent = task.status === 'paused' ? task.percent : 0;
      force(id, { status: 'queued', selectedFormatId: formatId, resume: undefined, percent, speed: '', eta: '', message: undefined, detail: undefined });

      try {
        const settings = await fetchSettings();
        const outDir = settings.downloadDir || (await appApi.getDownloadFolder());
        limiter.setMax(settings.maxConcurrentDownloads ?? DEFAULT_CONCURRENT_DOWNLOADS);
        const result = await limiter.run(id, async () => {
          // Ayarlar okunurken iptal edildiyse hic baslama.
          if (find(id)?.status === 'cancelled') return { status: 'cancelled' } as const;
          // Sira gelince olculur: bekleyen indirmeler arasinda baskalari diski doldurmus olabilir.
          const bytes = task.formats?.find((f) => f.formatId === formatId)?.bytes;
          const shortage = diskShortage(await appApi.freeSpace(outDir).catch(() => null), bytes);
          if (shortage) return { status: 'error', message: shortage } satisfies DownloadResult;
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
              sponsorBlock: settings.sponsorBlock,
              embedMetadata: settings.embedMetadata ?? true,
              filenameTemplate: settings.filenameTemplate,
              rateLimit: settings.rateLimit || undefined,
              partialSince: task.partial?.since,
              ...networkOptions(settings),
            },
            (p) => update(id, { percent: p.percent, speed: p.speed, eta: p.eta }),
          );
        });

        if (result === null) {
          // Siradayken duraklatildi ya da iptal edildi; durumu pause/cancel yazdi.
        } else if (result.status === 'paused') {
          force(id, { status: 'paused', speed: '', eta: '', partial: { destination: result.destination, since: result.startedMs } });
        } else if (result.status === 'cancelled') {
          force(id, { status: 'cancelled', message: undefined, partial: undefined });
        } else if (result.status === 'error') {
          update(id, { status: 'error', message: result.message, detail: result.detail });
        } else {
          update(id, { status: 'complete', percent: 100, filePath: result.filePath, partial: undefined });
          batch = { count: batch.count + 1, lastTitle: task.title };
          await saveCompleted(find(id) ?? task, formatId, result.filePath, result.fileSize);
        }
        finishBatchIfIdle();
      } catch (error) {
        update(id, { status: 'error', ...errorFields(error) });
      }
    },

    async startAll() {
      const ready = get().tasks.filter((t) => t.status === 'ready-to-select');
      await Promise.all(ready.map((t) => get().startDownload(t.id)));
    },

    async cancel(id) {
      const task = find(id);
      // Siradaki is hic baslamaz.
      if (limiter.dequeue(id)) {
        force(id, { status: 'cancelled', message: undefined });
        if (task?.partial) void engine.discardPartial(task.partial.destination, task.partial.since);
        return;
      }
      if (task && task.status !== 'downloading') {
        force(id, { status: 'cancelled', partial: undefined });
        if (task.partial) void engine.discardPartial(task.partial.destination, task.partial.since);
        return;
      }
      // Calisan indirmeyi motor sonlandirir; startDownload sonucu "cancelled" olarak isler.
      try {
        await engine.cancel(id);
      } catch (error) {
        console.warn('İptal başarısız:', error);
      }
    },

    async pause(id) {
      if (limiter.dequeue(id)) {
        force(id, { status: 'paused', speed: '', eta: '' });
        return;
      }
      if (find(id)?.status === 'downloading') await engine.pause(id);
    },

    resume: (id) => get().startDownload(id),

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
