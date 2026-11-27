import { expect, test, type Page } from '@playwright/test';
import { game, loadSave } from './helpers';

/** Quick taps on the reserve, in one task: as close as can be, whatever the load. */
const tapReserve = (page: Page, taps: number) =>
  page.locator('#reserve').evaluate((reserve, taps) => {
    for (let i = 0; i < taps; i++) {
      reserve.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
  }, taps);

const saved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{
        settings: unknown[];
        recommended: unknown;
        automation: number;
        longChallenges: boolean;
      }>((resolve) => {
        const request = indexedDB.open('numebois', 1);
        request.onsuccess = () => {
          const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
          get.onsuccess = () => {
            request.result.close();
            resolve(JSON.parse(String(get.result)));
          };
        };
      }),
  );

test('le tableau de bord parent : suivi, réglage des notions, rafale recommandée (#47)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
  const day = await page.evaluate(() =>
    Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000),
  );
  // Nine taps only open the shop; the reload of the save starts the count again.
  await tapReserve(page, 9);
  await expect(page.locator('#reserve')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#parent-menu')).toHaveCount(0);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'normal',
    progress: [
      {
        skill: 'times-tables.products',
        stage: 'learning',
        level: 1,
        recent: [
          { level: 1, right: true, day },
          { level: 1, right: false, day },
        ],
        box: 0,
        due: null,
      },
    ],
    facts: [{ fact: 'times-tables.products:7x8', tries: 3, right: 0, fastDays: [], times: [9000] }],
    history: [],
    plays: [
      { day: day - 1, kind: 'trail', questions: 10, right: 8, ms: 300_000 },
      { day, kind: 'drill', questions: 20, right: 15, ms: 240_000 },
    ],
  });
  // Ten open the menu in place of the shop.
  await tapReserve(page, 10);
  await expect(page.locator('#parent-menu')).toBeVisible();
  await expect(page.locator('#reserve')).toHaveAttribute('aria-pressed', 'false');
  const menu = page.locator('#parent-menu');

  // The progress first: the last days, each notion where it is, the fragile facts.
  await expect(menu.getByRole('button', { name: 'Suivi' })).toHaveAttribute('aria-pressed', 'true');
  await expect(menu.locator('.days tbody tr')).toHaveCount(2);
  await expect(menu.locator('.days tbody tr').first()).toContainText('4 min');
  await expect(menu.locator('.days tbody tr').first()).toContainText('75 %');
  // Each mode, its time per question (#128).
  const modes = menu.locator('.per-mode tbody tr');
  await expect(modes).toHaveCount(2);
  await expect(modes.first()).toHaveText(['Sentier', '10', '30,0 s', '80 %'].join(''));
  await expect(modes.last()).toHaveText(['Rafale', '20', '12,0 s', '75 %'].join(''));
  const products = menu.locator('.progress tr[data-skill="times-tables.products"]');
  await expect(products).toContainText('En cours');
  await expect(products).toContainText('Niveau 2 sur 5');
  await expect(products).toContainText('50 %');
  await expect(menu.locator('.fragile')).toContainText('7 × 8');
  await test.info().attach('suivi', { body: await page.screenshot(), contentType: 'image/png' });

  // The notions: one closed, the tables in focus on their first levels, a table recommended.
  await menu.getByRole('button', { name: 'Notions' }).click();
  const row = (id: string) =>
    menu.locator(`.notions .skills:not(.recommended) tr[data-skill="${id}"]`);
  await row('mental-math.add').getByRole('button', { name: 'Fermée' }).click();
  await row('times-tables.products').getByRole('button', { name: 'Focus' }).click();
  for (let i = 0; i < 3; i++) {
    await row('times-tables.products').getByRole('button', { name: 'Plus haut : moins' }).click();
  }
  await expect(row('times-tables.products').locator('.level')).toHaveText(['1', '2']);
  await test.info().attach('notions', { body: await page.screenshot(), contentType: 'image/png' });
  // The recommended drill, with the homework of the week (#54).
  await menu.getByRole('button', { name: 'Devoirs' }).click();
  await menu
    .locator('.recommended tr[data-skill="times-tables.products"]')
    .getByRole('button', { name: 'La table de 7' })
    .click();
  // Nothing goes past the screen of the tablet.
  const box = (await menu.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  // The speed asked for a fact known by heart and the long challenges (#132), in the settings.
  await menu.getByRole('button', { name: 'Réglages' }).click();
  await menu.getByRole('button', { name: 'Souple' }).click();
  await expect(menu.getByRole('button', { name: 'Non proposés' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await menu.getByRole('button', { name: 'Proposés', exact: true }).click();
  await menu.getByRole('button', { name: 'Fermer' }).click();
  await expect(menu).toHaveCount(0);
  await expect
    .poll(async () => {
      const { settings, recommended, automation, longChallenges } = await saved(page);
      return { settings, recommended, automation, longChallenges };
    })
    .toEqual({
      settings: [
        { skill: 'mental-math.add', mode: 'closed', minLevel: 0, maxLevel: 4 },
        { skill: 'times-tables.products', mode: 'focus', minLevel: 0, maxLevel: 1 },
      ],
      recommended: { skill: 'times-tables.products', group: 'table-7' },
      automation: 1.5,
      longChallenges: true,
    });

  // On the stump's tree, Plume makes the recommended branch glow (#130).
  await page.locator('#stump').click();
  const recommended = page.locator('#drill-tree [data-group="table-7"]');
  await expect(recommended).toHaveClass(/glow/);
  await expect(page.locator('#drill-tree .glow')).toHaveCount(1);
  await recommended.click();
  await expect.poll(async () => (await game(page)).mode).toBe('drill');
  const { exercise } = await game(page);
  expect(exercise!.statement).toMatch(/7/);
  expect(errors).toEqual([]);
});
