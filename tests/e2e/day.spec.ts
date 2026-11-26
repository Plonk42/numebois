import { expect, test } from '@playwright/test';
import { clockText } from '../../src/core/time';
import { current, driver, expectSlateLayout } from './helpers';

/** Durations (#56, #166): the timeline, its jumps of an hour, the duration in hours and minutes. */
test('la frise des durées : des bonds d’une heure, puis les minutes, la durée en h et min', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=time.durations&level=3&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  let exercise = await current(page);
  while (exercise.level < 3) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(card.locator('.praise')).toBeVisible();
    exercise = await current(page);
  }
  const { start, end } = exercise as unknown as { start: number; end: number };
  const timeline = card.locator('.timeline');
  // The start and the end under the line, a jump of an hour from the start, then the minutes.
  await expect(timeline.locator('.bound text')).toHaveText([clockText(start), clockText(end)]);
  const hours = Math.floor((end - start) / 60);
  await expect(timeline.locator('.hour')).toHaveText(
    Array.from({ length: hours }, (_, i) => clockText(start + 60 * (i + 1))),
  );
  await expect(timeline.locator('.jump')).toHaveCount(hours + 1);
  // A duration: « min » after the minutes box.
  await expect(card.locator('.time-entry')).toContainText('min');
  await expectSlateLayout(page);

  const [first, second] = driver(exercise.input).wrongs(exercise.input, exercise.answer);
  await driver(exercise.input).answer(page, exercise.input, first);
  await expect(card.locator('.hint')).toContainText('Un bond, une heure');
  await driver(exercise.input).answer(page, exercise.input, second);
  // The worked hint: the hours from the start, then the minutes.
  await expect(card.locator('.hint')).toContainText(
    `${clockText(start)} → ${clockText(start + 60 * hours)}`,
  );
  await expect(card.locator('.hint')).toContainText('En tout');
  await expectSlateLayout(page);
  await test.info().attach('frise', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('le calendrier : le jour de la semaine d’une date entourée', async ({ page }) => {
  await page.goto('./?practice=time.calendar&level=0&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  const { given } = exercise as unknown as { given: number };
  const calendar = page.locator('#question .calendar');
  await expect(calendar.locator('td.mark')).toHaveText(String(given));
  await expect(calendar.locator('th')).toHaveCount(7);
  await expectSlateLayout(page);
  await test
    .info()
    .attach('calendrier', { body: await page.screenshot(), contentType: 'image/png' });
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
});
