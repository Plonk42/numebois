import { expect, test, type Page } from '@playwright/test';
import type { EqualExercise } from '../../src/domains/fractions/equal';
import type { ReadExercise } from '../../src/domains/fractions/generators';
import { boxes, current, expectSlateLayout } from './helpers';

/** The first question of `fractions.read` in this form, from seed to seed. */
async function readQuestion(page: Page, form: ReadExercise['form']) {
  for (let seed = 1; ; seed++) {
    await page.goto(`./?practice=fractions.read&level=2&seed=${seed}&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    const exercise = (await current(page)) as ReadExercise;
    if (exercise.form === form) return exercise;
    expect(seed).toBeLessThan(30);
  }
}

test('colorier une fraction : un appui colore une part, un autre la décolore (#61)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { numerator: n, denominator: d } = await readQuestion(page, 'colour');
  const card = page.locator('#question');
  // The fraction of the statement written as at school, the numerator over the denominator.
  await expect(card.locator('.statement .frac .numerator')).toHaveText(String(n));
  await expect(card.locator('.statement .frac .denominator')).toHaveText(String(d));
  const parts = card.locator('.whole.touch .part');
  await expect(parts).toHaveCount(d);
  const submit = card.locator('.submit');
  await expect(submit).toBeDisabled();
  // A part touched: one too many, then its colour taken off.
  for (let i = 0; i <= n; i++) await parts.nth(i).dispatchEvent('pointerdown');
  await expect(card.locator('.whole .part.on')).toHaveCount(n + 1);
  await parts.nth(n).dispatchEvent('pointerdown');
  await expect(card.locator('.whole .part.on')).toHaveCount(n);
  await expectSlateLayout(page);
  await test.info().attach('colorier', { body: await page.screenshot(), contentType: 'image/png' });
  await submit.click();
  await expect(card.locator('.praise')).toBeVisible();
  await expect(card.locator('.whole .part.right')).toHaveCount(n);
  expect(errors).toEqual([]);
});

test('écrire une fraction : le numérateur, puis le dénominateur, au pavé (#61)', async ({
  page,
}) => {
  const { numerator: n, denominator: d } = await readQuestion(page, 'write');
  const card = page.locator('#question');
  await expect(card.locator('.fraction-figure .part.coloured')).toHaveCount(n);
  await expect(card.locator('.fraction-figure .part')).toHaveCount(d);
  const keypad = card.locator('.keypad');
  for (const digit of String(n))
    await keypad.getByRole('button', { name: digit, exact: true }).click();
  // A numerator of one digit from 2 (or of two): the cursor goes down by itself; else ✓ does.
  if (n === 1) await keypad.getByRole('button', { name: 'Valider' }).click();
  await expect(card.getByRole('button', { name: 'Dénominateur' })).toHaveClass(/active/);
  for (const digit of String(d))
    await keypad.getByRole('button', { name: digit, exact: true }).click();
  await expect(card.getByRole('button', { name: 'Numérateur' })).toHaveText(String(n));
  await expect(card.getByRole('button', { name: 'Dénominateur' })).toHaveText(String(d));
  await expectSlateLayout(page);
  await test.info().attach('écrire', { body: await page.screenshot(), contentType: 'image/png' });
  await keypad.getByRole('button', { name: 'Valider' }).click();
  await expect(card.locator('.praise')).toBeVisible();
});

test('compléter une égalité : la case au numérateur, les deux bandes alignées (#169)', async ({
  page,
}) => {
  await page.goto('./?practice=fractions.equal&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = (await current(page)) as EqualExercise;
  const card = page.locator('#question');
  // The box written over the denominator asked, as on a sheet: « 1/2 = ▢/8 ».
  const asked = card.locator('.statement.written > .frac');
  await expect(asked.locator('.numerator .answer.inline')).toBeVisible();
  await expect(asked.locator('.denominator')).toHaveText(String(exercise.asked[1]));
  // Two strips one under the other, the same width: their parts line up.
  const strips = await boxes(page, '#question .fraction-figure .whole');
  expect(strips).toHaveLength(2);
  expect(strips[0].x).toBeCloseTo(strips[1].x, 0);
  expect(strips[0].width).toBeCloseTo(strips[1].width, 0);
  await expectSlateLayout(page);
  await test.info().attach('égalité', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.type(exercise.answer);
  await page.keyboard.press('Enter');
  await expect(card.locator('.praise')).toBeVisible();
});
