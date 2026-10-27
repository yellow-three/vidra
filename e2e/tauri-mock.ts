// Playwright testleri icin sahte Tauri backend'i: sayfa yuklenmeden once
// window.__TAURI_INTERNALS__ kurulur, testler window.__mock ile kontrol eder.

import type { Page } from '@playwright/test';

export interface MockOptions {
  settings?: Record<string, unknown>;
  deps?: { ytdlp: boolean; ffmpeg: boolean; deno: boolean };
  history?: Record<string, unknown>[];
  /** Sunulacak uygulama guncellemesi; yoksa "guncel". */
  update?: { version: string; body: string } | null;
}

/** Tarayicida calisir; disaridan degisken almaz (addInitScript ile serilestirilir). */
function install(options: MockOptions) {
  type Handler = (payload: unknown) => void;
  type Channel = { onmessage: (e: unknown) => void };
  const callbacks = new Map<number, Handler>();
  const listeners = new Map<string, number[]>();
  let nextCallback = 1;
  let nextProcess = 1;

  const state = {
    // Gercek backend ayarlari diske yazar; sayfa yenilense de korunsun.
    // ytdlpCheckedAt: acilistaki otomatik yt-dlp guncellemesi testleri bozmasin.
    settings: JSON.parse(sessionStorage.getItem('__mockSettings') ?? 'null')
      ?? { ytdlpCheckedAt: Date.now(), ...(options.settings ?? {}) } as Record<string, unknown>,
    deps: options.deps ?? { ytdlp: true, ffmpeg: true, deno: true },
    history: [...(options.history ?? [])] as Record<string, unknown>[],
    calls: [] as { cmd: string; args: unknown }[],
    downloads: [] as { pid: number; channel: Channel; args: string[]; done: boolean }[],
  };

  const info = {
    title: 'Me at the zoo',
    duration: 19,
    thumbnail: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g"><stop offset="0" stop-color="#6b8e23"/><stop offset="1" stop-color="#2f4f4f"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>'),
    formats: [
      { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', filesize: 300000 },
      { format_id: '134', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 360, filesize: 900000 },
      { format_id: '133', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 240, filesize: 600000 },
    ],
  };

  const playlist = {
    _type: 'playlist',
    title: 'Örnek liste',
    entries: [
      { id: 'a1', url: 'https://www.youtube.com/watch?v=a1', title: 'Birinci video', duration: 60 },
      { id: 'b2', url: 'https://www.youtube.com/watch?v=b2', title: 'İkinci video', duration: 90 },
    ],
  };

  const emit = (event: string, payload: unknown) => {
    for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, payload, id });
  };

  const exit = (d: (typeof state.downloads)[number], code: number | null, killed: boolean) => {
    if (d.done) return;
    d.done = true;
    d.channel.onmessage({ type: 'exit', code, killed });
  };

  function spawn(args: { program: string; args: string[]; onEvent: Channel }) {
    const pid = nextProcess++;
    if (args.args.includes('-J')) {
      setTimeout(() => {
        const isPlaylist = args.args[0].includes('playlist?list=') || args.args.includes('--yes-playlist');
        args.onEvent.onmessage({ type: 'stdout', line: JSON.stringify(isPlaylist ? playlist : info) });
        args.onEvent.onmessage({ type: 'exit', code: 0, killed: false });
      }, 50);
    } else {
      const d = { pid, channel: args.onEvent, args: args.args, done: false };
      state.downloads.push(d);
      setTimeout(() => d.channel.onmessage({ type: 'stdout', line: 'DEST:/home/u/Downloads/Me at the zoo.mp4' }), 10);
    }
    return pid;
  }

  const commands: Record<string, (args: any) => unknown> = {
    get_settings: () => state.settings,
    save_settings: ({ settings }) => {
      Object.assign(state.settings, settings);
      sessionStorage.setItem('__mockSettings', JSON.stringify(state.settings));
      return { success: true };
    },
    get_download_folder: () => '/home/u/Downloads',
    cookie_source: ({ browser }) => browser,
    'plugin:dialog|ask': () => true,
    select_download_folder: () => ({ success: false, error: 'iptal' }),
    check_dependencies: () => ({ ...state.deps, ytdlpPath: '/bin/ytd-yt-dlp', ffmpegPath: '/bin/ytd-ffmpeg', denoPath: '/bin/ytd-deno' }),
    get_ytdlp_version: () => ({ version: '2026.10.21' }),
    update_ytdlp: () => ({ success: true, version: '2026.10.22' }),
    start_clipboard_monitor: () => ({ success: true }),
    stop_clipboard_monitor: () => ({ success: true }),
    get_legacy_history: () => [],
    clear_legacy_history: () => ({ success: true }),
    open_file_location: () => ({ success: true }),
    process_spawn: spawn,
    process_kill: ({ id }) => {
      const d = state.downloads.find((x) => x.pid === id);
      if (d) exit(d, null, true);
      return !!d;
    },
    'plugin:event|listen': ({ event, handler }) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      return handler;
    },
    'plugin:event|unlisten': () => null,
    'plugin:sql|load': ({ db }) => db,
    'plugin:sql|select': ({ query }) => (String(query).startsWith('SELECT *') ? state.history : []),
    'plugin:sql|execute': ({ query, values }) => {
      const q = String(query);
      if (q.startsWith('INSERT')) {
        const keys = ['id', 'title', 'url', 'thumbnail', 'format_id', 'quality', 'ext', 'file_size', 'file_path', 'completed_at'];
        state.history.unshift(Object.fromEntries(keys.map((k, i) => [k, values[i]])));
      } else if (q.startsWith('DELETE FROM history WHERE')) {
        state.history = state.history.filter((h) => h.id !== values[0]);
      } else if (q.startsWith('DELETE')) {
        state.history = [];
      }
      return [1, 0];
    },
    'plugin:fs|read_dir': () => [],
    'plugin:notification|is_permission_granted': () => true,
    'plugin:app|version': () => '0.1.0',
    'plugin:updater|check': () =>
      options.update ? { rid: 99, currentVersion: '0.1.0', version: options.update.version, date: null, body: options.update.body, rawJson: {} } : null,
    'plugin:updater|download_and_install': ({ onEvent }) => {
      onEvent.onmessage({ event: 'Started', data: { contentLength: 200 } });
      onEvent.onmessage({ event: 'Progress', data: { chunkLength: 100 } });
      onEvent.onmessage({ event: 'Progress', data: { chunkLength: 100 } });
      onEvent.onmessage({ event: 'Finished' });
      return null;
    },
    'plugin:process|restart': () => null,
    'plugin:resources|close': () => null,
  };

  (window as any).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback(callback: Handler) {
      const id = nextCallback++;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    async invoke(cmd: string, args: any) {
      state.calls.push({ cmd, args });
      const handler = commands[cmd];
      if (!handler) throw new Error(`mock: bilinmeyen komut ${cmd}`);
      return handler(args ?? {});
    },
    convertFileSrc: (path: string) => path,
  };
  (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };

  (window as any).__mock = {
    state,
    emit,
    progress(i: number, percent: number) {
      const line = '[progress] ' + JSON.stringify({ status: 'downloading', downloaded_bytes: percent, total_bytes: 100, speed: 1048576, eta: 5 });
      state.downloads[i].channel.onmessage({ type: 'stdout', line });
    },
    finish(i: number) {
      const d = state.downloads[i];
      d.channel.onmessage({ type: 'stdout', line: 'FILE:/home/u/Downloads/Me at the zoo.mp4' });
      exit(d, 0, false);
    },
    fail(i: number, message: string) {
      state.downloads[i].channel.onmessage({ type: 'stderr', line: message });
      exit(state.downloads[i], 1, false);
    },
  };
}

export async function mockTauri(page: Page, options: MockOptions = {}) {
  await page.addInitScript(install, options);
}
