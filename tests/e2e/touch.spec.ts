import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { loadSave, startTrail } from './helpers';

/** A real finger: down and up at once, without moving. */
async function tap(cdp: CDPSession, x: number, y: number) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const touches = (page: Page) => page.evaluate(() => window.__numebois!.touches());

/** Where the doe shows, read and touched at once: she walks. */
async function tapDoe(page: Page, cdp: CDPSession) {
  const animals = await page.evaluate(() => window.__numebois!.animals());
  const doe = animals.find((animal) => animal.name === 'Deer')!;
  await tap(cdp, doe.x, doe.y);
}

test('toucher le paysage : animaux et arbres réagissent pendant la promenade, jamais pendant une question', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3&name=');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-24T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 5,
      season: 'summer',
      seasons: ['summer'],
      night: 'none',
      elements: [0, 1, 2, 3, 4, 5, 6].map((slot) => ({ slot, day: 1 })),
      animals: ['Deer', 'Fox'],
    },
    progress: [],
    facts: [],
    history: [],
  });
  const cdp = await page.context().newCDPSession(page);
  await expect(page.locator('#walk')).toBeVisible();
  await expect
    .poll(async () => (await page.evaluate(() => window.__numebois!.view())).active)
    .toBe(true);

  // On the walk: the doe jumps and gallops, once at a time; a tree of the child sways.
  await tapDoe(page, cdp);
  await expect.poll(() => touches(page)).toEqual([{ kind: 'animal', name: 'Deer' }]);
  await tapDoe(page, cdp);
  // The child's element furthest from the animals.
  const { slots, animals } = await page.evaluate(() => ({
    slots: [0, 1, 2, 3, 4, 5, 6].map((slot) => window.__numebois!.slot(slot)!),
    animals: window.__numebois!.animals(),
  }));
  const room = (p: { x: number; y: number }) =>
    Math.min(...animals.map((a) => Math.hypot(a.x - p.x, a.y - p.y)));
  // Clear of the bars at the top and of the trail at the bottom.
  const slot = slots
    .filter((p) => p.y > 140 && p.y < 560 && p.x > 120 && p.x < 1160)
    .reduce((best, p) => (room(p) > room(best) ? p : best));
  await tap(cdp, slot.x, slot.y);
  await expect
    .poll(() => touches(page))
    .toEqual([{ kind: 'animal', name: 'Deer' }, { kind: 'plant' }]);
  // A finger sliding from the fox moves the view: she does not react.
  const fox = (await page.evaluate(() => window.__numebois!.animals())).find(
    (animal) => animal.name === 'Fox',
  )!;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: fox.x, y: fox.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: fox.x - 60, y: fox.y - 30 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  expect(await touches(page)).toHaveLength(2);

  // During a question, touching the landscape does nothing.
  await startTrail(page);
  await expect
    .poll(async () => (await page.evaluate(() => window.__numebois!.view())).active)
    .toBe(false);
  // The fox never reacted, and the tree is long still.
  const still = (await page.evaluate(() => window.__numebois!.animals())).find(
    (animal) => animal.name === 'Fox',
  )!;
  await tap(cdp, still.x, still.y);
  await tap(cdp, slot.x, slot.y);
  await tap(cdp, 40, 400);
  await page.waitForTimeout(300);
  expect(await touches(page)).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('la nuit, les animaux dorment sauf le loup ; touchée, la biche se lève et se recouche ; le jour les réveille (#119)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3&name=');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-24T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 5,
      season: 'summer',
      seasons: ['summer'],
      night: 'shown',
      elements: [0, 1, 2, 3, 4, 5, 6].map((slot) => ({ slot, day: 1 })),
      animals: ['Deer', 'Fox', 'Wolf'],
    },
    progress: [],
    facts: [],
    history: [],
  });
  const cdp = await page.context().newCDPSession(page);
  const sleepers = async () =>
    (await page.evaluate(() => window.__numebois!.animals())).map((a) => `${a.name}:${a.asleep}`);
  await expect(page.locator('#walk')).toBeVisible();
  expect(await sleepers()).toEqual(['Deer:true', 'Fox:true', 'Wolf:false']);

  // Touched, the doe gets up a moment, then lies down again where she slept.
  await tapDoe(page, cdp);
  await expect.poll(() => touches(page)).toEqual([{ kind: 'animal', name: 'Deer' }]);
  await expect.poll(sleepers).toEqual(['Deer:false', 'Fox:true', 'Wolf:false']);
  await expect.poll(sleepers, { timeout: 30_000 }).toEqual(['Deer:true', 'Fox:true', 'Wolf:false']);

  // The day back from the bar: everyone is awake; the night again, asleep.
  const picker = page.locator('#seasons');
  const summer = picker.getByRole('button', { name: 'L’été' });
  const moon = picker.getByRole('button', { name: 'La nuit' });
  await summer.click();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(sleepers).toEqual(['Deer:false', 'Fox:false', 'Wolf:false']);
  await moon.click();
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(sleepers).toEqual(['Deer:true', 'Fox:true', 'Wolf:false']);
  expect(errors).toEqual([]);
});
