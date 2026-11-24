import { expect, test } from '@playwright/test';
import { game, loadSave, startTrail } from './helpers';

const pair = (a: number, b: number) => `times-tables.products:${Math.min(a, b)}x${Math.max(a, b)}`;
const fact = (id: string, days: number[]) => ({
  fact: id,
  tries: days.length,
  right: days.length,
  fastDays: days,
  times: [2000],
});

test('le Carnet : l’arbre des tables, une feuille par fait, la table complète fleurit', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // The table of 2 known by heart, 7 × 8 on its way (2 days out of 3).
  await loadSave(page, {
    version: 5,
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
  await page.getByRole('button', { name: 'Carnet' }).click();
  const carnet = page.locator('#carnet');
  await expect(carnet).toBeVisible();
  await expect(carnet.locator('.instruction')).toHaveText('Les tables de multiplication');
  await expect(carnet.locator('.branch')).toHaveCount(9);
  await expect(carnet.locator('.branch.bloom')).toHaveCount(1);
  await expect(carnet.locator('[data-group="table-2"]')).toHaveClass(/bloom/);
  await expect(carnet.locator('[data-group="table-2"] .leaf.days-3')).toHaveCount(9);
  const leaf = carnet.locator(`[data-group="table-7"] [data-fact="${pair(7, 8)}"]`);
  await expect(leaf).toHaveClass(/days-2/);
  await leaf.click();
  await expect(carnet.locator('.caption')).toHaveText(/^[78]\s×\s[78] : 2 feuilles sur 3\.$/);
  await test.info().attach('carnet', { body: await page.screenshot(), contentType: 'image/png' });
  await carnet.getByRole('button', { name: 'Fermer' }).click();
  await expect(carnet).toHaveCount(0);
  expect((await game(page)).phase).toBe('walking');
  // Never during a trail.
  await startTrail(page);
  await expect(page.getByRole('button', { name: 'Carnet' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
