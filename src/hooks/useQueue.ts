import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, Task, VideoFormat } from '../types';
import { getSettings } from './settingsCache';
import { appApi } from '../lib/appApi';
import { engine } from '../engine';
import { formatFilesize, optionLabel, parseOption } from '../engine/ytdlp';
import { createLimiter } from '../features/queue/limiter';

const MAX_CONCURRENT_DOWNLOADS = 2;
const downloadLimiter = createLimiter(MAX_CONCURRENT_DOWNLOADS);

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

// StrictMode efektleri iki kez calistirir; kurulum tek sefer yapilmali.
let dependencySetup: Promise<void> | null = null;

async function setupDependencies(setStatus: (msg: string) => void): Promise<void> {
  const deps = await appApi.checkDependencies();
  if (!deps.ytdlp) {
    const res = await appApi.installYtdlp();
    if (!res.success) throw new Error(res.error);
  }
  if (!deps.ffmpeg) {
    const res = await appApi.installFfmpeg();
    if (!res.success) throw new Error(res.error);
  }
  setStatus('Sistem hazır.');
}

function ensureDependencies(setStatus: (msg: string) => void): Promise<void> {
  if (!dependencySetup) {
    dependencySetup = setupDependencies(setStatus).catch((error) => {
      dependencySetup = null;
      throw error;
    });
  }
  return dependencySetup;
}

/** Ayarlardaki varsayilan format/kaliteye en yakin secenek. */
function pickDefaultFormat(formats: VideoFormat[], settings: AppSettings | null): string | undefined {
  if (settings?.defaultFormat === 'mp3') {
    return formats.find((f) => f.formatId === 'audio-mp3')?.formatId;
  }
  const maxHeight = Number(settings?.defaultQuality) || Infinity;
  const videos = formats.filter((f) => f.formatId.startsWith('video-'));
  return (videos.find((f) => (parseInt(f.resolution) || 0) <= maxHeight) ?? videos[videos.length - 1] ?? formats[0])?.formatId;
}

async function saveHistory(task: Task, formatId: string, filePath: string, size?: number) {
  const option = parseOption(formatId);
  const ext = filePath.split('.').pop() ?? '';
  await appApi.addHistoryItem({
    id: task.id,
    title: task.title,
    url: task.url,
    thumbnail: task.thumbnail,
    formatId,
    quality: option ? optionLabel(option) : '',
    ext,
    fileSize: size != null ? formatFilesize(size) : '',
    filePath,
    completedAt: String(Math.floor(Date.now() / 1000)),
  });
}

