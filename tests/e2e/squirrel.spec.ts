import { expect, test, type Page } from '@playwright/test';
import { answered, current, driver, game, loadSave, startTrail } from './helpers';

/** A short trail, every answer right but at `missed` (two wrong answers, then the answer shown). */
async function playTrail(page: Page, missed: number | null = null) {
  await startTrail(page);
  for (let i = 0; ; i++) {
    await expect.poll(async () => (await game(page)).phase).toMatch(/^(asking|walking)$/);
    if ((await game(page)).phase === 'walking') return;
    const exercise = await current(page);
    const drive = driver(exercise.input);
    if (i === missed) {
      for (const value of drive.wrongs(exercise.input, exercise.answer)) {
        await drive.answer(page, exercise.input, value);
      }
      await expect.poll(async () => (await game(page)).phase).toBe('reveal');
      await page.locator('#question .next').click();
    } else {
      await drive.answer(page, exercise.input, exercise.answer);
    }
    await answered(page, exercise);
  }
}

async function tablesAcquired(page: Page) {
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
  // A short trail alone does not pay a shoot (#29): the reserve makes up for it.
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 6,
    seeds: 0,
    trailLength: 'short',
    progress: [
      {
        skill: 'times-tables.products',
        stage: 'acquired',
        level: 4,
        recent: [],
        box: 0,
        due: 900_000,
      },
    ],
    facts: [],
    history: [],
  });
}

test('l’écureuil propose un défi après un sentier réussi, une fois ; refuser ne coûte rien', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await tablesAcquired(page);
  await playTrail(page);
  // A shoot within reach: the purchase first, the squirrel once the shop is closed (#134).
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 30_000 });
  expect((await game(page)).phase).toBe('walking');
  const offer = page.locator('#squirrel');
  await expect(offer).toHaveCount(0);
  await page.locator('#reserve').click();
  await expect(page.locator('#shop')).toBeVisible();
  await expect(offer).toHaveCount(0);
  await page.locator('#shop').getByRole('button', { name: 'Fermer' }).click();
  await expect(offer).toContainText('Un écureuil passe !');
  const before = await game(page);
  await offer.getByRole('button', { name: 'Non merci' }).click();
  await expect(offer).toHaveCount(0);
  expect(await game(page)).toMatchObject({
    phase: 'walking',
    leaves: before.leaves,
    seeds: before.seeds,
  });
  // Once per session: the next trail ends quietly.
  await playTrail(page);
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 30_000 });
  await expect(offer).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('l’écureuil ne vient jamais juste après des erreurs', async ({ page }) => {
  test.setTimeout(180_000);
  await tablesAcquired(page);
  const stones = (await game(page)).stones;
  // The last question missed: an easy one more, and the trail ends without the squirrel.
  await playTrail(page, stones - 1);
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('#squirrel')).toHaveCount(0);
  expect((await game(page)).phase).toBe('walking');
});
