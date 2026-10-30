import { expect, test, type Page } from '@playwright/test';
import { mockTauri } from './tauri-mock';
import { RELEASES } from '../src/features/whatsNew/releases';

const URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const accepted = { legalAccepted: true };

const mock = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__mock[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
const calls = (page: Page, cmd: string) =>
  page.evaluate((c) => (window as any).__mock.state.calls.filter((x: any) => x.cmd === c).map((x: any) => x.args), cmd);

async function analyze(page: Page, url = URL) {
  await page.getByLabel('Video linki').fill(url);
  await page.getByRole('button', { name: 'Analiz Et' }).click();
}

test('ilk acilista hukuki not gosterilir ve kabul kaydedilir', async ({ page }) => {
  await mockTauri(page);
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Kullanım koşulları' });
  await expect(dialog).toContainText('kullanıcının sorumluluğundadır');
  await dialog.getByRole('button', { name: /kabul ediyorum/ }).click();
  await expect(dialog).toBeHidden();
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { legalAccepted: true } });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'İndir', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('analiz, varsayilan format, canli ilerleme ve tamamlanma', async ({ page }) => {
  await mockTauri(page, { settings: { ...accepted, defaultQuality: '240' } });
  await page.goto('/');
  await analyze(page);

  const select = page.getByRole('combobox');
  await expect(select).toHaveValue('video-240');
  await expect(select.locator('option')).toHaveText([
    /^★ En iyi kalite · en iyi video \(360p\) \+ en iyi ses/, /^★ En iyi ses · en iyi ses · dönüştürmesiz/,
    /360p/, /240p/, /MP3/, /M4A/, /^OPUS/, /^FLAC/, /^WAV/,
    // yt-dlp'nin tum formatlari, en iyiden kotuye.
    /^360p · mp4 · ★ en iyi · avc1 · en iyi sesle/, /^240p · mp4/, /^Ses · m4a · ★ en iyi · mp4a · yalnız ses/,
  ]);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'progress', 0, 42);
  await expect(page.getByText('%42', { exact: true })).toBeVisible();
  await expect(page.getByText('1.0 MB/s')).toBeVisible();

  await mock(page, 'finish', 0);
  const done = page.locator('article[data-status="complete"]');
  await expect(done).toContainText('Tamamlandı');
  // Klasor kendiliginden acilmaz; kartteki dugmeyle acilir.
  expect(await calls(page, 'open_file_location')).toHaveLength(0);
  await done.getByRole('button', { name: 'Klasörü aç' }).click();
  await expect.poll(() => calls(page, 'open_file_location').then((c) => c.length)).toBe(1);

  const [args] = await calls(page, 'process_spawn').then((all) => all.filter((a: any) => !a.args.includes('-J')));
  expect(args.program).toBe('yt-dlp');
  expect(args.args).toEqual(expect.arrayContaining(['--js-runtimes', 'deno:/bin/ytd-deno', '--ffmpeg-location', '/bin/ytd-ffmpeg']));
  await expect.poll(() => calls(page, 'plugin:sql|execute').then((c) => c.length)).toBe(1);
});

test('indirme surerken yeni link eklenebilir; iptal edilen indirme iptal gorunur', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);

  await expect(page.getByLabel('Video linki')).toBeEnabled();
  await analyze(page, 'https://youtu.be/ikinci');
  await expect(page.getByRole('combobox')).toHaveCount(1);

  await page.getByRole('button', { name: 'İptal Et' }).click();
  await expect(page.locator('article[data-status="cancelled"]')).toContainText('İptal edildi');
});

test('indirme duraklatilir ve kaldigi yerden surdurulur', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'progress', 0, 42);

  const card = page.getByRole('article', { name: 'Me at the zoo' });
  await card.getByRole('button', { name: 'Duraklat' }).click();
  await expect(card).toContainText('Duraklatıldı');
  await expect(card).toContainText('%42');
  await expect.poll(() => calls(page, 'process_kill').then((c) => c.length)).toBe(1);
  // Yarim dosya silinmez.
  expect(await calls(page, 'plugin:fs|remove')).toHaveLength(0);

  await card.getByRole('button', { name: 'Devam et' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(2);
  await expect(card).toContainText('İndiriliyor');
});

test('diskte yer yoksa indirme baslamaz ve neden gosterilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, freeSpace: 10 * 1024 ** 2 });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Diskte yeterli boş alan yok');
  expect(await page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(0);
});

