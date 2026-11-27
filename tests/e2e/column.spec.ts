import { expect, test } from '@playwright/test';
import {
  columnKeys,
  current,
  driver,
  expectSlateLayout,
  game,
  poseColumns,
  rowBox,
} from './helpers';

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
  // Set out first, with a touch (#158): touched at the units, the number lands too far right.
  expect(input.setup).toBe('tap');
  await expect(card.locator('.hint')).toContainText(`Où commence ${input.rows[0]} ?`);
  await rowBox(page, 0, 0).dispatchEvent('pointerdown');
  await expect(grid.locator('.box.term.tried')).toHaveCount(1);
  await expect(card.locator('.hint')).toContainText('Presque !');
  await poseColumns(page, input);
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
  await poseColumns(page, alone);
  await expect(card.locator('.hint')).toHaveCount(0);
  // The tens forgotten their carry: one too few.
  const tensDigit = (alone.columns[1].digit + 9) % 10;
  const wrong = [...exercise.answer];
  wrong[wrong.length - 2] = String(tensDigit);
  await driver(alone).answer(page, alone, wrong.join(''));
  await expect(card.locator('.hint')).toContainText('Presque !');
  // Plume names the mistake (#168).
  await expect(card.locator('.hint')).toContainText('Aux dizaines, tu as oublié la retenue.');
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
  await poseColumns(page, input);
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
  const keys = columnKeys(input.columns, exercise.answer);
  const whole = input.columns.filter((column) => column.joined).length + 1;
  await page.keyboard.type(keys.slice(units.carry > 0 ? 2 : 1, -whole).join(''));
  // The last column as in class (#164): « 6 × 3 = 18, puis 18 + 2 = 20. J’écris 20. »
  const last = input.columns.at(-1)!;
  await expect(card.locator('.hint')).toContainText(last.say);
  await expect(card.locator('.hint')).toContainText(`${b} × ${String(a)[0]}`);
  await test.info().attach('fin', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(keys.slice(-whole).join(''));
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
  // Plume names the column, its carry forgotten or miscalculated (#168).
  await expect(card.locator('.hint')).toContainText('dizaines');
  const grid = card.locator('.column-operation');
  await expect(grid.locator('.box.tried')).toHaveAttribute('aria-label', 'Chiffre des dizaines');
  await expectSlateLayout(page);
  await test.info().attach('seule', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(String(alone.columns[1].digit));
  await page.keyboard.press('Enter');
  await expect(card.locator('.praise')).toBeVisible();
  expect(errors).toEqual([]);
});

