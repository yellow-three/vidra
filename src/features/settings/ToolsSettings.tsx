import { Download, RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import type { ToolStatus } from '../../types/app-api';
import { REQUIRED_TOOLS, useToolsStatus } from '../setup/tools';
import { useInstallTools } from '../setup/useInstallTools';
import { useSettings } from './queries';

/** Ayarlar > Sistem: zorunlu bilesenlerin durumu ve "yeniden indir" (onarim). */
export default function ToolsSettings() {
  const m = useT().tools;
  const names = useT().setup.names;
  const tools = useToolsStatus().data ?? [];
  const proxy = useSettings().data?.proxy;
  const installer = useInstallTools();

  const badge = (tool: ToolStatus) =>
    !tool.installed
      ? <span className="badge badge-soft badge-error">{m.missing}</span>
      : tool.outdated
        ? <span className="badge badge-soft badge-warning">{m.outdated}</span>
        : <span className="badge badge-ghost">{tool.bundled ? m.bundled : tool.system ? m.system : m.downloaded}</span>;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{m.title}</h3>
      <ul className="list -mx-4">
        {REQUIRED_TOOLS.map((id) => tools.find((t) => t.id === id)).filter((t): t is ToolStatus => !!t).map((tool) => {
          const progress = installer.progress[tool.id];
          const ffprobeInstalled = !!tools.find((t) => t.id === 'ffprobe')?.installed;
          return (
            <li key={tool.id} className="list-row items-center py-2">
              <span className="text-sm w-16">{names[tool.id]}</span>
              <div className="min-w-0">
                {progress?.state === 'running' ? (
                  <progress className="progress progress-primary w-full" value={progress.percent} max={100} aria-label={m.downloading(names[tool.id])} />
                ) : (
                  badge(tool)
                )}
                {progress?.error && <p className="text-xs text-error mt-1 break-words">{m.failed(progress.error)}</p>}
              </div>
              {tool.downloadable && !tool.bundled && (
                <button
                  onClick={() => void installer.run([{ tool: tool.id, withFfprobe: tool.id === 'ffmpeg' && ffprobeInstalled, downloadMb: tool.downloadMb }], proxy)}
                  disabled={installer.running}
                  className="btn btn-sm gap-1.5"
                >
                  {tool.installed && !tool.outdated && !tool.system ? <RefreshCw size={14} /> : <Download size={14} />}
                  {tool.system ? m.downloadAnyway : tool.installed && !tool.outdated ? m.reinstall : m.install}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
