import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { ASSET_FILE } from './src/scene/assets.gen.ts';

export default defineConfig({
  base: '/numebois/',
  define: {
    // Without the optimised KayKit models (CI, fresh clone), the scene uses placeholders.
    __KAYKIT_ASSETS__: JSON.stringify(existsSync(`public/${ASSET_FILE}`)),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
