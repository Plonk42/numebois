import { expect, test } from '@playwright/test';
import { current, driver, expectSlateLayout } from './helpers';

/** Converting (#59): 3 m 25 cm with the table, the digits down to the centimetres. */
test('convertir 3 m 25 cm en centimètres avec le tableau', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // At level 2, the first question is the warm-up one level below: two units of length.
  let exercise;
  for (let seed = 1; ; seed++) {
    await page.goto(`./?practice=units.convert&level=2&seed=${seed}&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    exercise = await current(page);
    if (exercise.statement.includes('\u00a0m ') && exercise.statement.endsWith('cm')) break;
    expect(seed).toBeLessThan(30);
  }
  const { big, small } = exercise as unknown as { big: number; small: number };
  expect(exercise.statement).toBe(`${big}\u00a0m ${small}\u00a0cm = ?\u00a0cm`);
  const table = page.locator('#question .conversion');
  const total = String(big * 100 + small);
  // The table of the class, m | dm | cm | mm (#161): a digit per column, ending in the
  // centimetres, the column to read outlined.
  await expect(table.locator('th')).toHaveText(['m', 'dm', 'cm', 'mm']);
  for (const [i, unit] of ['m', 'dm', 'cm'].entries()) {
    await expect(table.locator('td').nth(i)).toHaveText(total[i]);
    if (unit === 'cm') await expect(table.locator('td').nth(i)).toHaveClass(/mark/);
  }
  await expectSlateLayout(page);
  await test.info().attach('tableau', { body: await page.screenshot(), contentType: 'image/png' });
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
  expect(errors).toEqual([]);
});

test('la monnaie : compter les billets et les pièces', async ({ page }) => {
  await page.goto('./?practice=units.money&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  const { figure } = exercise;
  if (figure?.kind !== 'money') throw new Error('figure');
  await expect(page.locator('#question .purse > span')).toHaveCount(figure.cents.length);
  await expectSlateLayout(page);
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
});
