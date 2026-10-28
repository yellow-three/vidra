// Rust'taki genel surec calistiricinin (process_spawn / process_kill) TS sarmalayicisi.

import { Channel, invoke } from '@tauri-apps/api/core';

type ProcessEvent =
  | { type: 'stdout'; line: string }
  | { type: 'stderr'; line: string }
  | { type: 'exit'; code: number | null; killed: boolean };

export type AllowedProgram = 'yt-dlp' | 'ffmpeg';

export interface ProcessExit {
  code: number | null;
  killed: boolean;
}

export interface RunningProcess {
  id: number;
  exit: Promise<ProcessExit>;
}

export async function spawnProcess(
  program: AllowedProgram,
  args: string[],
  handlers: { onStdout?: (line: string) => void; onStderr?: (line: string) => void } = {},
): Promise<RunningProcess> {
  let resolveExit!: (exit: ProcessExit) => void;
  const exit = new Promise<ProcessExit>((r) => { resolveExit = r; });

  // Kanal invoke'tan once kurulur; ilk satirlar kaybolmaz ve sira korunur.
  const channel = new Channel<ProcessEvent>();
  channel.onmessage = (event) => {
    if (event.type === 'stdout') handlers.onStdout?.(event.line);
    else if (event.type === 'stderr') handlers.onStderr?.(event.line);
    else resolveExit({ code: event.code, killed: event.killed });
  };

  const id = await invoke<number>('process_spawn', { program, args, onEvent: channel });
  return { id, exit };
}

export function killProcess(id: number): Promise<boolean> {
  return invoke<boolean>('process_kill', { id });
}

/** Sureci calistirip ciktisini toplar (kisa komutlar icin). */
export async function runProcess(program: AllowedProgram, args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const proc = await spawnProcess(program, args, {
    onStdout: (l) => stdout.push(l),
    onStderr: (l) => stderr.push(l),
  });
  const result = await proc.exit;
  return { ...result, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
