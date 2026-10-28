import { useState } from 'react';
import { CircleCheck, CircleX, PackageOpen } from 'lucide-react';
import { useT } from '../../i18n';
import type { ToolId, ToolStatus } from '../../types/app-api';
import { useSaveSettings, useSettings } from '../settings/queries';
import { isValidProxy } from '../settings/NetworkSettings';
import { installSteps, missingTools, outdatedTools, REQUIRED_TOOLS, useToolsStatus } from './tools';
import { useInstallTools, type StepProgress } from './useInstallTools';

/**
 * Ilk acilista (kullanim kosullari kabul edildikten sonra) eksik bilesenleri indirir.
 * Zorunlu bilesenler kurulmadan kapatilamaz; yalnizca surumu eskiyenler varsa atlanabilir.
 */
export default function SetupScreen() {
  const m = useT().setup;
  const settings = useSettings();
  const tools = useToolsStatus();
  const installer = useInstallTools();
  const save = useSaveSettings();
  const [dismissed, setDismissed] = useState(false);
  const [withFfprobe, setWithFfprobe] = useState(false);
  const [proxy, setProxy] = useState<string | null>(null);

  if (!settings.isSuccess || !settings.data.legalAccepted || !tools.isSuccess || dismissed) return null;
  const missing = missingTools(tools.data);
  const outdated = outdatedTools(tools.data);
  if (!missing.length && !outdated.length && !installer.running) return null;

  const proxyValue = (proxy ?? settings.data.proxy ?? '').trim();
  const proxyValid = isValidProxy(proxyValue);
  const ffprobe = tools.data.find((t) => t.id === 'ffprobe');
  const offerFfprobe = !!ffprobe?.downloadable && !ffprobe.installed;
  const steps = installSteps(tools.data, withFfprobe);
  const totalMb = steps.reduce((sum, s) => sum + s.downloadMb, 0);
  const failed = Object.values(installer.progress).some((p) => p?.state === 'error');
  const blocked = missing.filter((id) => !tools.data.find((t) => t.id === id)?.downloadable);

  const start = () => {
    if (proxyValue !== (settings.data.proxy ?? '')) save.mutate({ proxy: proxyValue });
    void installer.run(steps, proxyValue || undefined);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="setup-title" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="grid place-items-center size-10 rounded-full bg-base-200">
            <PackageOpen size={20} />
          </span>
          <h2 id="setup-title" className="text-lg font-bold">{m.title}</h2>
        </div>
        <p className="text-sm text-base-content/80 leading-relaxed">{missing.length ? m.intro : m.updateIntro}</p>

        <ul className="list mt-3 -mx-4" aria-label={m.title}>
          {REQUIRED_TOOLS.map((id) => (
            <ToolRow key={id} tool={tools.data.find((t) => t.id === id)} id={id} progress={installer.progress[id]} />
          ))}
          {withFfprobe && !steps.some((s) => s.tool === 'ffmpeg') && (
            <ToolRow tool={ffprobe} id="ffprobe" progress={installer.progress.ffprobe} />
          )}
        </ul>

        {offerFfprobe && (
          <label className="flex items-start gap-3 mt-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={withFfprobe}
              disabled={installer.running}
              onChange={(e) => setWithFfprobe(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{m.ffprobe}</span>
              <span className="block text-xs text-base-content/60">{m.ffprobeHint}</span>
            </span>
          </label>
        )}

        <details className="collapse collapse-arrow bg-base-200 mt-4">
          <summary className="collapse-title text-sm font-medium">{m.network}</summary>
          <div className="collapse-content">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">{m.proxy}</legend>
              <input
                value={proxy ?? settings.data.proxy ?? ''}
                onChange={(e) => setProxy(e.target.value)}
                disabled={installer.running}
                placeholder="http://127.0.0.1:8080"
                className={`input w-full ${proxyValid ? '' : 'input-error'}`}
                aria-label={m.proxy}
                aria-invalid={!proxyValid}
              />
              <p className="label text-wrap">{m.proxyHint}</p>
            </fieldset>
          </div>
        </details>

        {blocked.length > 0 && <p className="text-xs text-warning mt-3">{m.unavailable}</p>}
        {totalMb > 0 && !installer.running && <p className="text-xs text-base-content/60 mt-3">{m.total(totalMb)}</p>}

        <div className="modal-action">
          {!missing.length && !installer.running && (
            <button onClick={() => setDismissed(true)} className="btn btn-ghost">{m.later}</button>
          )}
          <button
            onClick={start}
            disabled={installer.running || !steps.length || !proxyValid}
            className="btn btn-primary flex-1"
            autoFocus
          >
            {installer.running ? <><span className="loading loading-spinner loading-sm" /> {m.installing}</> : failed ? m.retry : m.start}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolRow({ id, tool, progress }: { id: ToolId; tool?: ToolStatus; progress?: StepProgress }) {
  const m = useT().setup;
  const ready = !!tool?.installed && !tool.outdated && progress?.state !== 'running';
  return (
    <li className="list-row items-center py-2.5">
      <span aria-hidden className="w-5">
        {progress?.state === 'error' ? (
          <CircleX size={18} className="text-error" />
        ) : ready || progress?.state === 'done' ? (
          <CircleCheck size={18} className="text-success" />
        ) : progress?.state === 'running' ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <span className="status status-neutral ml-1" />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{m.names[id]}</div>
        <div className="text-xs text-base-content/60">{m.purpose[id]}</div>
        {progress?.state === 'running' && (
          <progress className="progress progress-primary w-full mt-1.5" value={progress.percent} max={100} aria-label={m.names[id]} />
        )}
        {progress?.error && <div className="text-xs text-error mt-1 break-words">{m.failed(progress.error)}</div>}
      </div>
      <span className="text-xs text-base-content/60 tabular-nums whitespace-nowrap">
        {progress?.state === 'running'
          ? `%${progress.percent}`
          : ready || progress?.state === 'done'
            ? m.done
            : progress?.state === 'waiting'
              ? m.waiting
              : tool?.downloadable
                ? m.size(tool.downloadMb)
                : ''}
      </span>
    </li>
  );
}
