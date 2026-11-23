import { expect, test, type Page } from '@playwright/test';
import { SOUND_FILES } from '../../src/scene/audio/sounds.gen';
import { current, driver, wrong } from './helpers';

async function sound(page: Page) {
  const { state, context } = await page.evaluate(() => window.__numebois!.sound());
  return { state, context };
}

test('le son attend le premier toucher, se coupe et se met en pause', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3&time=1');
  await page.evaluate(() => window.__numebois!.ready);

  // Nothing before the first touch: no audio context at all.
  expect(await sound(page)).toEqual({ state: 'waiting', context: 'none' });

  await page.mouse.click(640, 500);
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });
  // Every recording is fetched and decoded (Opus).
  await expect
    .poll(() => page.evaluate(() => window.__numebois!.sound().loaded))
    .toBe(Object.keys(SOUND_FILES).length);

  // Hidden tab: paused.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sound(page)).toEqual({ state: 'paused', context: 'suspended' });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });

  // The button turns it off, and the choice is kept for the next visit.
  const button = page.locator('#sound-toggle');
  await expect(button).toHaveAttribute('aria-label', 'Couper le son');
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(56);
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Remettre le son');
  await expect.poll(() => sound(page)).toEqual({ state: 'muted', context: 'suspended' });
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await page.mouse.click(640, 500);
  expect(await sound(page)).toEqual({ state: 'muted', context: 'none' });
  await page.locator('#sound-toggle').click();
  await expect.poll(() => sound(page)).toEqual({ state: 'playing', context: 'running' });
  expect(errors).toEqual([]);
});

test('une bonne réponse sonne, une erreur reste silencieuse', async ({ page }) => {
  await page.goto('./?practice=numbers.write-digits&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const played = () => page.evaluate(() => window.__numebois!.sound().played);
  await page.locator('#question .statement').click();
  await expect
    .poll(() => page.evaluate(() => window.__numebois!.sound().loaded))
    .toBe(Object.keys(SOUND_FILES).length);

  const exercise = await current(page);
  const { answer } = driver(exercise.input);
  await answer(page, exercise.input, wrong(exercise.answer));
  await expect(page.locator('#question .hint')).toBeVisible();
  expect(await played()).toEqual([]);

  await answer(page, exercise.input, exercise.answer);
  await expect.poll(played).toEqual(['right']);
});
