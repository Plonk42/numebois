import { expect, test } from '@playwright/test';
import { boxes, game, loadSave, startTrail } from './helpers';

const pair = (a: number, b: number) => `times-tables.products:${Math.min(a, b)}x${Math.max(a, b)}`;
const fact = (id: string, days: number[]) => ({
  fact: id,
  tries: days.length,
  right: days.length,
  fastDays: days,
  times: [2000],
});

test('l’arbre de la rafale : une branche par table, une feuille par fait, la table complète fleurit, une branche lance la rafale (#130)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
  // The table of 2 known by heart, 7 × 8 on its way (2 days out of 3).
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
        level: 3,
        recent: [],
        box: 0,
        due: null,
      },
    ],
    facts: [
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => fact(pair(2, n), [1, 2, 3])),
      fact(pair(7, 8), [4, 5]),
    ],
    history: [],
  });
  // No Carnet any more: the tree is behind the stump.
  await expect(page.getByRole('button', { name: 'Carnet' })).toHaveCount(0);
  const stump = page.getByRole('button', { name: 'Par cœur' });
  await stump.click();
  const tree = page.locator('#drill-tree');
  await expect(tree).toBeVisible();
  await expect(tree.locator('.praise')).toHaveText('Les tables de multiplication');
  await expect(tree.locator('.branch')).toHaveCount(9);
  await expect(tree.locator('.branch.bloom')).toHaveCount(1);
  await expect(tree.locator('[data-group="table-2"]')).toHaveClass(/bloom/);
  await expect(tree.locator('[data-group="table-2"] .leaf.days-3')).toHaveCount(9);
  await expect(tree.locator(`[data-group="table-7"] [data-fact="${pair(7, 8)}"]`)).toHaveClass(
    /days-2/,
  );
  // Plume makes a branch glow: 7 × 8 is on its way, on the tables of 7 and 8; the 7 comes first.
  await expect(tree.locator('.glow')).toHaveCount(1);
  await expect(tree.locator('[data-group="table-7"]')).toHaveClass(/glow/);
  await expect(tree.locator('.bubble')).toHaveText(
    'Choisis une branche. Celle qui brille t’attend\u00a0!',
  );
  // Each branch is a big target, inside the card, and the card inside the screen.
  const [card] = await boxes(page, '#drill-tree');
  expect(card.y + card.height).toBeLessThanOrEqual(800);
  for (const box of await boxes(page, '#drill-tree .branch .touch')) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
    expect(box.x).toBeGreaterThanOrEqual(card.x);
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
  }
  await test.info().attach('arbre', { body: await page.screenshot(), contentType: 'image/png' });
  await tree.getByRole('button', { name: 'Fermer' }).click();
  await expect(tree).toHaveCount(0);
  expect((await game(page)).phase).toBe('walking');

  // Two touches from the walk: the stump, then a branch.
  await stump.click();
  await tree.getByRole('button', { name: 'La table de 8' }).click();
  await expect.poll(async () => (await game(page)).drilling).toBe(true);
  const { exercise } = await game(page);
  expect(exercise!.statement).toMatch(/\b8\b/);
  expect(errors).toEqual([]);
});

test('la souche n’ouvre rien pendant un sentier', async ({ page }) => {
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
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
        level: 3,
        recent: [],
        box: 0,
        due: null,
      },
    ],
    facts: [],
    history: [],
  });
  await startTrail(page);
  await expect(page.locator('#stump')).toHaveClass(/aside/);
  await page.locator('#stump').dispatchEvent('pointerdown');
  await expect(page.locator('#drill-tree')).toHaveCount(0);
});
