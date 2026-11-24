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
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
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
  const offer = page.locator('#squirrel');
  await expect(offer).toContainText('Un écureuil passe !', { timeout: 30_000 });
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
