import { Link } from 'react-router-dom';
import { ClipboardCheck, FolderOpen, Sparkles } from 'lucide-react';
import TaskList from './TaskList';
import AddUrlForm from '../add/AddUrlForm';
import PageHeader from '../../app/PageHeader';
import { LEGAL_TEXT } from '../../app/LegalNotice';
import { useAppStatus } from './bootstrap';
import { useQueueStore } from './store';
import { useSettings } from '../settings/queries';
import { useAppUpdate } from '../settings/appUpdate';

const shortenHome = (path: string) => path.replace(/^\/home\/[^/]+/, '~').replace(/^C:\\Users\\[^\\]+/i, '~');

export default function QueuePage() {
  const queue = useQueueStore((s) => s.tasks);
  const { selectFormat, startDownload, startAll, cancel, retry, move, expandPlaylist, clearFinished } = useQueueStore.getState();
  const { status, depsReady } = useAppStatus();
  const appUpdate = useAppUpdate().data;
  const downloadDir = useSettings().data?.downloadDir;

  const count = (pred: (s: string) => boolean) => queue.filter((t) => pred(t.status)).length;
  const stats = [
    { label: 'Bekleyen', value: count((s) => s === 'ready-to-select' || s === 'analyzing' || s === 'queued') },
    { label: 'İniyor', value: count((s) => s === 'downloading') },
    { label: 'Tamamlanan', value: count((s) => s === 'complete') },
    { label: 'Hatalı', value: count((s) => s === 'error') },
  ];

  return (
    <div className="flex flex-col gap-6 flex-1">
      <PageHeader
        title="İndir"
        subtitle="YouTube videolarını video veya ses olarak indirin."
        actions={
          <span className="badge badge-ghost gap-1.5" title="Kopyalanan YouTube linkleri kutuya otomatik gelir">
            <ClipboardCheck size={14} /> Pano izleniyor
          </span>
        }
      />

      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-5">
          <AddUrlForm />
          <div className="stats stats-horizontal bg-base-200 w-full">
            {stats.map((s) => (
              <div key={s.label} className="stat py-3 px-4">
                <div className="stat-title text-xs">{s.label}</div>
                <div className={`stat-value text-2xl ${s.value ? '' : 'text-base-content/30'}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex-1 flex flex-col">
        <TaskList
          tasks={queue}
          onFormatChange={selectFormat}
          onStartDownload={(task) => void startDownload(task.id)}
          onCancel={(id) => void cancel(id)}
          onRetry={(task) => void retry(task.id)}
          onMove={move}
          onExpandPlaylist={(id) => void expandPlaylist(id)}
          onStartAll={() => void startAll()}
          onClearFinished={clearFinished}
        />
      </div>

      <footer className="flex flex-col gap-2 pt-2 border-t border-base-300 text-xs text-base-content/60">
        <div className="flex items-center justify-between gap-4">
          <span className="flex-1 flex items-center gap-2 min-w-0">
            <span className={`status shrink-0 ${depsReady ? 'status-success' : 'status-warning'}`} aria-hidden />
            <span className="truncate">{status}</span>
            {appUpdate && (
              <Link to="/settings" className="link link-hover text-secondary inline-flex items-center gap-1 shrink-0">
                <Sparkles size={12} /> Yeni sürüm {appUpdate.version} hazır
              </Link>
            )}
          </span>
          <span className="flex items-center gap-1.5 min-w-0 max-w-[45%]" title={downloadDir || 'İndirilenler klasörü'}>
            <FolderOpen size={14} className="shrink-0" />
            <span className="truncate">{downloadDir ? shortenHome(downloadDir) : 'İndirilenler'}</span>
          </span>
        </div>
        <p className="text-[11px] text-base-content/40">{LEGAL_TEXT}</p>
      </footer>
    </div>
  );
}
