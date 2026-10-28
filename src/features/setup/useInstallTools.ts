import { useState } from 'react';
import { appApi } from '../../lib/appApi';
import type { ToolId } from '../../types/app-api';
import { refreshDependencyStatus } from '../queue/bootstrap';
import { refreshTools, type InstallStep } from './tools';

export interface StepProgress {
  state: 'waiting' | 'running' | 'done' | 'error';
  percent: number;
  error?: string;
}

/** Adimlari sirayla indirir; ilk hatada durur. Kurulum ekrani ve Ayarlar ortak kullanir. */
export function useInstallTools() {
  const [progress, setProgress] = useState<Partial<Record<ToolId, StepProgress>>>({});
  const [running, setRunning] = useState(false);

  const update = (tool: ToolId, next: StepProgress) => setProgress((prev) => ({ ...prev, [tool]: next }));

  const run = async (steps: InstallStep[], proxy?: string): Promise<boolean> => {
    setRunning(true);
    setProgress(Object.fromEntries(steps.map((s) => [s.tool, { state: 'waiting', percent: 0 }])));
    let ok = true;
    for (const step of steps) {
      update(step.tool, { state: 'running', percent: 0 });
      try {
        await appApi.installTool(step.tool, { withFfprobe: step.withFfprobe, proxy }, (percent) =>
          update(step.tool, { state: 'running', percent }),
        );
        update(step.tool, { state: 'done', percent: 100 });
      } catch (error) {
        update(step.tool, { state: 'error', percent: 0, error: error instanceof Error ? error.message : String(error) });
        ok = false;
        break;
      }
    }
    await refreshTools();
    await refreshDependencyStatus();
    setRunning(false);
    return ok;
  };

  return { progress, running, run };
}
