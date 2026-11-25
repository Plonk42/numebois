import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Target: Lenovo Tab M10 Gen 3 (no preset); Android tablet user agent and touch from this one.
const tablet = devices['Galaxy Tab S4'];

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  // Waits on a state the page reaches by itself (praise, answer shown, golden seed): the
  // outcome never depends on time, only how long a loaded machine takes to get there.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/numebois/`,
    launchOptions: {
      // WebGL without a GPU (CI): software rendering.
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'tablet-landscape',
      use: { ...tablet, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/numebois/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