test('altyazi ve dosya adi her video icin ayri secilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  const card = page.getByRole('article', { name: 'Me at the zoo' });
  await card.getByRole('button', { name: 'Seçenekler' }).click();
  await card.getByRole('checkbox', { name: /Altyazıları göm/ }).check();
  await card.getByRole('combobox', { name: 'Dosya adı' }).selectOption('custom');
  const custom = card.getByRole('textbox', { name: 'Özel dosya adı kalıbı' });
  await custom.fill('video');
  await expect(card.getByText('En az bir alan ekleyin')).toBeVisible();
  await custom.fill('{channel} - ');
  await card.getByRole('group', { name: 'Alan ekle' }).getByRole('button', { name: '+ Başlık' }).click();
  await expect(card.getByText('Örnek: Kanal - Me at the zoo [1080p]')).toBeVisible();

  await card.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  const args: string[] = await page.evaluate(() => (window as any).__mock.state.downloads[0].args);
  expect(args).toContain('--embed-subs');
  expect(args.join(' ')).toContain('%(channel,uploader,uploader_id)s - %(title)s [%(height)sp].%(ext)s');
});

test('tarayici eklentisinin vidra:// linki analiz edilir, MP3 secilir ama indirme baslamaz', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deepLink: `vidra://download?url=${encodeURIComponent(URL)}&mode=mp3` });
  await page.goto('/settings');
  // Link gelince indirme sayfasina gecilir.
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Format' })).toHaveValue('audio-mp3');
  expect(await page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(0);
});

test('indirme hatasi kartta gosterilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'fail', 0, 'ERROR: [youtube] Video unavailable');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Video kullanılamıyor');
  await alert.getByText('Ayrıntı').click();
  await expect(alert.getByText('ERROR: [youtube] Video unavailable')).toBeVisible();

  // Hata kayda yazilir; "Hata bildir" dolu bir GitHub issue taslagi acar.
  const logged = await calls(page, 'plugin:log|log');
  expect(logged.map((c: any) => c.message).join('\n')).toContain('ERROR: [youtube] Video unavailable');
  await alert.getByRole('button', { name: 'Hata bildir' }).click();
  await expect.poll(() => calls(page, 'plugin:opener|open_url').then((c) => c.length)).toBe(1);
  const [{ url }] = await calls(page, 'plugin:opener|open_url');
  expect(url).toContain('https://github.com/yellow-three/vidra/issues/new?');
  expect(new globalThis.URL(url).searchParams.get('output')).toContain('ERROR: [youtube] Video unavailable');
});

