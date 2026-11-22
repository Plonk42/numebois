import { expect, test } from '@playwright/test';

test('installable et utilisable sans réseau après une première visite', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=6&time=1');
  await page.evaluate(() => window.__numebois!.ready);

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    return (await fetch(link.href)).json();
  });
  expect(manifest).toMatchObject({ display: 'fullscreen', orientation: 'landscape' });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('512x512');

  // The service worker precaches the application and the models during the first visit.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto('./?stage=11&time=1');
  await page.evaluate(() => window.__numebois!.ready);
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.placeholders).toBe(false);
  expect(counters.trees).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
