import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadProgress, DownloadRequest, DownloadResult, VideoInfo } from '../../engine';
import { EngineError } from '../../engine/errors';
import tr from '../../i18n/tr';
import { buildOptions, playlistOptions } from '../../engine/ytdlp';

const settings = { downloadDir: '/out', downloadSubtitles: true } as Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  getInfo: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  discardPartial: vi.fn(),
  addHistory: vi.fn(),
  fetchHistory: vi.fn(),
  openFileLocation: vi.fn(),
  notify: vi.fn(),
  freeSpace: vi.fn(),
}));

vi.mock('../../engine', () => ({
  engine: {
    getInfo: mocks.getInfo, download: mocks.download, cancel: mocks.cancel, pause: mocks.pause, discardPartial: mocks.discardPartial,
  },
}));
vi.mock('../settings/queries', () => ({ fetchSettings: async () => settings }));
vi.mock('../history/queries', () => ({ addHistory: mocks.addHistory, fetchHistory: mocks.fetchHistory }));
vi.mock('../../lib/appApi', () => ({
  appApi: { openFileLocation: mocks.openFileLocation, getDownloadFolder: async () => '/default', freeSpace: mocks.freeSpace },
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
  mocks.fetchHistory.mockResolvedValue([]);
  mocks.freeSpace.mockResolvedValue(null);
  for (const key of ['defaultFormat', 'maxConcurrentDownloads', 'cookiesFromBrowser', 'proxy', 'rateLimit', 'subtitleLangs', 'playlistSubfolder']) {
    delete settings[key];
  }
  useQueueStore.setState({ tasks: [], url: '', playlistPicks: [] });
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

    expect(calls[0].req).toMatchObject({ url: 'https://youtu.be/a', formatId: 'video-1080', outDir: '/out', subtitles: true, embedMetadata: true });
    calls[0].progress({ percent: 42, speed: '1 MB/s', eta: '00:05' });
    expect(task(id)).toMatchObject({ status: 'downloading', percent: 42, speed: '1 MB/s', eta: '00:05' });

    calls[0].finish({ status: 'complete', filePath: '/out/Klip.mp4', fileSize: 2048 });
    await done;
    expect(task(id)).toMatchObject({ status: 'complete', percent: 100, filePath: '/out/Klip.mp4' });
    expect(mocks.addHistory).toHaveBeenCalledWith(expect.objectContaining({
      id, title: 'Klip', quality: '1080p', ext: 'mp4', fileSize: '2.0 KB', filePath: '/out/Klip.mp4',
    }));
    expect(mocks.notify).toHaveBeenCalledWith('Klip');
    expect(mocks.openFileLocation).not.toHaveBeenCalled();
  });

  it('ayni anda en fazla iki indirme calistirir; siradakini iptal etmek onu hic baslatmaz', async () => {
    const calls = controllableDownload();
    const ids = [await addReadyTask('https://v.test/a'), await addReadyTask('https://v.test/b'), await addReadyTask('https://v.test/c')];
    const runs = ids.map((id) => useQueueStore.getState().startDownload(id));
    await flush();
    expect(calls).toHaveLength(2);
    expect(task(ids[2]).status).toBe('queued');

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

  it('oynatma listesini once secime sunar, yalnizca secilen videolari ayni yere ekler', async () => {
    mocks.fetchHistory.mockResolvedValue([{ url: 'https://youtu.be/3' }]);
    mocks.getInfo.mockResolvedValueOnce({
      title: 'Liste',
      url: 'L',
      formats: playlistOptions(),
      entries: [
        { url: 'https://youtu.be/1', title: 'Bir' }, { url: 'https://youtu.be/2', title: 'Iki' }, { url: 'https://youtu.be/3', title: 'Uc' },
      ],
    } satisfies VideoInfo);
    useQueueStore.getState().setUrl('https://www.youtube.com/playlist?list=PL');
    await useQueueStore.getState().analyze();

    // Kuyruga hicbir sey eklenmedi; secim bekleniyor.
    const [pick] = useQueueStore.getState().playlistPicks;
    expect(pick.info.entries).toHaveLength(3);
    expect([...pick.downloaded]).toEqual(['youtu.be/3']);
    expect(useQueueStore.getState().tasks.map((t) => t.status)).toEqual(['analyzing']);

    useQueueStore.getState().confirmPlaylist(pick.taskId, ['https://youtu.be/1', 'https://youtu.be/3']);
    const tasks = useQueueStore.getState().tasks;
    expect(tasks.map((t) => [t.title, t.status, t.playlist])).toEqual([
      ['Bir', 'ready-to-select', 'Liste'],
      ['Uc', 'ready-to-select', 'Liste'],
    ]);
    expect(tasks[1].message).toBe(tr.queue.duplicateInHistory);
    expect(useQueueStore.getState().playlistPicks).toEqual([]);
  });

  it('liste secimi iptal edilince yer tutucu kuyruktan kalkar', async () => {
    mocks.getInfo.mockResolvedValueOnce({ title: 'Liste', url: 'L', formats: [], entries: [{ url: 'u', title: 'X' }] } satisfies VideoInfo);
    useQueueStore.getState().setUrl('https://www.youtube.com/playlist?list=PL');
    await useQueueStore.getState().analyze();
    useQueueStore.getState().dismissPlaylist(useQueueStore.getState().playlistPicks[0].taskId);
    expect(useQueueStore.getState().tasks).toEqual([]);
    expect(useQueueStore.getState().playlistPicks).toEqual([]);
  });

  it('listedeki videodan listenin tamamini ister', async () => {
    const id = await addReadyTask('https://www.youtube.com/watch?v=a&list=PL');
    mocks.getInfo.mockResolvedValueOnce({ title: 'Liste', url: 'L', formats: [], entries: [{ url: 'u', title: 'X' }] });
    await useQueueStore.getState().expandPlaylist(id);
    expect(mocks.getInfo).toHaveBeenLastCalledWith('https://www.youtube.com/watch?v=a&list=PL', expect.objectContaining({ playlist: true }));
    useQueueStore.getState().confirmPlaylist(id, ['u']);
    expect(useQueueStore.getState().tasks.map((t) => t.title)).toEqual(['X']);
  });

  it('cerez ve proxy ayarlarini analize ve indirmeye verir', async () => {
    settings.cookiesFromBrowser = 'firefox';
    settings.proxy = ' socks5://h:1 ';
    settings.rateLimit = '2M';
    const calls = controllableDownload();
    const id = await addReadyTask('https://youtu.be/a');
    expect(mocks.getInfo).toHaveBeenCalledWith('https://youtu.be/a', { cookiesFromBrowser: 'firefox', proxy: 'socks5://h:1' });

    const run = useQueueStore.getState().startDownload(id);
    await flush();
    expect(calls[0].req).toMatchObject({ cookiesFromBrowser: 'firefox', proxy: 'socks5://h:1', rateLimit: '2M' });
    calls[0].finish({ status: 'cancelled' });
    await run;
  });

  it('yukari tasinan siradaki indirme once baslar; ayardaki eszamanlilik uygulanir', async () => {
    settings.maxConcurrentDownloads = 1;
    const calls = controllableDownload();
    const [a, b, c] = [await addReadyTask('https://v.test/a'), await addReadyTask('https://v.test/b'), await addReadyTask('https://v.test/c')];
    // Liste en yeni ustte: c, b, a. Indirmeler a, b, c sirasiyla baslatilir.
    const runs = [a, b, c].map((id) => useQueueStore.getState().startDownload(id));
    await flush();
    expect(calls.map((x) => x.req.url)).toEqual(['https://v.test/a']);
    expect([task(b).status, task(c).status]).toEqual(['queued', 'queued']);

    // b ve c yukari tasininca liste c, b, a olur; siradakiler bu sirayla baslar (FIFO olsaydi b, c).
    useQueueStore.getState().move(b, 'up');
    useQueueStore.getState().move(c, 'up');
    calls[0].finish({ status: 'cancelled' });
    await flush();
    expect(calls.map((x) => x.req.url)).toEqual(['https://v.test/a', 'https://v.test/c']);

    calls[1].finish({ status: 'cancelled' });
    await flush();
    calls[2].finish({ status: 'cancelled' });
    await Promise.all(runs);
    expect(calls.map((x) => x.req.url)).toEqual(['https://v.test/a', 'https://v.test/c', 'https://v.test/b']);
  });

  it('hepsini indir, secim bekleyenleri listedeki sirayla kuyruga alir', async () => {
    settings.maxConcurrentDownloads = 1;
    const calls = controllableDownload();
    await addReadyTask('https://v.test/a');
    await addReadyTask('https://v.test/b');
    const all = useQueueStore.getState().startAll();
    await flush();
    expect(calls.map((x) => x.req.url)).toEqual(['https://v.test/b']);
    calls[0].finish({ status: 'cancelled' });
    await flush();
    calls[1].finish({ status: 'cancelled' });
    await all;
    expect(calls.map((x) => x.req.url)).toEqual(['https://v.test/b', 'https://v.test/a']);
  });

  it('analiz hatasinin ham metnini ayrinti olarak saklar', async () => {
    mocks.getInfo.mockRejectedValueOnce(new EngineError({ message: 'Video gizli.', detail: 'ERROR: Private video' }));
    useQueueStore.getState().setUrl('https://youtu.be/x');
    const id = (await useQueueStore.getState().analyze())!;
    expect(task(id)).toMatchObject({ status: 'error', message: 'Video gizli.', detail: 'ERROR: Private video' });
  });

  it('bitenleri temizler', async () => {
    const id = await addReadyTask('https://v.test/a');
    await useQueueStore.getState().cancel(id);
    await addReadyTask('https://v.test/b');
    useQueueStore.getState().clearFinished();
    expect(useQueueStore.getState().tasks.map((t) => t.url)).toEqual(['https://v.test/b']);
  });

  it('toplu indirmede tek bildirim gonderir, klasoru kendiliginden acmaz', async () => {
    // Eski ayar dosyalarinda kalan secenek artik yok sayilir.
    settings.autoOpenFolder = true;
    const calls = controllableDownload();
    const [a, b] = [await addReadyTask('https://youtu.be/a', 'A'), await addReadyTask('https://youtu.be/b', 'B')];
    const runs = [a, b].map((id) => useQueueStore.getState().startDownload(id));
    await flush();

    calls[0].finish({ status: 'complete', filePath: '/out/A.mp4' });
    await flush();
    expect(mocks.notify).not.toHaveBeenCalled();
    calls[1].finish({ status: 'complete', filePath: '/out/B.mp4' });
    await Promise.all(runs);

    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith('2 indirme tamamlandı.');
    expect(mocks.openFileLocation).not.toHaveBeenCalled();
    delete settings.autoOpenFolder;
  });

  it('kuyrukta ya da gecmiste olan videoyu uyariyla ekler', async () => {
    await addReadyTask('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    const again = await addReadyTask('https://youtu.be/aaaaaaaaaaa');
    expect(task(again).message).toBe(tr.queue.duplicateInQueue);

    mocks.fetchHistory.mockResolvedValue([{ url: 'https://youtu.be/bbbbbbbbbbb' }]);
    const old = await addReadyTask('https://www.youtube.com/watch?v=bbbbbbbbbbb&t=10');
    expect(task(old).message).toBe(tr.queue.duplicateInHistory);
  });

  it('birden fazla linki ayri gorevler olarak sirayla analiz eder', async () => {
    mocks.getInfo.mockResolvedValueOnce(info('Bir')).mockResolvedValueOnce(info('Iki'));
    useQueueStore.getState().setUrl('https://youtu.be/1\nhttps://youtu.be/2https://youtu.be/1');
    await useQueueStore.getState().analyze();
    expect(mocks.getInfo.mock.calls.map((c) => c[0])).toEqual(['https://youtu.be/1', 'https://youtu.be/2']);
    expect(useQueueStore.getState().tasks.map((t) => t.title)).toEqual(['Bir', 'Iki']);
  });

  it('liste klasorunu, bolumu ve altyazi dillerini indirmeye verir', async () => {
    settings.subtitleLangs = 'de';
    mocks.getInfo.mockResolvedValueOnce({
      title: 'Liste', url: 'L', formats: playlistOptions(), entries: [{ url: 'https://youtu.be/1', title: 'Bir' }],
    } satisfies VideoInfo);
    useQueueStore.getState().setUrl('https://www.youtube.com/playlist?list=PL');
    await useQueueStore.getState().analyze();
    useQueueStore.getState().confirmPlaylist(useQueueStore.getState().playlistPicks[0].taskId, ['https://youtu.be/1']);
    const id = useQueueStore.getState().tasks[0].id;
    useQueueStore.getState().setSection(id, { start: 5, end: 20 });

    const calls = controllableDownload();
    let run = useQueueStore.getState().startDownload(id);
    await flush();
    expect(calls[0].req).toMatchObject({ subfolder: 'Liste', section: { start: 5, end: 20 }, subtitleLangs: 'de' });
    calls[0].finish({ status: 'cancelled' });
    await run;

    settings.playlistSubfolder = false;
    run = useQueueStore.getState().startDownload(id);
    await flush();
    expect(calls[1].req.subfolder).toBeUndefined();
    calls[1].finish({ status: 'cancelled' });
    await run;
  });

  it('link olmayan parcalari analiz etmez, kutuda birakir', async () => {
    mocks.getInfo.mockResolvedValueOnce(info('Bir'));
    useQueueStore.getState().setUrl('--exec=rm https://youtu.be/1 merhaba');
    await useQueueStore.getState().analyze();
    expect(mocks.getInfo.mock.calls.map((c) => c[0])).toEqual(['https://youtu.be/1']);
    expect(useQueueStore.getState().url).toBe('--exec=rm merhaba');

    useQueueStore.getState().setUrl('yalnizca metin');
    expect(await useQueueStore.getState().analyze()).toBeNull();
    expect(mocks.getInfo).toHaveBeenCalledTimes(1);
  });

  it('pano metnini kutudakinin uzerine yazmaz', () => {
    useQueueStore.getState().setUrl('https://youtu.be/aaaaaaaaaaa');
    useQueueStore.getState().addClipboardText('bak: https://youtu.be/bbbbbbbbbbb');
    expect(useQueueStore.getState().url).toBe('https://youtu.be/aaaaaaaaaaa https://youtu.be/bbbbbbbbbbb');
  });

  it('kapanista yarida kalan indirmeleri acilista yeniden baslatir', async () => {
    const calls = controllableDownload();
    const base = { title: 'T', percent: 0, speed: '', eta: '', formats: info('T').formats, selectedFormatId: 'video-720' };
    useQueueStore.setState({
      tasks: [
        { ...base, id: 'r1', url: 'https://v.test/a', status: 'ready-to-select', resume: true, message: tr.queue.interrupted },
        { ...base, id: 'n1', url: 'https://v.test/b', status: 'ready-to-select' },
      ],
    });
    const run = useQueueStore.getState().resumeInterrupted();
    await flush();
    expect(calls.map((c) => c.req.url)).toEqual(['https://v.test/a']);
    expect(task('r1')).toMatchObject({ status: 'downloading', resume: undefined, message: undefined });
    expect(task('n1').status).toBe('ready-to-select');
    calls[0].finish({ status: 'cancelled' });
    await run;
  });

  it('duraklatir, yuzdeyi ve yarim dosyayi koruyarak surdurur; duraklatilmisken iptal yarim dosyayi siler', async () => {
    const calls = controllableDownload();
    const id = await addReadyTask('https://youtu.be/a');
    let run = useQueueStore.getState().startDownload(id);
    await flush();
    calls[0].progress({ percent: 40, speed: '1 MB/s', eta: '00:10' });
    await useQueueStore.getState().pause(id);
    expect(mocks.pause).toHaveBeenCalledWith(id);
    calls[0].finish({ status: 'paused', destination: '/out/A.mp4', startedMs: 1000 });
    await run;
    expect(task(id)).toMatchObject({ status: 'paused', percent: 40, speed: '', partial: { destination: '/out/A.mp4', since: 1000 } });
    expect(mocks.notify).not.toHaveBeenCalled();

    run = useQueueStore.getState().resume(id);
    await flush();
    expect(calls[1].req.partialSince).toBe(1000);
    expect(task(id)).toMatchObject({ status: 'downloading', percent: 40 });
    calls[1].finish({ status: 'paused', destination: '/out/A.mp4', startedMs: 1000 });
    await run;

    await useQueueStore.getState().cancel(id);
    expect(task(id).status).toBe('cancelled');
    expect(mocks.discardPartial).toHaveBeenCalledWith('/out/A.mp4', 1000);
  });

  it('siradaki indirme duraklatilinca hic baslamaz', async () => {
    settings.maxConcurrentDownloads = 1;
    const calls = controllableDownload();
    const [a, b] = [await addReadyTask('https://v.test/a'), await addReadyTask('https://v.test/b')];
    const runs = [a, b].map((id) => useQueueStore.getState().startDownload(id));
    await flush();
    await useQueueStore.getState().pause(b);
    expect(task(b).status).toBe('paused');
    calls[0].finish({ status: 'cancelled' });
    await Promise.all(runs);
    expect(calls).toHaveLength(1);
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it('diskte yer yoksa indirmeyi baslatmaz', async () => {
    const calls = controllableDownload();
    const id = await addReadyTask('https://youtu.be/a');
    mocks.freeSpace.mockResolvedValueOnce(50 * 1024 ** 2);
    await useQueueStore.getState().startDownload(id);
    expect(calls).toHaveLength(0);
    expect(mocks.freeSpace).toHaveBeenCalledWith('/out');
    expect(task(id).status).toBe('error');
    expect(task(id).message).toContain('Diskte yeterli boş alan yok');
  });

  it('video basina altyazi ve dosya adi ayardaki varsayilanin yerine gecer', async () => {
    settings.filenameTemplate = 'custom';
    settings.filenameCustom = '{date} {title}';
    const calls = controllableDownload();
    const a = await addReadyTask('https://v.test/a');
    const b = await addReadyTask('https://v.test/b');
    useQueueStore.getState().setVideoOptions(b, { subtitles: false, filenamePattern: '{channel} - {title} [{id}]' });

    const runs = [a, b].map((id) => useQueueStore.getState().startDownload(id));
    await flush();
    expect(calls[0].req).toMatchObject({ subtitles: true, filenamePattern: '{date} {title}' });
    expect(calls[1].req).toMatchObject({ subtitles: false, filenamePattern: '{channel} - {title} [{id}]' });
    calls.forEach((c) => c.finish({ status: 'cancelled' }));
    await Promise.all(runs);
    delete settings.filenameTemplate;
    delete settings.filenameCustom;
  });

  it('listeden secilenleri sira numarasi, ters sira ve tarih suzgeciyle ekler', async () => {
    mocks.getInfo.mockResolvedValueOnce({
      title: 'Liste', url: 'L', formats: playlistOptions(),
      entries: Array.from({ length: 12 }, (_, i) => ({ url: `https://v.test/${i + 1}`, title: `V${i + 1}` })),
    } satisfies VideoInfo);
    useQueueStore.getState().setUrl('https://www.youtube.com/playlist?list=PL');
    await useQueueStore.getState().analyze();
    const [pick] = useQueueStore.getState().playlistPicks;
    useQueueStore.getState().confirmPlaylist(pick.taskId, ['https://v.test/2', 'https://v.test/11'], { reverse: true, dateAfter: '20260101' });
    expect(useQueueStore.getState().tasks.map((t) => [t.title, t.playlistIndex, t.dateAfter])).toEqual([
      ['V11', '11', '20260101'],
      ['V2', '02', '20260101'],
    ]);

    const calls = controllableDownload();
    const run = useQueueStore.getState().startDownload(useQueueStore.getState().tasks[1].id);
    await flush();
    expect(calls[0].req).toMatchObject({ playlistIndex: '02', dateAfter: '20260101' });
    calls[0].finish({ status: 'cancelled' });
    await run;
  });

  it('abonelik secimi yer tutucusuz acilir; kapaninca bildirir', () => {
    const done = vi.fn();
    useQueueStore.getState().offerPick({
      info: { title: 'Kanal', url: 'K', formats: [], entries: [{ url: 'https://v.test/n', title: 'Yeni' }] },
      formatId: undefined, downloaded: new Set(), fresh: new Set(['https://v.test/n']), onDone: done,
    });
    const [pick] = useQueueStore.getState().playlistPicks;
    useQueueStore.getState().confirmPlaylist(pick.taskId, ['https://v.test/n']);
    expect(useQueueStore.getState().tasks.map((t) => t.title)).toEqual(['Yeni']);
    expect(done).toHaveBeenCalledWith(true);
  });
});
