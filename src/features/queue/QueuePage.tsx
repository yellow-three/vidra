import TaskList from './TaskList';
import AddUrlForm from '../add/AddUrlForm';
import { useAppStatus } from './bootstrap';
import { useQueueStore } from './store';
import { useSettings } from '../settings/queries';
import { LEGAL_TEXT } from '../../app/LegalNotice';

const clipIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const folderIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function QueuePage() {
  const queue = useQueueStore((s) => s.tasks);
  const { selectFormat, startDownload, cancel, retry, move } = useQueueStore.getState();
  const status = useAppStatus((s) => s.status);
  const downloadDir = useSettings().data?.downloadDir || 'Varsayılan (İndirilenler)';

  const countAnalyzing = queue.filter((t) => t.status === 'analyzing').length;
  const countDownloading = queue.filter((t) => t.status === 'downloading').length;
  const countPending = queue.filter((t) => t.status === 'ready-to-select').length;
  const countDone = queue.filter((t) => t.status === 'complete').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header + Input (shrink, no scroll) */}
      <div className="space-y-6 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">YouTube Downloader</h1>
            <p className="text-xs text-slate-500 mt-0.5">Video analiz ve indirme havuzu</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            {clipIcon}
            Pano izleniyor
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-lg">
          <AddUrlForm />

          <div className="flex gap-4 mt-4 pt-4 border-t border-[var(--border)]">
            <Stat label="Sırada" value={countPending} />
            <Stat label="Analiz" value={countAnalyzing} />
            <Stat label="İnen" value={countDownloading} color="text-blue-400" />
            <Stat label="Tamam" value={countDone} color="text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Task List (scrolls) */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-6 space-y-4">
        <TaskList
          tasks={queue}
          onFormatChange={selectFormat}
          onStartDownload={(task) => void startDownload(task.id)}
          onCancel={(id) => void cancel(id)}
          onRetry={(task) => void retry(task.id)}
          onMove={move}
        />
      </div>

      {/* Status Bar (bottom) */}
      <div className="shrink-0 mt-4 flex items-center justify-between px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <span className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {status}
        </span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1.5 truncate max-w-[300px]" title={downloadDir}>
          {folderIcon}
          {downloadDir.replace(/^\/home\/[^/]+/, '~')}
        </span>
      </div>
      <p className="shrink-0 mt-2 text-[10px] text-slate-600 text-center">{LEGAL_TEXT}</p>
    </div>
  );
}

function Stat({ label, value, color = 'text-slate-300' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${value > 0 ? color : 'text-slate-600'}`}>{value}</span>
    </div>
  );
}
