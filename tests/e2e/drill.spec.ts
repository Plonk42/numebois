import { expect, test } from '@playwright/test';
import type { Exercise } from '../../src/core/types';
import { answered, current, driver, game, loadSave, revealed, watchReveal, wrong } from './helpers';

test('la rafale : la table de 7 enchaînée sans interruption, une erreur revient, puis la fin', async ({
  page,
}) => {
  // 40 questions: about 2 minutes, 6 on a loaded machine.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // The wall clock stands still: every answer comes at once.
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00'));
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
  // The tables are under way, one fact often missed: Plume makes its branch glow.
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'normal',
    progress: [
      {
        skill: 'times-tables.products',
        stage: 'learning',
        level: 3,
        recent: [],
        box: 0,
        due: null,
      },
    ],
    facts: [
      {
        fact: 'times-tables.products:6x8',
        tries: 4,
        right: 1,
        fastDays: [],
        times: [6000, 7000, 5000, 8000],
      },
    ],
    history: [],
  });
  const stump = page.getByRole('button', { name: 'Par cœur' });
  await expect(stump).toBeVisible();
  await stump.click();
  // The stump opens the tree: 6 × 8 is on the tables of 6 and 8, the 6 comes first.
  const tree = page.locator('#drill-tree');
  await expect(tree.locator('[data-group="table-6"]')).toHaveClass(/glow/);
  await tree.getByRole('button', { name: 'La table de 7' }).click();

  const garland = page.locator('#question .garland .leaf');
  const statements: string[] = [];
  const found = new Set<string>();
  const missed = 5;
  for (let i = 0; i < 40; i++) {
    const exercise = (await current(page)) as Exercise & { a: number; b: number };
    expect((await game(page)).drilling).toBe(true);
    expect([exercise.a, exercise.b]).toContain(7);
    statements.push(exercise.statement);
    // A leaf per right answer of the round so far: one missed in the first round, a new garland in the second.
    if (i === missed + 1 || i === 19) await expect(garland).toHaveCount(i - 1);
    if (i === 20) await expect(garland).toHaveCount(0);
    if (i === missed) {
      await watchReveal(page);
      await driver(exercise.input).answer(page, exercise.input, wrong(exercise.answer));
      // The answer shows a moment, without a hint, and the garland keeps all its leaves.
      expect(await revealed(page, exercise)).toEqual({ answer: exercise.answer, hint: false });
      await expect(garland).toHaveCount(missed);
    } else {
      found.add([exercise.a, exercise.b].sort((x, y) => x - y).join('×'));
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
      await answered(page, exercise);
    }
    await expect(page.locator('#question .hint')).toHaveCount(0);
    if (i === 3) {
      await expect(garland).toHaveCount(4);
      // The end of the round in sight, drawn like the trail: 20 stones, 4 crossed (#131).
      const round = page.locator('#trail');
      await expect(round).toHaveAttribute('aria-label', 'Pierre 5 sur 20');
      await expect(round.locator('.stone')).toHaveCount(20);
      await expect(round.locator('.stone.crossed')).toHaveCount(4);
      await expect(round.locator('.sign')).toContainText(/Par\s*cœur/);
    }
    // A round of 20: the branch of the table of 7 without a word, today's leaves growing on it.
    if (i === 19 || i === 39) {
      const pause = page.locator('#drill-break');
      await expect(pause.locator('[data-group="table-7"] .leaf')).toHaveCount(9);
      await expect(pause.locator('p')).toHaveCount(0);
      await expect(page.locator('#trail')).toHaveClass(/aside/);
      // The facts found at once today, under the fixed clock: most of the table.
      expect(await pause.locator('.leaf.grew').count()).toBeGreaterThan(4);
      if (i === 19) {
        await test.info().attach('fin du tour', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      if (i === 19) await pause.getByRole('button', { name: 'Encore !' }).click();
      else await pause.getByRole('button', { name: 'J’ai fini' }).click();
    }
  }
  // The missed question came back 2 or 3 questions later.
  expect([missed + 2, missed + 3]).toContain(statements.indexOf(statements[missed], missed + 1));

  await expect(page.locator('#trail-end')).toContainText('Belle récolte !');
  // Each handful of the pour waits for a frame of the landscape: slow on a loaded runner.
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 40_000 });
  // A leaf for each fact found today, not for each answer (#125), poured from Plume's basket
  // into the reserve.
  expect(found.size).toBeLessThanOrEqual(9);
  expect(await game(page)).toMatchObject({ leaves: found.size, basket: 0, drilling: false });
  // The trail still waits with its sign.
  await expect(page.getByRole('button', { name: 'Chemin du progrès' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('la rafale : la dernière feuille du jour d’une branche, puis une rafale sans récolte (#150)', async ({
  page,
}) => {
  // Two rounds of 20 questions: about 2 minutes, more on a loaded machine.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const now = new Date('2026-11-25T10:00:00');
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
  await page.clock.setFixedTime(now);
  await page.goto('./?stage=0&name=');
  await page.evaluate(() => window.__numebois!.ready);
  // The table of 7 picked today but for 7 × 7.
  const pair = (n: number) => `times-tables.products:${Math.min(7, n)}x${Math.max(7, n)}`;
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'normal',
    progress: [
      {
        skill: 'times-tables.products',
        stage: 'learning',
        level: 3,
        recent: [],
        box: 0,
        due: null,
      },
    ],
    facts: [2, 3, 4, 5, 6, 8, 9, 10].map((n) => ({
      fact: pair(n),
      tries: 1,
      right: 1,
      fastDays: [],
      times: [5000],
      paid: day,
    })),
    history: [],
  });
  const stump = page.getByRole('button', { name: 'Par cœur' });
  const tree = page.locator('#drill-tree');
  // The praise of the moment is short: an observer keeps what showed.
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { seen });
    new MutationObserver(() => {
      const text = globalThis.document.querySelector('#question .praise')?.textContent;
      if (text && !seen.includes(text)) seen.push(text);
    }).observe(globalThis.document.body, { childList: true, subtree: true, characterData: true });
  });

  /** A round of the table of 7, every answer right, then « J'ai fini ». */
  const round = async () => {
    await stump.click();
    await tree.getByRole('button', { name: 'La table de 7' }).click();
    for (let i = 0; i < 20; i++) {
      const exercise = await current(page);
      await driver(exercise.input).answer(page, exercise.input, exercise.answer);
      await answered(page, exercise);
    }
    await page.locator('#drill-break').getByRole('button', { name: 'J’ai fini' }).click();
  };

  await round();
  // 7 × 7 came first: its leaf was the last one of the branch today.
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen).toContain('Toute la branche est cueillie !');
  await expect(page.locator('#trail-end')).toContainText('Belle récolte !');
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 40_000 });
  expect((await game(page)).leaves).toBe(1);

  // The same branch again, the same day: nothing to harvest, praised all the same.
  await round();
  await expect(page.locator('#trail-end')).toContainText('Bel entraînement !');
  expect((await game(page)).leaves).toBe(1);
  expect(errors).toEqual([]);
});