test('oynatma listesi videolarina acilir ve hepsi birden indirilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, 'https://www.youtube.com/playlist?list=PL123');

  // Liste dogrudan eklenmez: pencere videolari gosterir, secilenler eklenir.
  const dialog = page.getByRole('dialog', { name: 'Örnek liste' });
  await expect(dialog).toContainText('2 videoluk bir oynatma listesi');
  await expect(page.getByRole('article', { name: 'Birinci video' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Seçimi kaldır' }).click();
  await expect(dialog.getByRole('button', { name: 'Video seçin' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Tümünü seç' }).click();
  await dialog.getByRole('button', { name: '2 videoyu ekle' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByRole('article', { name: 'Birinci video' })).toContainText('Örnek liste');
  await expect(page.getByRole('article', { name: 'İkinci video' })).toBeVisible();
  await page.getByRole('button', { name: 'Hepsini indir (2)' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.map((d: any) => d.args[d.args.length - 1])))
    .toEqual(['https://www.youtube.com/watch?v=a1', 'https://www.youtube.com/watch?v=b2']);
});

test('listedeki bir video tek basina eklenir, istenirse liste acilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, `${URL}&list=PL123`);
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toBeVisible();

  await page.getByRole('button', { name: 'Listenin tamamını ekle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Örnek liste' });
  await dialog.getByRole('checkbox', { name: 'İkinci video' }).uncheck();
  await dialog.getByRole('button', { name: '1 videoyu ekle' }).click();
  await expect(page.getByRole('article', { name: 'Birinci video' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'İkinci video' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toHaveCount(0);
});

test('liste penceresinde secim araclari; liste takip edilir ve abonelikte yeni video yok', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, 'https://www.youtube.com/playlist?list=PL123');
  const dialog = page.getByRole('dialog', { name: 'Örnek liste' });
  await dialog.getByRole('checkbox', { name: 'Ters sırada ekle' }).check();
  await dialog.getByRole('checkbox', { name: 'Bu listeyi takip et' }).check();
  await dialog.getByRole('button', { name: '2 videoyu ekle' }).click();
  // Ters sirada: ikinci video ustte.
  await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', 'İkinci video');

  await page.getByRole('link', { name: 'Abonelikler' }).click();
  await expect(page.getByRole('list', { name: 'Abonelikler' })).toContainText('Örnek liste');
  await page.getByRole('button', { name: 'Kontrol et', exact: true }).click();
  await expect(page.getByText('Yeni video yok.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('liste secim penceresinde vazgecilirse hicbir sey eklenmez', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, 'https://www.youtube.com/playlist?list=PL123');
  const dialog = page.getByRole('dialog', { name: 'Örnek liste' });
  await dialog.getByRole('searchbox', { name: 'Listede ara' }).fill('ikinci');
  await expect(dialog.getByRole('list').getByRole('checkbox')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('kuyrukta arar, duruma gore suzer ve secilenleri toplu duraklatir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, 'https://www.youtube.com/playlist?list=PL123');
  await page.getByRole('dialog').getByRole('button', { name: '2 videoyu ekle' }).click();
  await analyze(page);
  await expect(page.getByRole('article')).toHaveCount(3);

  await page.getByRole('searchbox', { name: 'Kuyrukta ara' }).fill('ikinci');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Kuyrukta ara' }).fill('');

  await page.getByRole('button', { name: 'Hepsini indir (3)' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(2);
  await page.getByRole('button', { name: 'Tümünü duraklat' }).click();
  await expect(page.locator('article[data-status="paused"]')).toHaveCount(3);

  // Istatistik kutusu filtre olarak calisir.
  await page.getByRole('group', { name: 'Duruma göre süz' }).getByRole('button', { name: /İniyor/ }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText('Aramaya ya da filtreye uyan indirme yok.')).toBeVisible();
  await page.getByRole('button', { name: 'Filtreyi kaldır' }).click();

  await page.getByRole('article', { name: 'Birinci video' }).getByRole('checkbox', { name: 'Seç' }).check();
  await page.getByRole('toolbar', { name: 'Kuyruk işlemleri' }).getByRole('button', { name: 'Devam et' }).click();
  await expect(page.locator('article[data-status="paused"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Tümünü sürdür (2)' }).click();
  await expect(page.locator('article[data-status="paused"]')).toHaveCount(0);
});

test('cerez, proxy ve kapak ayarlari yt-dlp argumanlarina yansir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Ağ ve hesap' }).click();
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Firefox' }) }).selectOption('firefox');
  const proxy = page.getByLabel('Proxy');
  await proxy.fill('ftp://yanlis');
  await expect(page.getByText('ile başlamalı')).toBeVisible();
  await proxy.fill('socks5://127.0.0.1:1080');
  await proxy.press('Enter');
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { proxy: 'socks5://127.0.0.1:1080' } });

  await page.getByRole('link', { name: 'İndir' }).click();
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);

  const spawned = (await calls(page, 'process_spawn')).map((a: any) => a.args.join(' '));
  expect(spawned[0]).toContain('-J --flat-playlist --no-playlist --cookies-from-browser firefox --proxy socks5://127.0.0.1:1080');
  expect(spawned[1]).toContain('--embed-thumbnail --embed-metadata');
  expect(spawned[1]).toContain('[%(height)sp].%(ext)s');
});

test('kapanista yarida kalan indirme acilista devam ettirilebilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vidra.queue.v1') ?? '')).toContain('"downloading"');

  // Yeniden acilista bilesenler hazir oldugu icin indirme kendiliginden yeniden baslar.
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toContainText('İndiriliyor');
});

test('bilesen eksikken yarida kalan indirme beklenir ve elle surdurulur', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vidra.queue.v1') ?? '')).toContain('"downloading"');

  // Ayni tarayici baglami: kuyruk localStorage'da kalir, yeni sayfada yt-dlp kurulu degil.
  const next = await page.context().newPage();
  await mockTauri(next, { settings: accepted, deps: { ytdlp: false, ffmpeg: true, deno: true } });
  await next.goto('/');
  await expect(next.getByRole('article', { name: 'Me at the zoo' })).toContainText('kaldığı yerden devam eder');
  expect(await next.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(0);
});

test('panodan gelen link kutuya yazilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Analiz Et' })).toBeVisible();
  await mock(page, 'emit', 'clipboard-link-detected', 'https://youtu.be/panodan');
  await expect(page.getByLabel('Video linki')).toHaveValue('https://youtu.be/panodan');
  // Varsayilan: yalnizca YouTube linkleri.
  await mock(page, 'emit', 'clipboard-link-detected', 'https://vimeo.com/1');
  await expect(page.getByLabel('Video linki')).toHaveValue('https://youtu.be/panodan');
});

