// Kayit dosyasi (tauri-plugin-log, uygulama kayit klasorunde vidra.log): hata bildirirken eklenir.
// Kayit yazilamazsa (testler, tarayici onizlemesi) sessizce atlanir; uygulamayi etkilemez.

import { error as logError, info as logInfo, warn as logWarn } from '@tauri-apps/plugin-log';

const text = (args: unknown[]) =>
  args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

const safe = (write: (message: string) => Promise<void>) => (...args: unknown[]) => {
  try {
    void write(text(args)).catch(() => {});
  } catch {
    // Tauri disinda calisiyor.
  }
};

export const log = { info: safe(logInfo), warn: safe(logWarn), error: safe(logError) };

/** console.warn/error cagrilari da kayda gider (motor ve ayarlardaki uyarilar). */
export function forwardConsoleToLog(): void {
  const { warn, error } = console;
  console.warn = (...args: unknown[]) => { warn(...args); log.warn(...args); };
  console.error = (...args: unknown[]) => { error(...args); log.error(...args); };
}