/** Written box by box (#158): ✓ checks the numbers, the first set out wrong shown gently. */
test('poser case par case : le nombre mal posé montré, repris, puis le calcul', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=column-arithmetic.add&level=5&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const lengths = (rows: readonly number[]) => new Set(rows.map((n) => String(n).length)).size;
  let exercise = await current(page);
  for (;;) {
    const { input } = exercise;
    if (input.kind !== 'column') throw new Error(input.kind);
    if (exercise.level === 5 && input.setup === 'write' && lengths(input.rows) > 1) break;
    await driver(input).answer(page, input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const input = exercise.input;
  if (input.kind !== 'column') throw new Error(input.kind);
  const width = input.columns.length;
  await expect(card.locator('.hint')).toContainText('Écris chaque nombre sur sa ligne');
  // The shortest number written from the left: its units are not under the units.
  const short = input.rows.findIndex(
    (n) => String(n).length === Math.min(...input.rows.map((m) => String(m).length)),
  );
  for (const [row, n] of input.rows.entries()) {
    const start = row === short ? width - 1 : String(n).length - 1;
    await rowBox(page, row, start).dispatchEvent('pointerdown');
    await page.keyboard.type(String(n));
  }
  await page.keyboard.press('Enter');
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(card.locator('.hint')).toContainText('Les unités sous les unités');
  await expect(rowBox(page, short, width - 1)).toHaveClass(/tried/);
  await expectSlateLayout(page);
  await test
    .info()
    .attach('pose écrite', { body: await page.screenshot(), contentType: 'image/png' });
  // Erased from the right, then written again from the right box.
  const digits = String(input.rows[short]);
  for (let i = 0; i < digits.length; i++) await page.keyboard.press('Backspace');
  await expect(card.locator('.box.term.tried')).toHaveCount(0);
  await rowBox(page, short, digits.length - 1).dispatchEvent('pointerdown');
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(card.locator('.box.term')).toHaveCount(0);
  await driver(input).answer(page, input, exercise.answer);
  await expect(card.locator('.praise')).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Subtraction by compensation (#173): the carry goes down beside the bottom digit of the next
 * column, the top digit gets a small 1; guided, then alone with a zero in the middle.
 */
test('soustraction posée par compensation, guidée puis seule', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=column-arithmetic.subtract&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const grid = card.locator('.column-operation');
  let exercise = await current(page);
  while (exercise.level < 1) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const input = exercise.input;
  if (input.kind !== 'column' || input.operator !== '−') throw new Error(input.kind);
  expect(input.mode).toBe('guided');
  await poseColumns(page, input);
  await expectSlateLayout(page);
  // Column by column with Plume: the borrowing column shows its 10 more, its carry goes down.
  for (const [i, column] of input.columns.entries()) {
    await expect(card.locator('.hint')).toContainText(column.calc);
    if (column.carry > 0) {
      await expect(card.locator('.hint')).toContainText('je ne peux pas : j’ajoute 10.');
      await expect(grid.locator(`.ten.r${i}`)).toHaveText('1');
    }
    await page.keyboard.type(String(column.digit));
    if (column.carry > 0) {
      await expect(grid.locator(`.box.carry.r${i + 1}`)).toHaveClass(/cursor/);
      await test
        .info()
        .attach('guidée', { body: await page.screenshot(), contentType: 'image/png' });
      await page.keyboard.type('1');
      await expect(grid.locator(`.box.carry.r${i + 1}`)).toHaveText('1');
    }
  }
  await expect(card.locator('.praise')).toBeVisible();
  await expect(grid.locator('.box.digit.right')).toHaveCount(input.columns.length);

  // Alone, a zero in the middle: the carry forgotten on the tens, named by Plume (#168).
  await page.goto('./?practice=column-arithmetic.subtract&level=4&seed=5&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  exercise = await current(page);
  while (
    exercise.level < 4 ||
    exercise.input.kind !== 'column' ||
    exercise.input.columns[0].carry === 0
  ) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const alone = exercise.input;
  if (alone.kind !== 'column') throw new Error(alone.kind);
  expect(alone.mode).toBe('alone');
  const wrong = [...exercise.answer];
  wrong[wrong.length - 2] = String((alone.columns[1].digit + 1) % 10);
  await driver(alone).answer(page, alone, wrong.join(''));
  await expect(card.locator('.hint')).toContainText('Aux dizaines, tu as oublié la retenue.');
  await expect(grid.locator('.box.tried')).toHaveAttribute('aria-label', 'Chiffre des dizaines');
  await expectSlateLayout(page);
  await test.info().attach('seule', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(String(alone.columns[1].digit));
  await page.keyboard.press('Enter');
  await expect(card.locator('.praise')).toBeVisible();
  expect(errors).toEqual([]);
});

/** Prices in euros (#177): the comma under the comma in every row, set out then worked out. */
test('prix posés : la virgule sous la virgule', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=column-arithmetic.prices&level=0&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const grid = card.locator('.column-operation');
  const exercise = await current(page);
  const input = exercise.input;
  if (input.kind !== 'column') throw new Error(input.kind);
  expect(input.decimals).toBe(2);
  const [a] = input.rows;
  const price = `${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`;
  await expect(card.locator('.hint')).toContainText(`Où commence ${price} ?`);
  await rowBox(page, 0, 0).dispatchEvent('pointerdown');
  await expect(card.locator('.hint')).toContainText('La virgule sous la virgule');
  await poseColumns(page, input);
  // A comma in each row and in the result, after the euros.
  await expect(grid.locator('.comma')).toHaveCount(input.rows.length + 1);
  await expectSlateLayout(page);
  await test.info().attach('prix', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(columnKeys(input.columns, exercise.answer).join(''));
  await expect(card.locator('.praise')).toBeVisible();
  expect(errors).toEqual([]);
});
