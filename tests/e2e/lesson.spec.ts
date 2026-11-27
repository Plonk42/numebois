import { expect, test, type Page } from '@playwright/test';
import { DOMAINS } from '../../src/domains';
import { current, driver, expectSlateLayout, game, loadSave, startTrail } from './helpers';

/**
 * Plays the astuce on the slate to its end, as the child would: each explanation read, each
 * demo watched, each exercise answered right; the layout checked and captured at each step.
 */
async function playLesson(page: Page, name: string) {
  const card = page.locator('#question');
  const hint = card.locator('.hint');
  for (;;) {
    const { phase, lesson } = await game(page);
    if (phase !== 'lesson') return;
    await expectSlateLayout(page);
    await test.info().attach(`${name}, étape ${lesson!.step + 1}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    const { exercise, kind, step } = lesson!;
    if (kind === 'demo') await expect(hint).toContainText('Voilà !', { timeout: 30_000 });
    if (kind === 'try') {
      await driver(exercise!.input).answer(page, exercise!.input, exercise!.answer);
      await expect(hint).toContainText('Bravo !');
    }
    await card.getByRole('button', { name: 'Suivant' }).click();
    await expect
      .poll(async () => {
        const now = await game(page);
        return now.phase !== 'lesson' || now.lesson?.step !== step;
      })
      .toBe(true);
  }
}

for (const lesson of DOMAINS.flatMap((domain) => domain.lessons ?? [])) {
  test(`${lesson.id} : l’astuce jusqu’au bout, sa page dans le Carnet`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`./?lesson=${lesson.id}&name=Zébulon&seed=3&stage=0&quality=low`);
    await page.evaluate(() => window.__numebois!.ready);
    await expect(page.locator('#question header')).toHaveText(lesson.title);
    await playLesson(page, lesson.id);
    await expect(
      page.locator('#notebook').getByRole('button', { name: lesson.title }),
    ).toContainText('Nouvelle page');
    expect(errors).toEqual([]);
  });
}

/** A notion that opens brings its astuce first, then its first question (#51). */
test('la première astuce d’une notion avant sa première question', async ({ page }) => {
  await page.goto('./?stage=0&name=&seed=3&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  // « Décomposer » opened by the parent: the first trail starts with it.
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'normal',
    progress: [],
    facts: [],
    history: [],
    settings: [{ skill: 'numbers.decompose', mode: 'open', minLevel: 0, maxLevel: 3 }],
  });
  await startTrail(page);
  await expect(page.locator('#question header')).toHaveText('La valeur des chiffres');
  await playLesson(page, 'première fois');
  const exercise = await current(page);
  expect(exercise.skill).toBe('numbers.decompose');
  const now = await game(page);
  expect([now.stone, now.leaves]).toEqual([0, 0]);
});

/** The exercise on the slate, as the lesson player gives it to the widget. */
async function shownAddition(page: Page) {
  const { exercise } = (await game(page)).lesson!;
  return { input: exercise!.input, answer: exercise!.answer };
}

/** « Plume te montre une astuce » (#50): every kind of step, then a page of the Carnet. */
test('une astuce jusqu’au bout, puis sa page dans le Carnet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?lesson=column-arithmetic.add/essai&name=Zébulon&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  const hint = card.locator('.hint');
  const heading = card.locator('header');
  // The probe follows the widget's effects: its keys listen once the step has changed.
  const onward = async () => {
    const before = (await game(page)).lesson?.step;
    await card.getByRole('button', { name: 'Suivant' }).click();
    await expect
      .poll(async () => {
        const now = await game(page);
        return now.phase !== 'lesson' || now.lesson?.step !== before;
      })
      .toBe(true);
  };

  // Plume explains: a text, then a figure.
  await expect(heading).toHaveText('Essai d’astuce');
  await expect(card.locator('.statement')).toContainText('Plume te montre une astuce.');
  await expect(page.locator('#notebook-button')).toHaveCount(0);
  await expectSlateLayout(page);
  await onward();
  await expect(card.locator('.place-value')).toBeVisible();
  await page.keyboard.press('Enter');

  // The keypad, then the column operation, play their answers by themselves.
  await expect(card.locator('.answer.right')).toHaveText('13');
  await expect(hint).toContainText('Voilà !');
  await onward();
  await expect(hint).toContainText('7 + 8 = 15');
  await expect(hint).toContainText('J’écris 5, je retiens 1.');
  await expect(hint).toContainText('Voilà !', { timeout: 20_000 });
  // In the order they were written, from the units.
  await expect(card.locator('.box.digit.right')).toHaveText(['5', '8']);
  await onward();

  // With Plume: the guided column, the child writing.
  await expect(hint).toContainText('6 + 7 = 13');
  await page.keyboard.type('318');
  await expect(hint).toContainText('Bravo !');
  await expectSlateLayout(page);
  await onward();

  // Two exercises of the notion: a mistake shows the hint, as on the trail.
  for (let i = 0; i < 2; i++) {
    await expect(card.locator('.column-operation')).toBeVisible();
    const { input, answer } = await shownAddition(page);
    if (i === 0) {
      const [wrong] = driver(input).wrongs(input, answer);
      await driver(input).answer(page, input, wrong);
      await expect(hint).toContainText('Presque !');
    }
    await driver(input).answer(page, input, answer);
    await expect(hint).toContainText('Bravo !');
    await onward();
  }

  // The Carnet opens on its new page; nothing was counted nor paid.
  const notebook = page.locator('#notebook');
  await expect(notebook).toBeVisible();
  await expect(notebook.getByRole('button', { name: /Essai d’astuce/ })).toContainText(
    'Nouvelle page',
  );
  const now = await game(page);
  expect([now.leaves, now.seeds, now.stone]).toEqual([0, 0, 0]);
  await notebook.getByRole('button', { name: 'Fermer' }).click();
  await expect(notebook).toHaveCount(0);

  // The page is kept: from the Carnet, the astuce plays again.
  await page.goto('./?name=Zébulon&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  await page.locator('#notebook-button').click();
  const pageButton = notebook.getByRole('button', { name: /Essai d’astuce/ });
  await expect(pageButton).not.toContainText('Nouvelle page');
  await pageButton.click();
  await expect(heading).toHaveText('Essai d’astuce');
  expect(errors).toEqual([]);
});
