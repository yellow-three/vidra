// Ilk acilista indirilen bilesenler: durum sorgusu ve kurulum adimlari.

import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../../app/queryClient';
import { appApi } from '../../lib/appApi';
import type { ToolId, ToolStatus } from '../../types/app-api';

export const toolsKey = ['tools'] as const;
const depsKey = ['dependencies'] as const;

/** Uygulamanin calismasi icin gerekenler, kurulum sirasiyla. */
export const REQUIRED_TOOLS: ToolId[] = ['yt-dlp', 'deno', 'ffmpeg'];

export const useToolsStatus = () => useQuery({ queryKey: toolsKey, queryFn: () => appApi.toolsStatus() });

export const refreshTools = () =>
  Promise.all([queryClient.invalidateQueries({ queryKey: toolsKey }), queryClient.invalidateQueries({ queryKey: depsKey })]);

const find = (tools: ToolStatus[], id: ToolId) => tools.find((t) => t.id === id);

/** Kullanilabilir kopyasi olmayan zorunlu bilesenler; bunlar varken uygulama indirme yapamaz. */
export const missingTools = (tools: ToolStatus[]) => REQUIRED_TOOLS.filter((id) => !find(tools, id)?.installed);

/** Calisan ama yenilenmesi gereken (uygulama guncellemesiyle surumu degisen) bilesenler. */
export const outdatedTools = (tools: ToolStatus[]) => REQUIRED_TOOLS.filter((id) => find(tools, id)?.outdated);

export interface InstallStep {
  tool: ToolId;
  withFfprobe: boolean;
  downloadMb: number;
}

/** Kurulum ekraninin indirecegi adimlar. ffprobe, FFmpeg indiriliyorsa ayni arsivden cikarilir. */
export function installSteps(tools: ToolStatus[], withFfprobe: boolean): InstallStep[] {
  const steps: InstallStep[] = REQUIRED_TOOLS
    .map((id) => find(tools, id))
    .filter((t): t is ToolStatus => !!t && t.downloadable && (!t.installed || t.outdated))
    .map((t) => ({ tool: t.id, withFfprobe: t.id === 'ffmpeg' && withFfprobe, downloadMb: t.downloadMb }));
  const ffprobe = find(tools, 'ffprobe');
  if (withFfprobe && ffprobe?.downloadable && !ffprobe.installed && !steps.some((s) => s.tool === 'ffmpeg')) {
    steps.push({ tool: 'ffprobe', withFfprobe: true, downloadMb: ffprobe.downloadMb });
  }
  return steps;
}
