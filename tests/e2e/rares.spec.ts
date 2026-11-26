import { expect, test } from '@playwright/test';
import { game, loadSave } from './helpers';

test('les éléments rares : les castors achetés en graines dorées remplissent leur lac (#46)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3&name=');
  await page.evaluate(() => window.__numebois!.ready);
  // Stage 7, the fireflies and the rainbow already there: the beavers are on sale.
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 5,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 7,
      season: 'summer',
      seasons: ['summer', 'autumn', 'winter', 'spring'],
      night: 'owned',
      elements: Array.from({ length: 11 }, (_, slot) => ({ slot, day: 1 })),
      animals: ['Deer', 'Fox', 'Stag'],
      rares: ['fireflies', 'rainbow'],
    },
    progress: [],
    facts: [],
    history: [],
  });
  await page.evaluate(() => window.__numebois!.ready);
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  expect((await describe()).rares).toEqual(['fireflies', 'rainbow']);

  // Between two trails, a touch on the reserve opens the shop.
  await expect(page.locator('#reserve')).toHaveClass(/ready/);
  await page.locator('#reserve').click();
  const shop = page.locator('#shop .articles');
  const beavers = shop.getByRole('button', { name: 'Des castors, 2 graines dorées' });
  await expect(beavers).toBeEnabled();
  await expect(beavers.locator('svg.rare-icon')).toBeVisible();
  await expect(shop.getByRole('button', { name: /^Des lucioles/ })).toHaveCount(0);

  // The announcement is short and the page busy under the veil: an observer keeps what showed.
  await page.evaluate(() => {
    const doc = globalThis.document;
    const seen: string[] = [];
    Object.assign(window, { seen });
    new MutationObserver(() => {
      const text = doc.querySelector('#arrival')?.textContent;
      if (text && !seen.includes(text)) seen.push(text);
    }).observe(doc.body, { childList: true, subtree: true, characterData: true });
  });
  await beavers.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen))
    .toEqual(['Les castors arrivent !']);
  await expect
    .poll(async () => (await describe()).rares)
    .toEqual(['fireflies', 'rainbow', 'beavers']);
  await expect(page.locator('#arrival')).toHaveCount(0, { timeout: 15_000 });
  expect((await game(page)).seeds).toBe(3);
  await expect(shop.getByRole('button', { name: /^Des castors/ })).toHaveCount(0);

  // The beavers stay in the painting, once written.
  const saved = () =>
    page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const request = indexedDB.open('numebois', 1);
          request.onsuccess = () => {
            const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
            get.onsuccess = () => {
              request.result.close();
              resolve(JSON.parse(String(get.result)).painting.rares);
            };
          };
        }),
    );
  await expect.poll(saved).toEqual(['fireflies', 'rainbow', 'beavers']);
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect((await describe()).rares).toEqual(['fireflies', 'rainbow', 'beavers']);
  expect(errors).toEqual([]);
});
