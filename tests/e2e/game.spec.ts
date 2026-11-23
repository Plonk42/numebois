import { expect, test, type Page } from '@playwright/test';

async function game(page: Page) {
  return (await page.evaluate(() => window.__numebois!.game()))!;
}

/** The exercise on the card. */
async function current(page: Page) {
  const statement = await page.locator('#question .statement').textContent();
  await expect.poll(async () => (await game(page)).exercise?.statement).toBe(statement);
  return (await game(page)).exercise!;
}

/** A wrong answer: the expected one with its last digit changed. */
function wrong(answer: string): string {
  const last = Number(answer.at(-1));
  return answer.slice(0, -1) + String((last + 1) % 10);
}

test('une boucle jouable : questions, indices, énergie et pousse', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);

  const card = page.locator('#question');
  const gauge = page.locator('#energy');
  await expect(card).toBeVisible();
  await expect(gauge).toHaveAttribute('aria-label', 'Énergie : 0 sur 4');
  // Never the Android keyboard: no text field at all.
  await expect(page.locator('input, textarea, [contenteditable]')).toHaveCount(0);

  // One thing at a time: the card stays clear of the gauge and the sound button, on screen.
  const viewport = page.viewportSize()!;
  const cardBox = (await card.boundingBox())!;
  const soundBox = (await page.locator('#sound-toggle').boundingBox())!;
  const gaugeBox = (await gauge.boundingBox())!;
  expect(cardBox.y).toBeGreaterThan(soundBox.y + soundBox.height);
  expect(cardBox.x).toBeGreaterThan(gaugeBox.x + gaugeBox.width);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height);
  expect(await card.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  for (const key of await card.locator('button').all()) {
    const box = (await key.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }

  let exercise = await current(page);
  await test.info().attach('question', { body: await page.screenshot(), contentType: 'image/png' });

  // First mistake, with the fingers: a method hint, no energy lost.
  const validate = page.getByRole('button', { name: 'Valider' });
  await expect(validate).toBeDisabled();
  for (const digit of wrong(exercise.answer)) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  const five = page.getByRole('button', { name: '5', exact: true });
  const before = await five.boundingBox();
  await validate.click();
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(card.locator('.hint')).toContainText('Un chiffre par rang');
  // The keys do not move under the finger when the hint appears.
  expect(await five.boundingBox()).toEqual(before);
  await test.info().attach('indice', { body: await page.screenshot(), contentType: 'image/png' });

  // Second mistake, with the keyboard: the answer and its method, then the next question.
  await page.keyboard.press('Backspace');
  await page.keyboard.type(String((Number(exercise.answer.at(-1)) + 2) % 10));
  await page.keyboard.press('Enter');
  await expect(card.locator('.hint')).toContainText('On regarde ensemble.');
  await expect(card.locator('.answer.shown')).toHaveText(
    exercise.answer.length > 3
      ? `${exercise.answer.slice(0, -3)}\u202f${exercise.answer.slice(-3)}`
      : exercise.answer,
  );
  expect((await game(page)).energy).toBe(0);
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(card.locator('.hint')).toHaveCount(0);

  // Four right answers fill the gauge and grow a tree, while the card steps aside.
  for (let answer = 1; answer <= 4; answer++) {
    exercise = await current(page);
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect(card.locator('.praise')).toBeVisible();
    await expect(gauge).toHaveAttribute('aria-label', `Énergie : ${answer} sur 4`);
    if (answer < 4) await expect(card.locator('.praise')).toHaveCount(0);
  }
  await expect.poll(async () => (await game(page)).grown).toBe(1);
  await expect(card).toHaveClass(/away/);
  await expect(gauge).toHaveAttribute('aria-label', 'Énergie : 0 sur 4');
  await test.info().attach('pousse', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(card).not.toHaveClass(/away/, { timeout: 6000 });
  await expect(card.locator('.instruction')).toBeVisible();
  expect(errors).toEqual([]);
});

test('la carte tient sous le bouton du son avec le plus long énoncé et son indice', async ({
  page,
}) => {
  await page.goto('./?stage=0&time=1');
  await page.evaluate(() => window.__numebois!.ready);
  const exercise = await current(page);
  await page.keyboard.type(wrong(exercise.answer));
  await page.keyboard.press('Enter');
  const card = page.locator('#question');
  await expect(card.locator('.hint')).toBeVisible();
  await card.evaluate((element) => {
    element.querySelector('.statement')!.textContent = 'neuf-mille-neuf-cent-quatre-vingt-dix-neuf';
    element.querySelector('.hint span')!.textContent =
      'neuf-mille · neuf-cent · quatre-vingt-dix-neuf\n' +
      'Un chiffre par rang : milliers, centaines, dizaines, unités.';
  });
  const cardBox = (await card.boundingBox())!;
  const soundBox = (await page.locator('#sound-toggle').boundingBox())!;
  expect(cardBox.y).toBeGreaterThan(soundBox.y + soundBox.height);
  expect(await card.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
});
