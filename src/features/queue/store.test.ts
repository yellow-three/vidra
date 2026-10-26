import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadProgress, DownloadRequest, DownloadResult, VideoInfo } from '../../engine';
import { buildOptions } from '../../engine/ytdlp';

const settings = { downloadDir: '/out', autoOpenFolder: false, downloadSubtitles: true } as Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  getInfo: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  addHistory: vi.fn(),
  openFileLocation: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../engine', () => ({
  engine: { getInfo: mocks.getInfo, download: mocks.download, cancel: mocks.cancel },
}));
vi.mock('../settings/queries', () => ({ fetchSettings: async () => settings }));
vi.mock('../history/queries', () => ({ addHistory: mocks.addHistory }));
vi.mock('../../lib/appApi', () => ({
  appApi: { openFileLocation: mocks.openFileLocation, getDownloadFolder: async () => '/default' },
}));
vi.mock('./notify', () => ({ notifyComplete: mocks.notify }));

const { useQueueStore } = await import('./store');

const info = (title: string): VideoInfo => ({
  title,
  url: 'U',
  thumbnail: 'T',
  formats: buildOptions([{ format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080, filesize: 1000 }]),
});

/** Disaridan bitirilebilen indirme: testler ilerleme ve sonucu kendisi verir. */
function controllableDownload() {
  const calls: { req: DownloadRequest; progress: (p: DownloadProgress) => void; finish: (r: DownloadResult) => void }[] = [];
  mocks.download.mockImplementation((req: DownloadRequest, progress: (p: DownloadProgress) => void) =>
    new Promise<DownloadResult>((finish) => calls.push({ req, progress, finish })));
  return calls;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const task = (id: string) => useQueueStore.getState().tasks.find((t) => t.id === id)!;

async function addReadyTask(url: string, title = 'Video') {
  mocks.getInfo.mockResolvedValueOnce(info(title));
  useQueueStore.getState().setUrl(url);
  const id = await useQueueStore.getState().analyze();
  return id!;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete settings.defaultFormat;
  useQueueStore.setState({ tasks: [], url: '' });
});

describe('queue store', () => {
  it('analiz sonucunu varsayilan formatla hazir duruma getirir ve URL kutusunu bosaltir', async () => {
    settings.defaultFormat = 'mp3';
    const id = await addReadyTask('https://youtu.be/a', 'Klip');
    expect(useQueueStore.getState().url).toBe('');
    expect(task(id)).toMatchObject({ status: 'ready-to-select', title: 'Klip', selectedFormatId: 'audio-mp3' });
  });

  it('analiz hatasini karta yazar', async () => {
    mocks.getInfo.mockRejectedValueOnce(new Error('ERROR: Video unavailable'));
    useQueueStore.getState().setUrl('https://youtu.be/x');
    const id = (await useQueueStore.getState().analyze())!;
    expect(task(id)).toMatchObject({ status: 'error', message: 'ERROR: Video unavailable' });
  });

  it('indirme surerken yeni link analiz edilebilir', async () => {
    const calls = controllableDownload();
    const first = await addReadyTask('https://youtu.be/a');
    const running = useQueueStore.getState().startDownload(first);
    await flush();
    expect(calls).toHaveLength(1);

    const second = await addReadyTask('https://youtu.be/b');
    expect(task(second).status).toBe('ready-to-select');
    expect(task(first).status).toBe('downloading');

    // Sinirlayici modul duzeyinde; sonraki testlere dolu slot birakma.
    calls[0].finish({ status: 'cancelled' });
    await running;
  });

  it('ilerlemeyi yansitir, bitince gecmise ekler', async () => {
    const calls = controllableDownload();
    const id = await addReadyTask('https://youtu.be/a', 'Klip');
    const done = useQueueStore.getState().startDownload(id);
    await flush();

    expect(calls[0].req).toMatchObject({ url: 'https://youtu.be/a', formatId: 'video-1080', outDir: '/out', subtitles: true });
    calls[0].progress({ percent: 42, speed: '1 MB/s', eta: '00:05' });
    expect(task(id)).toMatchObject({ status: 'downloading', percent: 42, speed: '1 MB/s', eta: '00:05' });

    calls[0].finish({ status: 'complete', filePath: '/out/Klip.mp4', fileSize: 2048 });
    await done;
    expect(task(id)).toMatchObject({ status: 'complete', percent: 100 });
    expect(mocks.addHistory).toHaveBeenCalledWith(expect.objectContaining({
      id, title: 'Klip', quality: '1080p', ext: 'mp4', fileSize: '2.0 KB', filePath: '/out/Klip.mp4',
    }));
    expect(mocks.notify).toHaveBeenCalledWith('Klip');
    expect(mocks.openFileLocation).not.toHaveBeenCalled();
  });

  it('ayni anda en fazla iki indirme calistirir; siradakini iptal etmek onu hic baslatmaz', async () => {
    const calls = controllableDownload();
    const ids = [await addReadyTask('a'), await addReadyTask('b'), await addReadyTask('c')];
    const runs = ids.map((id) => useQueueStore.getState().startDownload(id));
    await flush();
    expect(calls).toHaveLength(2);
    expect(task(ids[2]).message).toBe('Sırada bekliyor...');

    await useQueueStore.getState().cancel(ids[2]);
    expect(task(ids[2]).status).toBe('cancelled');

    calls[0].finish({ status: 'complete', filePath: '/out/a.mp4' });
    calls[1].finish({ status: 'cancelled' });
    await Promise.all(runs);
    expect(calls).toHaveLength(2);
    expect(task(ids[1]).status).toBe('cancelled');
  });

  it('iptal edilen kart gec gelen analiz sonucuyla geri acilmaz', async () => {
    let resolve!: (v: VideoInfo) => void;
    mocks.getInfo.mockReturnValueOnce(new Promise<VideoInfo>((r) => { resolve = r; }));
    useQueueStore.getState().setUrl('https://youtu.be/a');
    const pending = useQueueStore.getState().analyze();
    await flush();
    const id = useQueueStore.getState().tasks[0].id;

    await useQueueStore.getState().cancel(id);
    resolve(info('Gec'));
    await pending;
    expect(task(id).status).toBe('cancelled');
  });
});
