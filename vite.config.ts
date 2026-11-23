import { existsSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { ANIMAL_FILE } from './src/scene/animals.gen.ts';
import { ASSET_FILE } from './src/scene/assets.gen.ts';

export default defineConfig({
  base: '/numebois/',
  define: {
    // Without the optimised KayKit models (CI, fresh clone), the scene uses placeholders.
    __KAYKIT_ASSETS__: JSON.stringify(existsSync(`public/${ASSET_FILE}`)),
    __ANIMAL_ASSETS__: JSON.stringify(existsSync(`public/${ANIMAL_FILE}`)),
  },
  plugins: [
    VitePWA({
      // A new version waits in the background and takes over at the next launch, never
      // in the middle of a session: no skipWaiting, no reload prompt.
      registerType: 'prompt',
      injectRegister: 'script',
      includeManifestIcons: false,
      manifest: {
        name: 'Numebois',
        short_name: 'Numebois',
        description: 'Chaque calcul réussi fait grandir ta forêt.',
        lang: 'fr',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#9ed0ee',
        theme_color: '#9ed0ee',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb}'],
        // Only Vite's hashed bundles skip revisioning: the models keep a fixed name.
        dontCacheBustURLsMatching: /-[\w-]{8}\.(js|css)$/,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