test('pano izleme ayardan tum linklere acilir ya da kapatilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  const mode = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Tüm linkler' }) });
  await mode.selectOption('all');
  await page.getByRole('link', { name: 'İndir' }).click();
  await mock(page, 'emit', 'clipboard-link-detected', 'bak https://vimeo.com/1');
  await expect(page.getByLabel('Video linki')).toHaveValue('https://vimeo.com/1');

  await page.getByRole('link', { name: 'Ayarlar' }).click();
  await mode.selectOption('off');
  await expect.poll(() => calls(page, 'stop_clipboard_monitor').then((c) => c.length)).toBe(1);
  await page.getByRole('link', { name: 'İndir' }).click();
  await expect(page.getByText('Pano izleniyor')).toHaveCount(0);
});

test('eksik sidecar durum cubugunda gosterilir ve analiz kapali kalir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deps: { ytdlp: true, ffmpeg: false, deno: false } });
  await page.goto('/');
  await expect(page.getByText('Eksik bileşen: FFmpeg, deno. Ayarlar > Sistem bölümünden indirin.')).toBeVisible();
  await page.getByLabel('Video linki').fill(URL);
  await expect(page.getByRole('button', { name: 'Hazırlanıyor...' })).toBeDisabled();
});

test('videonun yalnizca secilen bolumu indirilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: 'Bölüm seç' }).click();
  await page.getByLabel('Başlangıç').fill('0:10');
  await page.getByLabel('Bitiş').fill('0:05');
  await page.getByLabel('Başlangıç').click();
  await expect(page.getByText('Bitiş, başlangıçtan sonra olmalı.')).toBeVisible();
  await page.getByLabel('Bitiş').fill('1:00');
  await page.getByLabel('Başlangıç').click();
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);

  const spawned = (await calls(page, 'process_spawn')).map((a: any) => a.args.join(' '));
  expect(spawned[1]).toContain('--download-sections *10-60');
  expect(spawned[1]).toContain('[00.10-01.00].%(ext)s');
});

test('gecmis sayfasi SQLite kayitlarini listeler ve siler', async ({ page }) => {
  await mockTauri(page, {
    settings: accepted,
    history: [{ id: '1', title: 'Eski video', url: 'u', thumbnail: null, format_id: 'audio-mp3', quality: 'MP3', ext: 'mp3', file_size: '3.0 MB', file_path: '/x.mp3', completed_at: 1780000000 }],
  });
  await page.goto('/downloads');
  await expect(page.getByText('Eski video')).toBeVisible();
  await expect(page.getByText('3.0 MB')).toBeVisible();
  await page.getByRole('button', { name: 'Geçmişten sil' }).click();
  await expect(page.getByText('Henüz indirme geçmişi yok.')).toBeVisible();
});

test('gecmiste arar, silinmis dosyayi isaretler, yeniden indirir', async ({ page }) => {
  const row = (id: string, title: string, path: string) => ({
    id, title, url: URL, thumbnail: null, format_id: 'audio-mp3', quality: 'MP3', ext: 'mp3', file_size: '1 MB', file_path: path, completed_at: 1780000000,
  });
  await mockTauri(page, {
    settings: accepted,
    history: [row('1', 'Kedi videosu', '/kedi.mp3'), row('2', 'Köpek videosu', '/silinmis/kopek.mp3')],
  });
  await page.goto('/downloads');

  const dog = page.getByRole('listitem').filter({ hasText: 'Köpek videosu' });
  await expect(dog.getByText('Dosya bulunamadı')).toBeVisible();
  await expect(dog.getByRole('button', { name: 'Oynat' })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'Kedi videosu' }).getByText('Dosya bulunamadı')).toHaveCount(0);

  await page.getByLabel('Geçmişte ara').fill('KEDİ');
  await expect(page.getByText('Köpek videosu')).toHaveCount(0);
  await expect(page.getByText('Kedi videosu')).toBeVisible();

  await page.getByRole('listitem').filter({ hasText: 'Kedi videosu' }).getByRole('button', { name: 'Yeniden indir' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Bu video daha önce indirildi')).toBeVisible();
});