export function useQueueState() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Bağımlılıklar kontrol ediliyor...');
  const [queue, setQueue] = useState<Task[]>([]);
  const [downloadDir, setDownloadDir] = useState<string>('');
  const [depsReady, setDepsReady] = useState(false);
  const settingsRef = useRef<AppSettings | null>(null);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    // Kullanici iptal ettiyse geciken sonuc karti geri acmasin.
    setQueue((prev) => prev.map((t) => t.id === id && t.status !== 'cancelled' ? { ...t, ...patch } : t));
  }, []);

  const refreshDownloadDir = useCallback(() => {
    getSettings().then((s) => {
      settingsRef.current = s;
      setDownloadDir(s.downloadDir || 'Varsayılan');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshDownloadDir();

    const unsubscribers: Array<() => void> = [];

    void appApi.onStatusUpdate((msg) => {
      setStatus(msg);
      refreshDownloadDir();
    }).then((unsub) => unsubscribers.push(unsub));

    ensureDependencies(setStatus)
      .then(() => setDepsReady(true))
      .catch((error) => setStatus(`Kurulum hatası: ${error instanceof Error ? error.message : String(error)}`));

    void appApi.onClipboardLink((link) => {
      setUrl(link);
    }).then((unsub) => unsubscribers.push(unsub));

    void appApi.startClipboardMonitor();

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      void appApi.stopClipboardMonitor();
    };
  }, [refreshDownloadDir]);

  const analyze = useCallback(async (id: string, taskUrl: string) => {
    try {
      const info = await engine.getInfo(taskUrl);
      updateTask(id, {
        status: 'ready-to-select',
        title: info.title,
        thumbnail: info.thumbnail,
        formats: info.formats,
        selectedFormatId: pickDefaultFormat(info.formats, settingsRef.current),
      });
    } catch (error) {
      updateTask(id, { status: 'error', message: errorMessage(error) });
    }
  }, [updateTask]);

  const handleAnalyze = useCallback(async () => {
    if (!url) return;

    const id = Date.now().toString();
    // Ayarlarda degisen varsayilan format/klasor bu analizde kullanilsin.
    refreshDownloadDir();

    setQueue((prev) => [{
      id,
      url,
      title: 'Video kaynakları analiz ediliyor...',
      percent: 0,
      speed: '',
      eta: '',
      status: 'analyzing',
    }, ...prev]);

    setUrl('');
    await analyze(id, url);
  }, [url, refreshDownloadDir, analyze]);

  const handleFormatChange = useCallback((taskId: string, formatId: string) => {
    setQueue((prev) => prev.map((t) => t.id === taskId ? { ...t, selectedFormatId: formatId } : t));
  }, []);

  const handleStartDownload = useCallback(async (task: Task) => {
    const fId = task.selectedFormatId || task.formats?.[0]?.formatId;
    if (!fId) return;

    setQueue((prev) => prev.map((t) => t.id === task.id
      ? { ...t, status: 'downloading', selectedFormatId: fId, percent: 0, speed: '', eta: '', message: 'Sırada bekliyor...' }
      : t));

    try {
      const settings = await getSettings();
      const outDir = settings.downloadDir || await appApi.getDownloadFolder();
      const result = await downloadLimiter.run(task.id, () => {
        updateTask(task.id, { message: undefined });
        return engine.download(
          { id: task.id, url: task.url, formatId: fId, outDir, subtitles: settings.downloadSubtitles ?? false },
          (p) => updateTask(task.id, { percent: p.percent, speed: p.speed, eta: p.eta }),
        );
      });

      if (result === null || result.status === 'cancelled') {
        setQueue((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'cancelled', message: undefined } : t));
      } else if (result.status === 'error') {
        updateTask(task.id, { status: 'error', message: result.message });
      } else {
        updateTask(task.id, { status: 'complete', percent: 100 });
        await saveHistory(task, fId, result.filePath, result.fileSize);
        if (settings.autoOpenFolder ?? true) void appApi.openFileLocation(result.filePath);
      }
    } catch (error) {
      updateTask(task.id, { status: 'error', message: errorMessage(error) });
    }
  }, [updateTask]);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const res = await appApi.selectDownloadFolder();
      if (res?.success && res.path) setDownloadDir(res.path);
    } catch {
      // user cancelled or dialog failed
    }
  }, []);

  const handleCancel = useCallback(async (taskId: string) => {
    // Calisan indirmeyi motor sonlandirir ve handleStartDownload "cancelled" yapar;
    // siradaki ya da indirme disindaki isler burada hemen iptal edilir.
    if (downloadLimiter.dequeue(taskId)) return;
    setQueue((prev) => prev.map((t) =>
      t.id === taskId && t.status !== 'downloading' ? { ...t, status: 'cancelled' as const } : t
    ));
    try {
      await engine.cancel(taskId);
    } catch (error) {
      console.warn('İptal başarısız:', error);
    }
  }, []);

  const handleRetry = useCallback(async (task: Task) => {
    setQueue((prev) => prev.map((t) =>
      t.id === task.id ? { ...t, status: 'analyzing', percent: 0, speed: '', eta: '', message: undefined } : t
    ));

    await analyze(task.id, task.url);
  }, [analyze]);

  const moveTask = useCallback((taskId: string, direction: 'up' | 'down') => {
    setQueue((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }, []);

  const isWorking = queue.some((t) => t.status === 'analyzing' || t.status === 'downloading');

  return { url, setUrl, queue, status, downloadDir, depsReady, handleAnalyze, handleFormatChange, handleStartDownload, handleBrowseFolder, handleCancel, handleRetry, moveTask, isWorking };
}
