import { expect, test, type Page } from '@playwright/test';
import { mockTauri } from './tauri-mock';

const URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const accepted = { legalAccepted: true, autoOpenFolder: false };

const mock = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).__mock[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
const calls = (page: Page, cmd: string) =>
  page.evaluate((c) => (window as any).__mock.state.calls.filter((x: any) => x.cmd === c).map((x: any) => x.args), cmd);

async function analyze(page: Page, url = URL) {
  await page.getByLabel('YouTube linki').fill(url);
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
  await expect(select.locator('option')).toHaveText([/360p/, /240p/, /MP3/, /M4A/]);
  await page.getByRole('button', { name: 'İndir', exact: true }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'progress', 0, 42);
  await expect(page.getByText('%42', { exact: true })).toBeVisible();
  await expect(page.getByText('1.0 MB/s')).toBeVisible();

  await mock(page, 'finish', 0);
  await expect(page.locator('article[data-status="complete"]')).toContainText('Tamamlandı');

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

  await expect(page.getByLabel('YouTube linki')).toBeEnabled();
  await analyze(page, 'https://youtu.be/ikinci');
  await expect(page.getByRole('combobox')).toHaveCount(1);

  await page.getByRole('button', { name: 'İptal Et' }).click();
  await expect(page.locator('article[data-status="cancelled"]')).toContainText('İptal edildi');
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
});

test('oynatma listesi videolarina acilir ve hepsi birden indirilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, 'https://www.youtube.com/playlist?list=PL123');

  await expect(page.getByRole('article', { name: 'Birinci video' })).toContainText('Örnek liste');
  await expect(page.getByRole('article', { name: 'İkinci video' })).toBeVisible();
  await page.getByRole('button', { name: 'Hepsini indir (2)' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.map((d: any) => d.args[0])))
    .toEqual(['https://www.youtube.com/watch?v=a1', 'https://www.youtube.com/watch?v=b2']);
});

test('listedeki bir video tek basina eklenir, istenirse liste acilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page, `${URL}&list=PL123`);
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toBeVisible();

  await page.getByRole('button', { name: 'Listenin tamamını ekle' }).click();
  await expect(page.getByRole('article', { name: 'Birinci video' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Me at the zoo' })).toHaveCount(0);
});

test('cerez, proxy ve kapak ayarlari yt-dlp argumanlarina yansir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
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

  await page.reload();
  const card = page.getByRole('article', { name: 'Me at the zoo' });
  await expect(card).toContainText('kaldığı yerden devam eder');
  await card.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
});

test('panodan gelen link kutuya yazilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Analiz Et' })).toBeVisible();
  await mock(page, 'emit', 'clipboard-link-detected', 'https://youtu.be/panodan');
  await expect(page.getByLabel('YouTube linki')).toHaveValue('https://youtu.be/panodan');
});

test('eksik sidecar durum cubugunda gosterilir ve analiz kapali kalir', async ({ page }) => {
  await mockTauri(page, { settings: accepted, deps: { ytdlp: true, ffmpeg: false, deno: false } });
  await page.goto('/');
  await expect(page.getByText('Eksik bileşen: FFmpeg, deno bulunamadı')).toBeVisible();
  await page.getByLabel('YouTube linki').fill(URL);
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
  await expect(page.getByText('0.1.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Güncel');
  await expect(page.getByRole('link', { name: /Yeni sürüm/ })).toHaveCount(0);
});

test('tema: ayarlardan secilen daisyUI temasi uygulanir ve kaydedilir', async ({ page }) => {
  await mockTauri(page, { settings: { ...accepted, theme: 'vidra-dark' } });
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-dark');

  await page.getByRole('radio', { name: /Vidra Açık/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vidra-light');
  await page.getByRole('radio', { name: /Dracula/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.getByRole('radio', { name: /Dracula/ })).toHaveAttribute('aria-checked', 'true');
  expect(await calls(page, 'save_settings')).toContainEqual({ settings: { theme: 'dracula' } });
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
