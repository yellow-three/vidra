import { defineConfig, devices } from '@playwright/test';

// UI akislari Vite dev sunucusuna karsi, sahte Tauri backend'i (e2e/tauri-mock.ts) ile calisir.
// Gercek yt-dlp/ffmpeg ile uctan uca deneme Tauri penceresinde elle yapilir (README).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Arayuz dili sistem dilinden gelir; testler Turkce metinleri bekler.
  use: { baseURL: 'http://localhost:1420', trace: 'retain-on-failure', locale: 'tr-TR' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
  },
});
