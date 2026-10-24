import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, Task, VideoFormat } from '../types';
import { getSettings } from './settingsCache';
import { appApi } from '../lib/appApi';

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

export function useQueueState() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Bağımlılıklar kontrol ediliyor...');
  const [queue, setQueue] = useState<Task[]>([]);
  const [downloadDir, setDownloadDir] = useState<string>('');
  const [depsReady, setDepsReady] = useState(false);
  const settingsRef = useRef<AppSettings | null>(null);

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

    void appApi.onQueueProgress((data) => {
      const selectedFormatId = data.status === 'ready-to-select' && data.formats
        ? pickDefaultFormat(data.formats, settingsRef.current)
        : undefined;
      setQueue((prev) => prev.map((t) => {
        // Kullanici iptal ettiyse geciken analiz sonucu karti geri acmasin.
        if (t.id !== data.id || t.status === 'cancelled') return t;
        return selectedFormatId ? { ...t, ...data, selectedFormatId } : { ...t, ...data };
      }));
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

    try {
      await appApi.addToQueue({ id, url });
    } catch {
      setQueue((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: 'error' as const, message: 'Analiz başlatılamadı.' } : t
      ));
    }
  }, [url, refreshDownloadDir]);

  const handleFormatChange = useCallback((taskId: string, formatId: string) => {
    setQueue((prev) => prev.map((t) => t.id === taskId ? { ...t, selectedFormatId: formatId } : t));
  }, []);

  const handleStartDownload = useCallback(async (task: Task) => {
    const fId = task.selectedFormatId || task.formats?.[0]?.formatId;
    if (!fId) return;

    setQueue((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'downloading', selectedFormatId: fId } : t));

    try {
      await appApi.startDownloadTask({ id: task.id, url: task.url, formatId: fId });
    } catch {
      setQueue((prev) => prev.map((t) =>
        t.id === task.id ? { ...t, status: 'error' as const, message: 'İndirme başlatılamadı.' } : t
      ));
    }
  }, []);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const res = await appApi.selectDownloadFolder();
      if (res?.success && res.path) setDownloadDir(res.path);
    } catch {
      // user cancelled or dialog failed
    }
  }, []);

  const handleCancel = useCallback(async (taskId: string) => {
    // Indirme surecini backend sonlandirip "cancelled" bildirir; digerlerinin sureci yok.
    setQueue((prev) => prev.map((t) =>
      t.id === taskId && t.status !== 'downloading' ? { ...t, status: 'cancelled' as const } : t
    ));
    try {
      await appApi.cancelTask(taskId);
    } catch {
      // IPC failed
    }
  }, []);

  const handleRetry = useCallback(async (task: Task) => {
    setQueue((prev) => prev.map((t) =>
      t.id === task.id ? { ...t, status: 'analyzing', percent: 0, speed: '', eta: '', message: undefined } : t
    ));

    try {
      await appApi.addToQueue({ id: task.id, url: task.url });
    } catch {
      setQueue((prev) => prev.map((t) =>
        t.id === task.id ? { ...t, status: 'error', message: 'Tekrar deneme başlatılamadı.' } : t
      ));
    }
  }, []);

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
