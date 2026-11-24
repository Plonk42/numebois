import { expect, test } from '@playwright/test';
import { answered, current, driver, game, loadSave, wrong } from './helpers';

test('le panier de glands : 30 s sous le soleil, une erreur sans perte de temps, fin heureuse', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Simulated time: the 30 s pass in a moment (no screenshot under it, it waits for a frame).
  await page.clock.install();
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // The tables acquired: they have a challenge.
  await loadSave(page, {
    version: 5,
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
    // Thinking time; a jump, not frame by frame (each frame draws the landscape).
    await page.clock.fastForward(2000);
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
  // The sun sets: the basket is full of what it got.
  await page.clock.fastForward(31_000);
  const end = page.locator('#challenge-end');
  await expect(end).toContainText('Ton premier panier !');
  await expect(end).toContainText('3 glands dans ton panier.');
  await expect(end).toContainText('La prochaine fois, vise 4 glands.');
  expect(await game(page)).toMatchObject({ seeds: 1, leaves: 3 });
  await end.getByRole('button', { name: 'J’ai fini' }).click();
  await expect(page.locator('#trail-end')).toContainText('Défi terminé !');
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 15_000 });
  expect(await game(page)).toMatchObject({ mode: 'trail', phase: 'walking', basket: 0 });
  // The record is kept for next time.
  await sign.click();
  await expect(menu.getByRole('button', { name: /30 secondes/ })).toContainText(
    'Record : 3 glands',
  );
  expect(errors).toEqual([]);
});
