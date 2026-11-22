import { expect, test, type Page } from '@playwright/test';

async function sound(page: Page) {
  return page.evaluate(() => window.__numebois!.sound());
}

test('le son attend le premier toucher, se coupe et se met en pause', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0&time=1');
  await page.evaluate(() => window.__numebois!.ready);

  // Nothing before the first touch: no audio context at all.
  expect(await sound(page)).toEqual({ state: 'waiting', context: 'none' });

  await page.mouse.click(640, 500);
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });

  // Hidden tab: paused.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sound(page)).toEqual({ state: 'paused', context: 'suspended' });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });

  // The button turns it off, and the choice is kept for the next visit.
  const button = page.locator('#sound-toggle');
  await expect(button).toHaveAttribute('aria-label', 'Couper le son');
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(56);
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Remettre le son');
  await expect.poll(() => sound(page)).toEqual({ state: 'muted', context: 'suspended' });
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await page.mouse.click(640, 500);
  expect(await sound(page)).toEqual({ state: 'muted', context: 'none' });
  await page.locator('#sound-toggle').click();
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });
  expect(errors).toEqual([]);
});
