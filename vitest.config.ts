import { defineConfig } from 'vitest/config';

// Playwright testleri (e2e/*.spec.ts) Vitest'te calismaz; ayri komut: npm run test:ui
export default defineConfig({
  // Testler Turkce metinleri bekler; sistem dili ne olursa olsun.
  test: { include: ['src/**/*.test.ts'], setupFiles: ['src/test-setup.ts'] },
});
