import { expect, test, type Page } from '@playwright/test';
import { game } from './helpers';

/** A first name for the tests only: the child's never appears in the repository. */
const NAME = 'Zébulon';

/** The first name written in the save, '' before any save. */
const savedName = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open('numebois', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('kv');
        request.onsuccess = () => {
          const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
          get.onsuccess = () => {
            request.result.close();
            const save = get.result === undefined ? {} : JSON.parse(String(get.result));
            resolve((save as { name?: string }).name ?? '');
          };
        };
      }),
  );

async function openDashboard(page: Page) {
  const box = (await page.locator('#reserve').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator('#parent-menu')).toBeVisible();
}

test('Plume demande le prénom au premier lancement, gardé et modifiable (#138)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);

  // Before the landscape: Plume asks, at the top, out of the tablet's keyboard (bottom half).
  const naming = page.locator('#naming');
  const field = naming.getByRole('textbox');
  await expect(naming).toBeVisible();
  await expect(naming).toContainText('comment t’appelles-tu ?');
  expect((await game(page)).phase).toBe('naming');
  await expect(page.getByRole('button', { name: 'Chemin du progrès' })).toHaveCount(0);
  const box = (await field.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height / 2);
  await expect(field).toBeFocused();
  await test.info().attach('prénom', { body: await page.screenshot(), contentType: 'image/png' });

  // Typed as a child may: spaces, small letter. Plume says hello, the landscape is the child's.
  await field.pressSequentially('  zébulon ');
  await naming.getByRole('button', { name: 'C’est moi !' }).click();
  await expect(naming).toHaveCount(0);
  await expect(page.locator('#greeting')).toHaveText(`Bonjour, ${NAME} !`);
  expect((await game(page)).phase).toBe('walking');
  await expect(page.getByRole('button', { name: 'Chemin du progrès' })).toBeVisible();
  await expect.poll(() => savedName(page)).toBe(NAME);

  // Kept: no question at the next launch, only hello.
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await expect(page.locator('#greeting')).toHaveText(`Bonjour, ${NAME} !`);
  await expect(naming).toHaveCount(0);
  // Then it goes, the landscape alone.
  await expect(page.locator('#greeting')).toHaveCount(0);

  // The parent changes it, or empties it: Plume asks again at the next launch.
  await openDashboard(page);
  const menu = page.locator('#parent-menu');
  await menu.getByRole('button', { name: 'Réglages' }).click();
  const parentField = menu.getByRole('textbox', { name: /Prénom/ });
  await expect(parentField).toHaveValue(NAME);
  await parentField.fill('');
  await menu.getByRole('button', { name: 'Fermer' }).click();
  await expect.poll(() => savedName(page)).toBe('');
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await expect(naming).toBeVisible();

  // « Plus tard » plays without a name, never blocked; asked again at the next launch.
  await naming.getByRole('button', { name: 'Plus tard' }).click();
  await expect(naming).toHaveCount(0);
  expect((await game(page)).phase).toBe('walking');
  await expect(page.locator('#greeting')).toHaveCount(0);
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await expect(naming).toBeVisible();
  expect(errors).toEqual([]);
});

test('le prénom dans le bonjour et la fin du sentier, jamais demandé hors du jeu (#138)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  // A notion alone: its first question at once.
  await page.goto('./?practice=numbers.write-digits&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  await expect(page.locator('#question')).toBeVisible();
  await expect(page.locator('#naming')).toHaveCount(0);

  // The sandbox, without a save: never asked; `?name=` gives it.
  await page.goto(`./?sandbox&seed=3&stage=0&quality=low&name=${NAME}`);
  await page.evaluate(() => window.__numebois!.ready);
  await expect(page.locator('#greeting')).toHaveText(`Bonjour, ${NAME} !`);
  await expect(page.locator('#naming')).toHaveCount(0);
  await page.locator('#debug-finish').click();
  await expect(page.locator('#trail-end .praise')).toHaveText(`Sentier terminé, ${NAME} !`, {
    timeout: 120_000,
  });
});
