import { expect, test, type Locator, type Page } from '@playwright/test';
import { answered, current, driver, game, loadSave, revealed, watchReveal, wrong } from './helpers';

/** Asks the squirrel for another challenge until it offers `what`, the record shown, then accepts. */
async function take(offer: Locator, what: string, record?: string) {
  for (let i = 0; i < 6 && !(await offer.innerText()).includes(what); i++) {
    const before = await offer.innerText();
    await offer.getByRole('button', { name: 'Un autre' }).click();
    await expect(offer).not.toHaveText(before);
  }
  await expect(offer).toContainText(what);
  if (record) await expect(offer.locator('.record')).toHaveText(record);
  await offer.getByRole('button', { name: 'D’accord !' }).click();
}

/** The tables acquired; the wall clock stands still: time passes only when `think` moves it. */
async function tablesAcquired(page: Page) {
  let now = new Date('2026-11-25T10:00:00').getTime();
  await page.clock.setFixedTime(now);
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
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
  return async (ms: number) => {
    now += ms;
    await page.clock.setFixedTime(now);
  };
}

test('le panier de glands : 30 s sous le soleil, une erreur sans perte de temps, fin heureuse', async ({
  page,
}) => {
  // Each frame draws the landscape: about 2 minutes on a loaded machine.
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const think = await tablesAcquired(page);
  const sign = page.getByRole('button', { name: 'Défi' });
  await sign.click();
  // The squirrel offers one challenge (#132): always refusable.
  const offer = page.locator('#challenge-offer');
  await expect(offer).toContainText('Un défi avec l’écureuil ?');
  await expect(offer).toContainText('Les tables de multiplication');
  await expect(offer.locator('.record')).toHaveCount(0);
  await offer.getByRole('button', { name: 'Non merci' }).click();
  await expect(offer).toHaveCount(0);
  await sign.click();
  await take(offer, '30 secondes');

  const bar = page.locator('#question .challenge-bar');
  for (let i = 0; i < 4; i++) {
    const exercise = await current(page);
    expect((await game(page)).mode).toBe('challenge');
    // Thinking time.
    await think(2000);
    if (i === 2) {
      await watchReveal(page);
      await driver(exercise.input).answer(page, exercise.input, wrong(exercise.answer));
      // The answer shows a moment, without a hint; the sun waits.
      expect((await revealed(page)).hint).toBe(false);
    } else {
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
      await answered(page, exercise);
    }
  }
  // One count only, the squirrel's basket by the slate (#133); the sun has no number.
  await expect(page.locator('#question .acorn-basket')).toHaveAccessibleName('3 glands');
  await expect(page.locator('#question .basket')).toHaveCount(0);
  await expect(bar).toHaveText('');
  await current(page);
  // A right answer may also teach something (a golden seed of its own): counted from here.
  // The acorns are the squirrel's: no leaf in Plume's basket during the challenge (#120).
  const { seeds } = await game(page);
  expect(await game(page)).toMatchObject({ leaves: 0, basket: 0 });
  // The sun sets: the basket is full of what it got.
  await think(31_000);
  const end = page.locator('#challenge-end');
  await expect(end).toContainText('Ton premier panier !');
  await expect(end.locator('.score')).toHaveAccessibleName('3 glands');
  // The first challenge of the day: the acorns exchanged for leaves, and a golden seed.
  await expect(end.locator('.gift')).toHaveAccessibleName('3 feuilles et une graine dorée');
  await expect(end.locator('.gift')).toHaveText(/\+3\s*\+1/);
  // Short: the good news is the only sentence.
  await expect(end.locator('p')).toHaveCount(2);
  expect(await game(page)).toMatchObject({ seeds: seeds + 1, leaves: 3 });
  await end.getByRole('button', { name: 'J’ai fini' }).click();
  await expect(page.locator('#trail-end')).toContainText('Défi terminé !');
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 40_000 });
  expect(await game(page)).toMatchObject({ mode: 'trail', phase: 'walking', basket: 0 });
  // The record is kept for next time; another one the same day is played for the record,
  // without a word of a gift (#126).
  await sign.click();
  await take(offer, '30 secondes', 'Record : 3 glands');
  await current(page);
  await think(31_000);
  await expect(end).toContainText('Bravo pour ce défi !');
  await expect(end.locator('.gift')).toHaveCount(0);
  expect(await game(page)).toMatchObject({ seeds: seeds + 1, leaves: 3 });
  expect(errors).toEqual([]);
});

test('la course de la feuille : 10 bonnes réponses, puis la feuille fantôme rejoue le record', async ({
  page,
}) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const think = await tablesAcquired(page);
  await page.getByRole('button', { name: 'Défi' }).click();
  await take(page.locator('#challenge-offer'), '10 questions');
  const runner = page.locator('#question .challenge-bar.race .runner');
  await expect(runner).toHaveCount(1);
  // No ghost before the first race.
  await expect(page.locator('#question .challenge-bar .ghost')).toHaveCount(0);
  // A mistake shows the answer: 10 right answers end the race.
  for (let right = 0; right < 10;) {
    const exercise = await current(page);
    await think(1500);
    if (right === 4) {
      await watchReveal(page);
      await driver(exercise.input).answer(page, exercise.input, wrong(exercise.answer));
      await revealed(page);
    }
    const again = await current(page);
    await driver(again.input).answer(page, again.input, again.answer);
    await answered(page, again);
    right++;
  }
  const end = page.locator('#challenge-end');
  await expect(end).toContainText('Ta première course !');
  // 10 × 1,5 s of thinking, on the clock of the test (the pauses: tests/unit/challenge.test.ts).
  await expect(end.locator('.score')).toHaveText(/^15\s+s$/);
  // Another race: the ghost leaf of the record runs along.
  await end.getByRole('button', { name: 'Encore un défi' }).click();
  await current(page);
  await expect(page.locator('#question .challenge-bar .ghost')).toHaveCount(1);
  await expect(page.locator('#question .challenge-bar .stone')).toHaveCount(10);
  expect(errors).toEqual([]);
});
