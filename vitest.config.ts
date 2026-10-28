import { defineConfig } from 'vitest/config';

// Playwright testleri (e2e/*.spec.ts) Vitest'te calismaz; ayri komut: npm run test:ui
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
