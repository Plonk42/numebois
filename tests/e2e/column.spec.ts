import { expect, test } from '@playwright/test';
import { current, driver, expectSlateLayout, game } from './helpers';

/** Addition set out in columns (#48): guided, then alone, two carries or more. */
test('addition posée avec 2 retenues, guidée puis seule', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=column-arithmetic.add&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const grid = card.locator('.column-operation');

  // The warm-up, one level below, then the guided level: Plume tells each column.
  let exercise = await current(page);
  while (exercise.level < 1) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const input = exercise.input;
  if (input.kind !== 'column') throw new Error(input.kind);
  expect(input.mode).toBe('guided');
  expect(input.columns.filter((column) => column.carry > 0).length).toBeGreaterThanOrEqual(2);
  await expectSlateLayout(page);
  const [units] = input.columns;
  await expect(card.locator('.hint')).toContainText(units.calc);
  await expect(card.locator('.hint')).toContainText(units.say);
  // A digit that is not the one to write waits in its box, softly; the cursor stays.
  await page.keyboard.type(String((units.digit + 1) % 10));
  await expect(grid.locator('.box.digit.tried')).toHaveCount(1);
  // Column by column, from the units: the digit, then the carry over the next column.
  let carries = 0;
  for (const [i, column] of input.columns.entries()) {
    const carried = column.carry > 0 && i + 1 < input.columns.length;
    await page.keyboard.type(`${column.digit}${carried ? column.carry : ''}`);
    if (i === input.columns.length - 1) break;
    if (carried) carries++;
    await expect(grid.locator('.box.carry.filled')).toHaveCount(carries);
    await expect(card.locator('.hint')).toContainText(input.columns[i + 1].calc);
    if (i === 0) {
      await test
        .info()
        .attach('guidée', { body: await page.screenshot(), contentType: 'image/png' });
    }
  }
  await expect(card.locator('.praise')).toBeVisible();
  await expect(grid.locator('.box.digit.right')).toHaveCount(input.columns.length);

  // Alone: the result checked at the end, the first column that jams shown gently.
  await page.goto('./?practice=column-arithmetic.add&level=4&seed=5&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  exercise = await current(page);
  while (exercise.level < 4) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const alone = exercise.input;
  if (alone.kind !== 'column') throw new Error(alone.kind);
  expect(alone.mode).toBe('alone');
  expect(alone.columns.filter((column) => column.carry > 0).length).toBeGreaterThanOrEqual(2);
  await expect(card.locator('.hint')).toHaveCount(0);
  // The tens forgotten their carry: one too few.
  const tensDigit = (alone.columns[1].digit + 9) % 10;
  const wrong = [...exercise.answer];
  wrong[wrong.length - 2] = String(tensDigit);
  await driver(alone).answer(page, alone, wrong.join(''));
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(grid.locator('.box.tried')).toHaveAttribute('aria-label', 'Chiffre des dizaines');
  await expect(grid.locator('.box.cursor')).toHaveAttribute('aria-label', 'Chiffre des dizaines');
  await expectSlateLayout(page);
  await test.info().attach('seule', { body: await page.screenshot(), contentType: 'image/png' });
  // The tens written again with their carry, then checked.
  await page.keyboard.type(String(alone.columns[1].digit));
  await expect(grid.locator('.box.tried')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(card.locator('.praise')).toBeVisible();
  expect((await game(page)).stone).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

/** Multiplication by one digit (#49): the carry waits in the bag, the table on demand. */
test('multiplication posée : le sac à retenue, la table sur demande, guidée puis seule', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=column-arithmetic.multiply&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const bag = card.getByRole('button', { name: 'Sac à retenue' });
  let exercise = await current(page);
  while (exercise.level < 1) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const input = exercise.input;
  if (input.kind !== 'column' || input.operator !== '×') throw new Error(input.kind);
  expect(input.mode).toBe('guided');
  const [a, b] = input.rows;
  await expectSlateLayout(page);
  // The table of the multiplier, a moment in place of the operation.
  await card.getByRole('button', { name: `Voir la table de ${b}` }).click();
  await expect(card.locator('.table-of li')).toHaveCount(10);
  await expect(card.locator('.table-of li').nth(6)).toHaveText(`${b} × 7 = ${b * 7}`);
  await card.getByRole('button', { name: 'Revenir à l’opération' }).click();
  await expect(card.locator('.column-operation')).toBeVisible();
  // Column by column with Plume: each carry goes into the bag, then helps the next column.
  const [units] = input.columns;
  await expect(card.locator('.hint')).toContainText(units.calc);
  await page.keyboard.type(String(units.digit));
  if (units.carry > 0) {
    await expect(bag).toHaveClass(/cursor/);
    await page.keyboard.type(String(units.carry));
    await expect(bag).toHaveText(String(units.carry));
    await expect(card.locator('.hint')).toContainText(`+ ${units.carry} =`);
  }
  await test.info().attach('guidée', { body: await page.screenshot(), contentType: 'image/png' });
  const rest = input.columns
    .slice(1)
    .flatMap((column, i) => [
      String(column.digit),
      ...(column.carry > 0 && i + 2 < input.columns.length ? [String(column.carry)] : []),
    ]);
  await page.keyboard.type(rest.join(''));
  await expect(card.locator('.praise')).toBeVisible();
  expect(exercise.answer).toBe(String(a * b));

  // Alone: checked at the end, the first column that jams shown gently.
  await page.goto('./?practice=column-arithmetic.multiply&level=4&seed=5&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  exercise = await current(page);
  while (exercise.level < 4) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const alone = exercise.input;
  if (alone.kind !== 'column') throw new Error(alone.kind);
  expect(alone.mode).toBe('alone');
  // The bag forgotten on the tens.
  const wrong = [...exercise.answer];
  wrong[wrong.length - 2] = String((alone.columns[1].digit + 9) % 10);
  await driver(alone).answer(page, alone, wrong.join(''));
  await expect(card.locator('.hint')).toContainText('Presque !');
  const grid = card.locator('.column-operation');
  await expect(grid.locator('.box.tried')).toHaveAttribute('aria-label', 'Chiffre des dizaines');
  await expectSlateLayout(page);
  await test.info().attach('seule', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(String(alone.columns[1].digit));
  await page.keyboard.press('Enter');
  await expect(card.locator('.praise')).toBeVisible();
  expect(errors).toEqual([]);
});
