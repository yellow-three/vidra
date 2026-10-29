// "Hata bildir": hatanin ayrintilari dolu bir GitHub issue taslagi. Kullanici gondermeden once duzenleyebilir.

import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { engine } from '../../engine';
import type { Task } from '../../types';

export const ISSUES_URL = 'https://github.com/yellow-three/vidra/issues/new';
/** Tarayicilarin ve GitHub'in kabul ettigi URL uzunlugunun altinda kalmak icin. */
const MAX_DETAIL = 4000;

export interface Environment {
  appVersion: string;
  ytdlpVersion: string;
  platform: string;
}

export function issueUrl(task: Pick<Task, 'url' | 'message' | 'detail' | 'selectedFormatId'>, env: Environment): string {
  const detail = (task.detail ?? task.message ?? '').slice(-MAX_DETAIL);
  const body = [
    '### Ne oldu / What happened',
    '',
    task.message ?? '',
    '',
    '### Link',
    '',
    task.url,
    '',
    '### yt-dlp çıktısı / output',
    '',
    '```',
    detail,
    '```',
    '',
    '### Ortam / Environment',
    '',
    `- Vidra: ${env.appVersion}`,
    `- yt-dlp: ${env.ytdlpVersion}`,
    `- Format: ${task.selectedFormatId ?? '-'}`,
    `- ${env.platform}`,
    '',
    '<!-- Kayıt dosyası: Ayarlar > Sistem > Kayıt dosyaları (vidra.log). Gerekirse buraya sürükleyin. -->',
  ].join('\n');
  const title = `İndirme hatası: ${(task.message ?? '').split('\n')[0].slice(0, 80)}`;
  return `${ISSUES_URL}?${new URLSearchParams({ title, body, labels: 'bug' })}`;
}

/** Surumleri toplayip taslagi tarayicida acar. */
export async function reportIssue(task: Task): Promise<void> {
  const [appVersion, ytdlpVersion] = await Promise.all([
    getVersion().catch(() => '?'),
    engine.engineVersion().catch(() => null),
  ]);
  await openUrl(issueUrl(task, { appVersion, ytdlpVersion: ytdlpVersion ?? '?', platform: navigator.userAgent }));
}
