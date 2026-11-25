import { expect, test, type Page } from '@playwright/test';
import { answered, current, driver, game, loadSave, wrong } from './helpers';

/** The tables acquired; the wall clock stands still: time passes only when `think` moves it. */
async function tablesAcquired(page: Page) {
  let now = new Date('2026-11-25T10:00:00').getTime();
  await page.clock.setFixedTime(now);
  await page.goto('./?stage=0');
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
  return async (ms: number) => {
    now += ms;
    await page.clock.setFixedTime(now);
  };
}

test('le panier de glands : 30 s sous le soleil, une erreur sans perte de temps, fin heureuse', async ({
  page,
}) => {
  // Each frame draws the landscape: about 2 minutes on a loaded machine.
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const think = await tablesAcquired(page);
  const sign = page.getByRole('button', { name: 'Défi' });
  await sign.click();
  const menu = page.locator('#challenge-menu');
  await expect(menu).toContainText('Le panier de glands');
  // Always refusable.
  await menu.getByRole('button', { name: 'Pas maintenant' }).click();
  await expect(menu).toHaveCount(0);
  await sign.click();
  await menu.getByRole('button', { name: /30 secondes/ }).click();

  const bar = page.locator('#question .challenge-bar');
  for (let i = 0; i < 4; i++) {
    const exercise = await current(page);
    expect((await game(page)).mode).toBe('challenge');
    // Thinking time.
    await think(2000);
    if (i === 2) {
      await driver(exercise.input).answer(page, exercise.input, wrong(exercise.answer));
      // The answer shows a moment, without a hint; the sun waits.
      await expect.poll(async () => (await game(page)).phase).toBe('reveal');
      await expect(page.locator('#question .hint')).toHaveCount(0);
    } else {
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
      await answered(page, exercise);
    }
  }
  await expect(bar.locator('.acorns')).toHaveAccessibleName('3 glands');
  await current(page);
  // A right answer may also teach something (a golden seed of its own): counted from here.
  const { seeds } = await game(page);
  // The sun sets: the basket is full of what it got.
  await think(31_000);
  const end = page.locator('#challenge-end');
  await expect(end).toContainText('Ton premier panier !');
  await expect(end).toContainText('3 glands dans ton panier.');
  await expect(end).toContainText('La prochaine fois, vise 4 glands.');
  expect(await game(page)).toMatchObject({ seeds: seeds + 1, leaves: 3 });
  await end.getByRole('button', { name: 'J’ai fini' }).click();
  await expect(page.locator('#trail-end')).toContainText('Défi terminé !');
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 40_000 });
  expect(await game(page)).toMatchObject({ mode: 'trail', phase: 'walking', basket: 0 });
  // The record is kept for next time.
  await sign.click();
  await expect(menu.getByRole('button', { name: /30 secondes/ })).toContainText(
    'Record : 3 glands',
  );
  expect(errors).toEqual([]);
});

test('la course de la feuille : 10 bonnes réponses, puis la feuille fantôme rejoue le record', async ({
  page,
}) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const think = await tablesAcquired(page);
  await page.getByRole('button', { name: 'Défi' }).click();
  await page.locator('#challenge-menu').getByRole('button', { name: '10 questions' }).click();
  const runner = page.locator('#question .challenge-bar.race .runner');
  await expect(runner).toHaveCount(1);
  // No ghost before the first race.
  await expect(page.locator('#question .challenge-bar .ghost')).toHaveCount(0);
  // A mistake shows the answer: 10 right answers end the race.
  for (let right = 0; right < 10;) {
    const exercise = await current(page);
    await think(1500);
    if (right === 4) {
      await driver(exercise.input).answer(page, exercise.input, wrong(exercise.answer));
      await expect.poll(async () => (await game(page)).phase).toBe('reveal');
    }
    const again = await current(page);
    await driver(again.input).answer(page, again.input, again.answer);
    await answered(page, again);
    right++;
  }
  const end = page.locator('#challenge-end');
  await expect(end).toContainText('Ta première course !');
  // 10 × 1,5 s of thinking, on the clock of the test (the pauses: tests/unit/challenge.test.ts).
  await expect(end).toContainText(/10 questions en 15\s+s\./);
  await expect(end).toContainText(/vise \d+\s+s\./);
  // Another race: the ghost leaf of the record runs along.
  await end.getByRole('button', { name: 'Encore un défi' }).click();
  await current(page);
  await expect(page.locator('#question .challenge-bar .ghost')).toHaveCount(1);
  expect(errors).toEqual([]);
});
