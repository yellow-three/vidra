import { useState, useEffect, useCallback } from 'react';
import type { Task } from '../types';
import { getSettings } from './settingsCache';
import { appApi } from '../lib/appApi';

export function useQueue() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Sistem hazır...');
  const [queue, setQueue] = useState<Task[]>([]);
  const [downloadDir, setDownloadDir] = useState<string>('');

  const refreshDownloadDir = useCallback(() => {
    getSettings().then((s) => setDownloadDir(s.downloadDir || 'Varsayılan')).catch(() => {});
  }, []);

  useEffect(() => {
    refreshDownloadDir();

    const unsubscribers: Array<() => void> = [];

    void appApi.onStatusUpdate((msg) => {
      setStatus(msg);
      refreshDownloadDir();
    }).then((unsub) => unsubscribers.push(unsub));

    void appApi.onQueueProgress((data) => {
      setQueue((prev) => prev.map((t) => t.id === data.id ? { ...t, ...data } : t));
    }).then((unsub) => unsubscribers.push(unsub));

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
  }, [url]);

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

  return { url, setUrl, queue, status, downloadDir, handleAnalyze, handleFormatChange, handleStartDownload, handleBrowseFolder, handleCancel, handleRetry, moveTask, isWorking };
}
