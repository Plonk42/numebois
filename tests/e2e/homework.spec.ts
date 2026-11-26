import { expect, test, type Page } from '@playwright/test';
import { answered, current, driver, game, loadSave } from './helpers';

/** A long press on the reserve: the child cannot open it by chance. */
async function openDashboard(page: Page) {
  const box = (await page.locator('#reserve').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator('#parent-menu')).toBeVisible();
}

const saved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ settings: unknown[]; requests: unknown; notebookChoices: unknown }>(
        (resolve) => {
          const request = indexedDB.open('numebois', 1);
          request.onsuccess = () => {
            const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
            get.onsuccess = () => {
              request.result.close();
              resolve(JSON.parse(String(get.result)));
            };
          };
        },
      ),
  );

/** The homework of the week (#54): set on the tablet, then the child plays the trail. */
test('les devoirs de la semaine : focus jusqu’à une date, astuce et défi au prochain sentier', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0&name=&seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  const day = await page.evaluate(() =>
    Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000),
  );
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'short',
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
  await expect(page.locator('#notebook-button')).toHaveCount(0);
  await openDashboard(page);
  const menu = page.locator('#parent-menu');
  await menu.getByRole('button', { name: 'Devoirs' }).click();

  // « Ajouter ou enlever 9 et 11 » in focus for a week, one more day; an astuce, a challenge.
  await menu.getByText('Ajouter une notion en focus, pour une semaine').click();
  await menu
    .locator('.add-focus')
    .getByRole('button', { name: 'Ajouter ou enlever 9 et 11' })
    .click();
  const focus = menu.locator('.focus tr[data-skill="mental-math.nine-eleven"]');
  await expect(focus).toContainText('Jusqu’au');
  await focus.getByRole('button', { name: 'Un jour de plus' }).click();
  await menu
    .getByRole('group', { name: 'Astuce à proposer' })
    .getByRole('button', { name: 'Le quadrillage de points' })
    .click();
  await menu
    .getByRole('group', { name: 'Défi à proposer' })
    .getByRole('button', { name: 'Les tables de multiplication' })
    .click();
  await menu
    .getByRole('group', { name: 'Carnet : Ajouter 9 ou 11' })
    .getByRole('button', { name: 'Toujours' })
    .click();
  await test.info().attach('devoirs', { body: await page.screenshot(), contentType: 'image/png' });
  const box = (await menu.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await menu.getByRole('button', { name: 'Fermer' }).click();
  await expect
    .poll(async () => {
      const { settings, requests, notebookChoices } = await saved(page);
      return { settings, requests, notebookChoices };
    })
    .toEqual({
      settings: [
        {
          skill: 'mental-math.nine-eleven',
          mode: 'focus',
          minLevel: 0,
          maxLevel: 1,
          until: day + 7,
        },
      ],
      requests: { lesson: 'times-tables.products/quadrillage', challenge: 'times-tables.products' },
      notebookChoices: [{ lesson: 'mental-math.nine-eleven/par-dix', shown: true }],
    });
  // The astuce shown in the Carnet before it is seen.
  await expect(page.locator('#notebook-button')).toBeVisible();

  // The next trail: Plume offers the astuce asked for; refusing costs nothing.
  await page.getByRole('button', { name: 'Chemin du progrès' }).click();
  const tip = page.locator('#lesson-offer');
  await expect(tip).toContainText('Le quadrillage de points');
  await tip.getByRole('button', { name: 'Non merci' }).click();
  // Half the trail at least on the homework, answered right.
  let homework = 0;
  for (;;) {
    await expect.poll(async () => (await game(page)).phase).toMatch(/^(asking|walking)$/);
    if ((await game(page)).phase === 'walking') break;
    const exercise = await current(page);
    if (exercise.skill === 'mental-math.nine-eleven') homework++;
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await answered(page, exercise);
  }
  expect(homework).toBeGreaterThanOrEqual((await game(page)).stones / 2);

  // After it, the squirrel comes with the challenge asked for (after the shop, if open).
  await expect(page.locator('#trail-end')).toHaveCount(0, { timeout: 30_000 });
  const offer = page.locator('#squirrel');
  if ((await offer.count()) === 0) {
    await page.locator('#reserve').click();
    await page.locator('#shop').getByRole('button', { name: 'Fermer' }).click();
  }
  await expect(offer).toContainText('Les tables de multiplication');
  await offer.getByRole('button', { name: 'Non merci' }).click();
  // Each one offered once.
  await expect
    .poll(async () => (await saved(page)).requests)
    .toEqual({ lesson: null, challenge: null });
  expect(errors).toEqual([]);
});
