import { expect, test } from '@playwright/test';
import type { ExerciseInput } from '../../src/core/types';
import { addColumns } from '../../src/domains/column-arithmetic/columns';
import { driver, expectSlateLayout, game } from './helpers';

/** The operation on the slate, as the widget is given it: rows read from its label. */
async function shownAddition(page: import('@playwright/test').Page) {
  const label = await page.locator('#question .column-operation').getAttribute('aria-label');
  const rows = label!.split('+').map((n) => Number(n.replace(/\D/g, '')));
  const input: ExerciseInput = {
    kind: 'column',
    operator: '+',
    rows,
    columns: addColumns(rows),
    mode: 'alone',
  };
  return { input, answer: String(rows.reduce((a, b) => a + b, 0)) };
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
  const onward = () => card.getByRole('button', { name: 'Suivant' }).click();

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
