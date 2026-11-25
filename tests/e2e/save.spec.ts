import { expect, test, type Page } from '@playwright/test';
import { current, driver, startTrail } from './helpers';

async function answerRight(page: Page) {
  const exercise = await current(page);
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
}

async function openParentMenu(page: Page) {
  const box = (await page.locator('#reserve').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator('#parent-menu')).toBeVisible();
  // It opens on the child's progress; the export and the import are in the settings.
  await page.getByRole('button', { name: 'Réglages' }).click();
}

const reserveLabel = (leaves: number) =>
  `Réserve : ${leaves} feuille${leaves > 1 ? 's' : ''}, 0 graine dorée`;
const basketLabel = (leaves: number) => `Panier : ${leaves} feuille${leaves > 1 ? 's' : ''}`;

test('la progression et la réserve survivent au rechargement ; export et import', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await startTrail(page);
  const reserve = page.locator('#reserve');
  const basket = page.locator('#question .basket');
  for (let i = 1; i <= 2; i++) {
    await answerRight(page);
    await expect(basket).toHaveAttribute('aria-label', basketLabel(i));
    await expect(reserve).toHaveAttribute('aria-label', reserveLabel(0));
    await expect(page.locator('#question .praise')).toHaveCount(0);
  }

  // A short press does nothing; a long one opens the parent menu.
  await reserve.click();
  await expect(page.locator('#parent-menu')).toHaveCount(0);
  await openParentMenu(page);
  // The screen as the game sees it, read on the tablet to calibrate these tests.
  await expect(page.locator('#parent-menu .screen')).toHaveText(
    'Écran : 1280 × 800 px, ×1 (1280 × 800)',
  );
  await page.getByRole('button', { name: 'Court (6)' }).click();
  await expect(page.getByRole('button', { name: 'Court (6)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The quality of the rendering, kept on the device (not in the save).
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Basse' }).click();
  await expect(page.getByRole('button', { name: 'Basse' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__numebois!.counters())).toMatchObject({
    quality: 'low',
    autoQuality: false,
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter la sauvegarde' }).click(),
  ]);
  const exported = await (await download.createReadStream()).toArray();
  const json = Buffer.concat(exported).toString('utf8');
  expect(JSON.parse(json)).toMatchObject({ leaves: 2, seeds: 0, trailLength: 'short' });
  expect(JSON.parse(json).progress[0]).toMatchObject({ skill: 'numbers.write-digits' });
  await test.info().attach('menu parent', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // A file that is not a save is refused with a reason.
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Importer une sauvegarde' }).click(),
  ]);
  await chooser.setFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  });
  await expect(page.locator('#parent-menu .message')).toContainText('Import refusé');
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('#parent-menu')).toHaveCount(0);

  // The trail is left halfway: the leaves of the basket are in the reserve.
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(2));
  await expect(page.locator('#trail .stone')).toHaveCount(6);
  expect(await page.evaluate(() => window.__numebois!.counters())).toMatchObject({
    quality: 'low',
    autoQuality: false,
  });

  // Importing the exported save brings it back after a reload. Between two trails, the long
  // press opens the parent menu too, without the shop under it.
  await openParentMenu(page);
  await expect(page.locator('#shop')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await startTrail(page);
  await answerRight(page);
  await expect(basket).toHaveAttribute('aria-label', basketLabel(1));
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(2));
  await openParentMenu(page);
  const [again] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Importer une sauvegarde' }).click(),
  ]);
  await Promise.all([
    page.waitForEvent('load'),
    again.setFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(json) }),
  ]);
  await page.evaluate(() => window.__numebois!.ready);
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(2));
  expect(errors).toEqual([]);
});
