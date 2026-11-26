import { expect, test, type Page } from '@playwright/test';
import { current, driver, expectSlateLayout } from './helpers';

/** A point of the clock face: `angle` in degrees clockwise from 12, `reach` in radii. */
async function onFace(page: Page, angle: number, reach: number) {
  const box = (await page.locator('#question .clock.set').boundingBox())!;
  // The face (radius 188) fills the square drawing of 400.
  const radius = (188 / 400) * box.width;
  const rad = (angle * Math.PI) / 180;
  return {
    x: box.x + box.width / 2 + reach * radius * Math.sin(rad),
    y: box.y + box.height / 2 - reach * radius * Math.cos(rad),
  };
}

/** The finger takes a hand at `from` and turns it to `to`, a little at a time. */
async function turn(page: Page, from: number, to: number, reach: number) {
  const start = await onFace(page, from, reach);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 10));
  for (let i = 1; i <= steps; i++) {
    const point = await onFace(page, from + ((to - from) * i) / steps, reach);
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}

test('régler l’horloge sur 3h45 en faisant glisser les aiguilles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=time.set-clock&level=2&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  expect(exercise.input.kind).toBe('clock');
  await expectSlateLayout(page);
  const clock = page.locator('#question .clock.set');
  await expect(clock).toHaveAttribute('data-time', '12h00');

  // The hour hand, taken near the centre, onto 3; then the minute hand all the way to 9.
  await turn(page, 0, 90, 0.35);
  await expect(clock).toHaveAttribute('data-time', '3h00');
  await turn(page, 0, 270, 0.85);
  await expect(clock).toHaveAttribute('data-time', '3h45');
  // On round past 12, the minute hand drives the hour hand to 4.
  await turn(page, 270, 390, 0.85);
  await expect(clock).toHaveAttribute('data-time', '4h05');
  await test.info().attach('horloge', { body: await page.screenshot(), contentType: 'image/png' });

  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
  await expect(page.locator('#question .clock.set.right')).toBeVisible();
  expect(errors).toEqual([]);
});

test('écrire l’heure lue : « 14h10 » l’après-midi ou le soir, les cases une à une', async ({
  page,
}) => {
  await page.goto('./?practice=time.read-clock&level=5&seed=4&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  let exercise = await current(page);
  while (exercise.level < 5 || Number(exercise.answer.split('h')[0]) <= 12) {
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect(page.locator('#question .praise')).toBeVisible();
    exercise = await current(page);
  }
  const entry = page.locator('#question .time-entry');
  await expect(page.locator('#question .clock')).toBeVisible();
  // The hour of the clock alone is not the time in the afternoon: Plume says to add 12.
  const [hours, minutes] = exercise.answer.split('h');
  const dial = Number(hours) - 12;
  await page.keyboard.type(String(dial));
  // A single digit above 2 is a whole hour: the cursor goes on to the minutes by itself.
  if (dial > 2) await expect(entry.getByRole('button', { name: 'Minutes' })).toHaveClass(/active/);
  else await page.keyboard.press('h');
  await page.keyboard.type(minutes);
  await expect(entry).toContainText(`${dial}h${minutes}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('#question .hint')).toContainText('ajoute 12');
  await expect(entry.locator('.box.tried')).toHaveCount(2);
  await expectSlateLayout(page);
  await test.info().attach('heure', { body: await page.screenshot(), contentType: 'image/png' });
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(page.locator('#question .praise')).toBeVisible();
});
