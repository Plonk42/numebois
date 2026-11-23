import { expect, test, type Page } from '@playwright/test';

async function game(page: Page) {
  return (await page.evaluate(() => window.__numebois!.game()))!;
}

async function answerRight(page: Page) {
  const statement = await page.locator('#question .statement').textContent();
  await expect.poll(async () => (await game(page)).exercise?.statement).toBe(statement);
  await page.keyboard.type((await game(page)).exercise!.answer);
  await page.keyboard.press('Enter');
}

async function openParentMenu(page: Page) {
  const box = (await page.locator('#energy').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator('#parent-menu')).toBeVisible();
}

test('la progression et l’énergie survivent au rechargement ; export et import', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  const gauge = page.locator('#energy');
  for (let i = 1; i <= 2; i++) {
    await answerRight(page);
    await expect(gauge).toHaveAttribute('aria-label', `Énergie : ${i} sur 4`);
    await expect(page.locator('#question .praise')).toHaveCount(0);
  }

  // A short press does nothing; a long one opens the parent menu.
  await gauge.click();
  await expect(page.locator('#parent-menu')).toHaveCount(0);
  await openParentMenu(page);
  await page.getByRole('button', { name: 'Court (6)' }).click();
  await expect(page.getByRole('button', { name: 'Court (6)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter la sauvegarde' }).click(),
  ]);
  const exported = await (await download.createReadStream()).toArray();
  const json = Buffer.concat(exported).toString('utf8');
  expect(JSON.parse(json)).toMatchObject({ energy: 2, trailLength: 'short' });
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

  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  await expect(gauge).toHaveAttribute('aria-label', 'Énergie : 2 sur 4');
  await expect(page.locator('#trail .stone')).toHaveCount(6);

  // Importing the exported save brings it back after a reload.
  await answerRight(page);
  await expect(gauge).toHaveAttribute('aria-label', 'Énergie : 3 sur 4');
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
  await expect(gauge).toHaveAttribute('aria-label', 'Énergie : 2 sur 4');
  expect(errors).toEqual([]);
});
