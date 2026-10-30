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
import { resolvePattern } from '../../engine/filename';
import { isHttpUrl, mergeClipboardLinks, splitUrls, videoKey, type ClipboardMode } from './duplicates';
import { createLimiter } from './limiter';
import { diskShortage } from './diskSpace';
import { notifyComplete } from './notify';
import { loadTasks, saveTasks } from './persistence';
import { msg } from '../../i18n';
import { log } from '../../lib/log';

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

/** Secim bekleyen oynatma listesi: analiz edildi, kullanici hangi videolarin eklenecegini secer. */
export interface PlaylistPick {
  taskId: string;
  info: VideoInfo;
  formatId: string | undefined;
  /** Gecmiste olan videolarin anahtarlari (videoKey); pencerede isaretli gelmez. */
  downloaded: Set<string>;
}

interface QueueState {
  url: string;
  tasks: Task[];
  playlistPicks: PlaylistPick[];
  /** Secilen videolari listenin yer tutucusunun yerine kuyruga ekler. */
  confirmPlaylist(taskId: string, urls: string[]): void;
  /** Liste eklenmez; yer tutucu kuyruktan kalkar. */
  dismissPlaylist(taskId: string): void;
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
  /** Bu video icin altyazi ve dosya adi; `undefined` ayardaki varsayilana doner. */
  setVideoOptions(id: string, options: Pick<Task, 'subtitles' | 'filenamePattern'>): void;
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

  /** Liste analizinin yer tutucusunu, kullanicinin sectigi videolarla ayni yerde degistirir. */
  function replaceWithEntries(id: string, pick: PlaylistPick, urls: Set<string>) {
    const { info, formatId, downloaded } = pick;
    const tasks: Task[] = (info.entries ?? []).filter((e) => urls.has(e.url)).map((e) => ({
      id: newId(),
      url: e.url,
      title: e.title,
      thumbnail: e.thumbnail,
      meta: e.meta,
      playlist: info.title,
      formats: info.formats,
      selectedFormatId: formatId,
      percent: 0,
      speed: '',
      eta: '',
      status: 'ready-to-select',
      message: downloaded.has(videoKey(e.url)) ? msg().queue.duplicateInHistory : undefined,
    }));
    set((s) => ({
      tasks: s.tasks.flatMap((t) => (t.id === id && t.status !== 'cancelled' ? tasks : [t])),
      playlistPicks: s.playlistPicks.filter((p) => p.taskId !== id),
    }));
  }

  /** Liste dogrudan kuyruga eklenmez: secim penceresi icin bekletilir (PlaylistPicker). */
  async function offerPlaylist(id: string, info: VideoInfo, settings: AppSettings | null) {
    if (!info.entries?.length) {
      update(id, { status: 'error', title: info.title, message: msg().queue.emptyPlaylist });
      return;
    }
    const downloaded = new Set((await fetchHistory().catch(() => [])).map((h) => videoKey(h.url)));
    update(id, { title: info.title });
    if (find(id)?.status === 'cancelled') return;
    const pick: PlaylistPick = { taskId: id, info, formatId: pickDefaultFormat(info.formats, settings), downloaded };
    set((s) => ({ playlistPicks: [...s.playlistPicks, pick] }));
  }

  async function runAnalysis(id: string, url: string, options: Pick<InfoOptions, 'playlist'> = {}) {
    try {
      const settings = await fetchSettings().catch(() => null);
      const info = await engine.getInfo(url, { ...networkOptions(settings), ...options });
      if (info.entries) {
        await offerPlaylist(id, info, settings);
        return;
      }
      const message = await duplicateMessage(id, url);
      update(id, {
        status: 'ready-to-select',
        title: info.title,
        thumbnail: info.thumbnail,
        meta: info.meta,
        formats: info.formats,
        selectedFormatId: pickDefaultFormat(info.formats, settings),
        message,
        detail: undefined,
      });
    } catch (error) {
      const fields = errorFields(error);
      log.warn(`Analiz hatası ${url}: ${fields.message}${fields.detail ? `\n${fields.detail}` : ''}`);
      update(id, { status: 'error', ...fields });
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
    playlistPicks: [],

    confirmPlaylist(taskId, urls) {
      const pick = get().playlistPicks.find((p) => p.taskId === taskId);
      if (!pick) return;
      if (urls.length === 0) {
        get().dismissPlaylist(taskId);
        return;
      }
      replaceWithEntries(taskId, pick, new Set(urls));
    },

    dismissPlaylist: (taskId) => set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== taskId),
      playlistPicks: s.playlistPicks.filter((p) => p.taskId !== taskId),
    })),

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

    setVideoOptions: (id, options) => update(id, options),

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
          log.info(`İndirme başladı ${task.url} (${formatId})`);
          return engine.download(
            {
              id,
              url: task.url,
              formatId,
              outDir,
              subtitles: task.subtitles ?? settings.downloadSubtitles ?? false,
              subtitleLangs: settings.subtitleLangs,
              subfolder: (settings.playlistSubfolder ?? true) ? task.playlist : undefined,
              section: task.section,
              sponsorBlock: settings.sponsorBlock,
              embedMetadata: settings.embedMetadata ?? true,
              filenamePattern: task.filenamePattern ?? resolvePattern(settings.filenameTemplate, settings.filenameCustom),
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
          log.info(`İndirme duraklatıldı ${task.url}`);
          force(id, { status: 'paused', speed: '', eta: '', partial: { destination: result.destination, since: result.startedMs } });
        } else if (result.status === 'cancelled') {
          log.info(`İndirme iptal edildi ${task.url}`);
          force(id, { status: 'cancelled', message: undefined, partial: undefined });
        } else if (result.status === 'error') {
          log.error(`İndirme hatası ${task.url} (${formatId}): ${result.message}${result.detail ? `\n${result.detail}` : ''}`);
          update(id, { status: 'error', message: result.message, detail: result.detail });
        } else {
          log.info(`İndirme tamamlandı ${task.url}: ${result.filePath}`);
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
        set((s) => ({ playlistPicks: s.playlistPicks.filter((p) => p.taskId !== id) }));
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
