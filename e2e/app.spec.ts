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
  await expect(page.getByRole('heading', { name: 'YouTube Downloader' })).toBeVisible();
});

test('analiz, varsayilan format, canli ilerleme ve tamamlanma', async ({ page }) => {
  await mockTauri(page, { settings: { ...accepted, defaultQuality: '240' } });
  await page.goto('/');
  await analyze(page);

  const select = page.getByRole('combobox');
  await expect(select).toHaveValue('video-240');
  await expect(select.locator('option')).toHaveText([/360p/, /240p/, /MP3/, /M4A/]);
  await page.getByRole('button', { name: /İndirmeyi Başlat/ }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'progress', 0, 42);
  await expect(page.getByText('%42 indirildi')).toBeVisible();
  await expect(page.getByText('1.0 MB/s')).toBeVisible();

  await mock(page, 'finish', 0);
  await expect(page.getByText('✓ TAMAMLANDI')).toBeVisible();

  const [args] = await calls(page, 'process_spawn').then((all) => all.filter((a: any) => !a.args.includes('-J')));
  expect(args.program).toBe('yt-dlp');
  expect(args.args).toEqual(expect.arrayContaining(['--js-runtimes', 'deno:/bin/ytd-deno', '--ffmpeg-location', '/bin/ytd-ffmpeg']));
  await expect.poll(() => calls(page, 'plugin:sql|execute').then((c) => c.length)).toBe(1);
});

test('indirme surerken yeni link eklenebilir; iptal edilen indirme iptal gorunur', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: /İndirmeyi Başlat/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);

  await expect(page.getByLabel('YouTube linki')).toBeEnabled();
  await analyze(page, 'https://youtu.be/ikinci');
  await expect(page.getByRole('combobox')).toHaveCount(1);

  await page.getByRole('button', { name: 'İptal Et' }).click();
  await expect(page.getByText('⛔ İPTAL EDİLDİ')).toBeVisible();
});

test('indirme hatasi kartta gosterilir', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/');
  await analyze(page);
  await page.getByRole('button', { name: /İndirmeyi Başlat/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.state.downloads.length)).toBe(1);
  await mock(page, 'fail', 0, 'ERROR: [youtube] Video unavailable');
  await expect(page.getByText('ERROR: [youtube] Video unavailable')).toBeVisible();
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

test('gecmis sayfasi SQLite kayitlarini listeler ve siler', async ({ page }) => {
  await mockTauri(page, {
    settings: accepted,
    history: [{ id: '1', title: 'Eski video', url: 'u', thumbnail: null, format_id: 'audio-mp3', quality: 'MP3', ext: 'mp3', file_size: '3.0 MB', file_path: '/x.mp3', completed_at: 1780000000 }],
  });
  await page.goto('/downloads');
  await expect(page.getByText('Eski video')).toBeVisible();
  await expect(page.getByText('3.0 MB')).toBeVisible();
  await page.getByTitle('Sil').click();
  await expect(page.getByText('Henüz indirme geçmişi yok.')).toBeVisible();
});

test('ayarlar: yt-dlp surumu ve guncelleme', async ({ page }) => {
  await mockTauri(page, { settings: accepted });
  await page.goto('/settings');
  await expect(page.getByText('2026.10.21')).toBeVisible();
  await page.getByRole('button', { name: 'Güncelle' }).click();
  await expect(page.getByText('2026.10.22')).toBeVisible();
  await expect(page.getByText('kullanıcının sorumluluğundadır')).toBeVisible();
});
