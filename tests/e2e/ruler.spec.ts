import { expect, test, type Page } from '@playwright/test';
import type { ExerciseInput } from '../../src/core/types';
import { current, driver, expectSlateLayout } from './helpers';

/** Where a point of the sheet (millimetres) is on the screen. */
async function onScreen(page: Page, x: number, y: number) {
  return page.locator('#question .sheet').evaluate(
    (svg, [px, py]) => {
      const point = new DOMPoint(px, py).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: point.x, y: point.y };
    },
    [x, y],
  );
}

/** The finger slides from one point of the sheet to another, a little at a time. */
async function slide(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await onScreen(page, from.x, from.y);
  const b = await onScreen(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  }
  await page.mouse.up();
}

test('mesurer à la règle : glisser son 0 sur le bout du segment, lire, écrire', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=measures.measure&level=0&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  const input = exercise.input as Extract<ExerciseInput, { kind: 'ruler' }>;
  await expectSlateLayout(page);
  const sheet = page.locator('#question .sheet');
  const [{ from }] = input.lines;
  // Taken in the middle of its body, the ruler is dropped near the start: its 0 jumps onto it.
  const grip = { x: input.ruler.x + 40, y: input.ruler.y + 12 };
  await slide(page, grip, { x: from.x + 40 + 1.5, y: from.y + 12 + 1 });
  await expect(sheet).toHaveAttribute('data-ruler', `${from.x},${from.y},0`);
  await test.info().attach('règle', { body: await page.screenshot(), contentType: 'image/png' });
  await driver(input).answer(page, input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
  expect(errors).toEqual([]);
});

test('tracer à la règle : un segment tiré du point au doigt', async ({ page }) => {
  await page.goto('./?practice=measures.draw&level=0&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  const input = exercise.input as Extract<ExerciseInput, { kind: 'draw' }>;
  const length = Number(exercise.answer);
  const sheet = page.locator('#question .sheet.draw');
  await slide(page, input.start, { x: input.start.x + length, y: input.start.y });
  await expect(sheet).toHaveAttribute('data-length', String(length));
  await page.locator('#question .submit').click();
  await expect(page.locator('#question .praise')).toBeVisible();
  await expect(sheet.locator('.drawn.right')).toHaveCount(1);
});