test('ayarlar: yt-dlp surumu ve guncelleme', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Sistem' }).click();
  await expect(page.getByText('2026.10.21')).toBeVisible();
  await page.getByRole('button', { name: 'Güncelle', exact: true }).click();
  await expect(page.getByText('2026.10.22')).toBeVisible();
  await expect(page.getByText('kullanıcının sorumluluğundadır')).toBeVisible();
});

test('uygulama guncellemesi: durum cubugunda haber verir, ayarlardan kurulup yeniden baslatir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, update: { version: '0.2.0', body: 'Playlist desteği' } });
  await page.goto('/');
  await page.getByRole('link', { name: /Yeni sürüm 0.2.0 hazır/ }).click();

  await expect(page.getByRole('status')).toHaveText('Yeni sürüm: 0.2.0');
  await expect(page.getByText('Playlist desteği')).toBeVisible();
  await page.getByRole('button', { name: 'İndir ve yeniden başlat' }).click();
  await expect.poll(() => calls(page, 'plugin:process|restart').then((c) => c.length)).toBe(1);
  expect(await calls(page, 'plugin:updater|download_and_install')).toEqual([expect.objectContaining({ rid: 99 })]);
});

test('uygulama guncel ise surum ve durum gosterilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Sistem' }).click();
  await expect(page.getByText('0.1.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Güncel');
  await expect(page.getByRole('link', { name: /Yeni sürüm/ })).toHaveCount(0);
});

test('tema: ayarlardan secilen daisyUI temasi uygulanir ve kaydedilir', async ({ page }) => {
  await mockTauri(page, { settings: { ...accepted, theme: 'vidra-dark' } });
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-dark');

  await page.getByRole('button', { name: 'Temayı değiştir' }).click();
  await page.getByRole('radio', { name: /Vidra Açık/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-light');
  await page.getByRole('radio', { name: /Dracula/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.getByRole('radio', { name: /Dracula/ })).toHaveAttribute('aria-checked', 'true');
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { theme: 'dracula' } });
});

test('sistem temasinda acik ve koyu mod icin secilen temalar kullanilir; yenilikler penceresi acilir', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockTauri(page, { settings: { ...accepted, theme: 'system', themeDark: 'dracula' } });
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Night' }) }).selectOption('night');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-light');

  await page.getByRole('tab', { name: 'Sistem' }).click();
  await page.getByRole('button', { name: 'Bu sürümde neler var' }).click();
  // Ayarlardan acilinca guncel surumun notlari gelir; metin her surumde degistigi icin kaynaktan alinir.
  await expect(page.getByRole('dialog', { name: /yenilikler/ })).toContainText(RELEASES[0].notes.tr[0].title);
});

test('tema: sistem secimi isletim sistemine gore YouTube temasini kullanir', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-dark');
});

test('tema: kenar cubugundaki dugme acik/koyu Vidra temalari arasinda gecer', async ({ page }) => {
  await mockTauri(page, { settings: { ...accepted, theme: 'vidra-dark' } });
  await page.goto('/');
  await page.getByLabel('Açık temaya geç').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-light');
  await page.getByLabel('Koyu temaya geç').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-dark');
});

test('dil: sistem dili Ingilizceyse arayuz Ingilizce, ayardan Turkceye gecer', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible();
  await expect(page.getByText('Download video or audio from YouTube and the hundreds of sites yt-dlp supports.')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Türkçe' }) }).selectOption('tr');
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { language: 'tr' } });
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await context.close();
});

test('SponsorBlock: ffprobe indirilince secilir ve indirmeye eklenir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'İndirme' }).click();
  await expect(page.getByText('SponsorBlock için ffprobe gerekir')).toBeVisible();
  await page.getByRole('button', { name: 'ffprobe\'u indir ve kur' }).click();
  await expect(page.getByText('ffprobe kurulu.')).toBeVisible();

  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Videodan kes' }) }).selectOption('remove');
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { sponsorBlock: 'remove' } });

  await page.getByRole('link', { name: 'İndir' }).click();
  await analyze(page);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  const spawned = (await calls(page, 'process_spawn')).map((a: any) => a.args.join(' '));
  expect(spawned[1]).toContain('--sponsorblock-remove sponsor,selfpromo,interaction');
});

