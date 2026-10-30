import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FolderOpen, Sparkles } from 'lucide-react';
import TaskList from './TaskList';
import AddUrlForm from '../add/AddUrlForm';
import PageHeader from '../../app/PageHeader';
import { useAppStatus } from './appStatus';
import { useQueueStore } from './store';
import { useSettings } from '../settings/queries';
import { useAppUpdate } from '../settings/appUpdate';
import { useT } from '../../i18n';
import { countByFilter, type QueueFilter } from './queueFilter';

const shortenHome = (path: string) => path.replace(/^\/home\/[^/]+/, '~').replace(/^C:\\Users\\[^\\]+/i, '~');

export default function QueuePage() {
  const m = useT();
  const queue = useQueueStore((s) => s.tasks);
  const { selectFormat, startDownload, startAll, cancel, retry, move, expandPlaylist, clearFinished } = useQueueStore.getState();
  const { status, depsReady } = useAppStatus();
  const appUpdate = useAppUpdate().data;
  const settings = useSettings().data;
  const downloadDir = settings?.downloadDir;
  const clipboardMode = settings?.clipboardMode ?? 'youtube';

  const [filter, setFilter] = useState<QueueFilter>('all');
  const stats = (['pending', 'downloading', 'complete', 'error'] as const).map((id) => ({
    id, label: m.queue.stats[id], value: countByFilter(queue, id),
  }));

  return (
    <div className="flex flex-col gap-6 flex-1">
      <PageHeader
        title={m.queue.title}
        subtitle={m.queue.subtitle}
        actions={
          clipboardMode !== 'off' && (
            <span className="badge badge-ghost gap-1.5" title={m.queue.clipboardTip[clipboardMode]}>
              <ClipboardCheck size={14} /> {m.queue.clipboard}
            </span>
          )
        }
      />

      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-5">
          <AddUrlForm />
          {/* Kutucuklar ayni zamanda listenin filtresi: tiklanan duruma gore suzer, tekrar tiklamak kaldirir. */}
          <div className="stats stats-horizontal bg-base-200 w-full" role="group" aria-label={m.list.filter}>
            {stats.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
                aria-pressed={filter === s.id}
                className={`stat py-3 px-4 text-left cursor-pointer transition-colors hover:bg-base-300/60 ${filter === s.id ? 'bg-base-300' : ''}`}
              >
                <div className="stat-title text-xs">{s.label}</div>
                <div className={`stat-value text-2xl ${s.value ? '' : 'text-base-content/30'}`}>{s.value}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex-1 flex flex-col">
        <TaskList
          tasks={queue}
          filter={filter}
          onFilterChange={setFilter}
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

      {/* Liste uzasa da durum cubugu pencerenin altinda gorunur kalir. */}
      <footer className="sticky bottom-0 z-10 -mx-6 -mb-8 px-6 pt-2 pb-3 flex flex-col gap-1.5 border-t border-base-300 bg-base-200 text-xs text-base-content/60">
        <div className="flex items-center justify-between gap-4">
          <span className="flex-1 flex items-center gap-2 min-w-0">
            <span className={`status shrink-0 ${depsReady ? 'status-success' : 'status-warning'}`} aria-hidden />
            <span className="truncate">{status(m)}</span>
            {appUpdate && (
              <Link to="/settings?tab=system" className="link link-hover text-secondary inline-flex items-center gap-1 shrink-0">
                <Sparkles size={12} /> {m.queue.newVersion(appUpdate.version)}
              </Link>
            )}
          </span>
          <span className="flex items-center gap-1.5 min-w-0 max-w-[45%]" title={downloadDir || m.queue.downloadsFolderTip}>
            <FolderOpen size={14} className="shrink-0" />
            <span className="truncate">{downloadDir ? shortenHome(downloadDir) : m.queue.downloadsFolder}</span>
          </span>
        </div>
        <p className="text-[11px] text-base-content/40">{m.legal.text}</p>
      </footer>
    </div>
  );
}
