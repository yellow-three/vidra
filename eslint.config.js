// ESLint: TypeScript + React hook kurallari. CI'da `npm run lint` ile calisir.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri', 'test-results', 'playwright-report', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `_` ile baslayan degiskenler bilerek kullanilmiyor (orn. ayiklanan alanlar).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Sahte Tauri backend'i ve testler window uzerindeki tipsiz nesnelerle calisir.
    files: ['e2e/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