test('kurulum ekrani eksik bilesenleri sirayla indirir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deps: { ytdlp: false, ffmpeg: false, deno: false } });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Kurulum' });
  await expect(dialog.getByRole('listitem')).toHaveText([/yt-dlp/, /deno/, /FFmpeg/]);
  await expect(dialog.getByRole('button', { name: 'Şimdilik atla' })).toHaveCount(0);
  await expect(page.getByText(/Eksik bileşen: yt-dlp, FFmpeg, deno/)).toBeVisible();

  await dialog.getByText('Ağ ayarları').click();
  await dialog.getByLabel('Proxy (isteğe bağlı)').fill('bozuk adres');
  await expect(dialog.getByRole('button', { name: 'İndir ve kur' })).toBeDisabled();
  await dialog.getByLabel('Proxy (isteğe bağlı)').fill('http://127.0.0.1:8080');
  await dialog.getByLabel(/SponsorBlock desteğini de kur/).check();
  await dialog.getByRole('button', { name: 'İndir ve kur' }).click();

  await expect(dialog).toBeHidden();
  const installs = (await calls(page, 'install_tool')).map((a: any) => [a.tool, a.withFfprobe, a.proxy]);
  expect(installs).toEqual([
    ['yt-dlp', false, 'http://127.0.0.1:8080'],
    ['deno', false, 'http://127.0.0.1:8080'],
    ['ffmpeg', true, 'http://127.0.0.1:8080'],
  ]);
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { proxy: 'http://127.0.0.1:8080' } });
  await expect(page.getByText('Sistem hazır.')).toBeVisible();
});

test('kurulum hatasinda tekrar denenir, kurulanlar yeniden inmez', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deps: { ytdlp: false, ffmpeg: false, deno: false }, failInstall: 'deno' });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Kurulum' });
  await dialog.getByRole('button', { name: 'İndir ve kur' }).click();
  await expect(dialog.getByText('Kurulamadı: İndirilemedi: bağlantı kesildi')).toBeVisible();
  await dialog.getByRole('button', { name: 'Tekrar dene' }).click();
  await expect(dialog).toBeHidden();
  expect((await calls(page, 'install_tool')).map((a: any) => a.tool)).toEqual(['yt-dlp', 'deno', 'deno', 'ffmpeg']);
});

test('yalnizca surumu eskiyen bilesen varsa kurulum atlanabilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, outdated: ['deno'] });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Kurulum' });
  await expect(dialog).toContainText('Uygulama güncellendi');
  await dialog.getByRole('button', { name: 'Şimdilik atla' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Sistem hazır.')).toBeVisible();
  expect(await calls(page, 'install_tool')).toEqual([]);

  await page.getByRole('link', { name: 'Ayarlar' }).click();
  await page.getByRole('tab', { name: 'Sistem' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'deno' });
  await expect(row).toContainText('Yeni sürümü indirilmeli');
  await row.getByRole('button', { name: 'İndir' }).click();
  await expect(row).toContainText('İndirildi');
  expect((await calls(page, 'install_tool')).map((a: any) => a.tool)).toEqual(['deno']);
});

test('sistemde bulunan FFmpeg indirilmez, istenirse yine de indirilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deps: { ytdlp: false, ffmpeg: false, deno: false }, system: ['ffmpeg', 'ffprobe'] });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Kurulum' });
  await expect(dialog.getByRole('listitem').filter({ hasText: 'FFmpeg' })).toContainText('Sistemde bulundu');
  await expect(dialog.getByText(/SponsorBlock desteğini de kur/)).toHaveCount(0);
  await expect(dialog).toContainText('Toplam yaklaşık 80 MB');
  await dialog.getByRole('button', { name: 'İndir ve kur' }).click();
  await expect(dialog).toBeHidden();
  expect((await calls(page, 'install_tool')).map((a: any) => a.tool)).toEqual(['yt-dlp', 'deno']);

  await page.getByRole('link', { name: 'Ayarlar' }).click();
  await page.getByRole('tab', { name: 'Sistem' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'FFmpeg' });
  await expect(row).toContainText('Sistemde bulundu');
  // SponsorBlock bolumu Indirme sekmesinde; sistemdeki ffprobe kaldirilamaz.
  await page.getByRole('tab', { name: 'İndirme' }).click();
  await expect(page.getByText('ffprobe kurulu.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kaldır' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Sistem' }).click();
  await row.getByRole('button', { name: 'Yine de indir' }).click();
  await expect(row).toContainText('İndirildi');
  expect((await calls(page, 'install_tool')).at(-1)).toMatchObject({ tool: 'ffmpeg', withFfprobe: true });
});
