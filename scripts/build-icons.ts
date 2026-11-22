/**
 * Renders the application icons from `public/icon.svg` with the browser of Playwright.
 *
 *   npm run icons
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: false });
  await page.close();
}
await browser.close();
console.log('public/icons/icon-192.png, public/icons/icon-512.png');
