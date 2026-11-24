import { expect, test, type Page } from '@playwright/test';

// Budget of the tablet (see doc/PLAN_ACTION.md, « Contraintes tablette »).
const BUDGET = { drawCalls: 100, triangles: 150_000, memoryMb: 64 };

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Open the landscape alone with a frozen time (fixed camera, reproducible frame) and wait. */
async function openScene(page: Page, query: string): Promise<void> {
  await page.goto(`./?scene&${query}`);
  await page.evaluate(() => window.__numebois!.ready);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

async function checkScene(page: Page, name: string): Promise<void> {
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.drawCalls, 'draw calls').toBeGreaterThan(10);
  expect(counters.drawCalls, 'draw calls').toBeLessThan(BUDGET.drawCalls);
  expect(counters.triangles, 'scene triangles').toBeGreaterThan(10_000);
  expect(counters.triangles, 'scene triangles').toBeLessThan(BUDGET.triangles);
  expect(counters.sceneMemoryMb + counters.bufferMemoryMb, 'GPU memory').toBeLessThan(
    BUDGET.memoryMb,
  );
  // The first stage of the clearing is bare: a few saplings only.
  expect(counters.trees).toBeGreaterThan(3);

  const capture = await page.screenshot();
  await test.info().attach(name, { body: capture, contentType: 'image/png' });
  // The canvas really shows a scene: many different colours, not a flat fill.
  const colours = await page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, 64, 64);
      const data = context.getImageData(0, 0, 64, 64).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        seen.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
      }
      return seen.size;
    },
    `data:image/png;base64,${capture.toString('base64')}`,
  );
  expect(colours, 'distinct colours in the capture').toBeGreaterThan(40);
}

for (const stage of [0, 6, 11]) {
  test(`palier ${stage}`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `stage=${stage}&quality=high&time=12`);
    await checkScene(page, `palier-${stage}`);
    expect(errors).toEqual([]);
  });
}

for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  test(`${season} au palier 11`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `stage=11&season=${season}&quality=high&time=12`);
    await checkScene(page, `${season}-palier-11`);
    expect(errors).toEqual([]);
  });
}

for (const stage of [0, 11]) {
  test(`palier ${stage}, emplacements remplis`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `stage=${stage}&fill=100&quality=high&time=12`);
    expect((await page.evaluate(() => window.__numebois!.describe())).elements).toHaveLength(22);
    await checkScene(page, `palier-${stage}-rempli`);
    expect(errors).toEqual([]);
  });
}

for (const [stage, fill] of [
  [0, 20],
  [6, 55],
  [11, 100],
]) {
  test(`verger des collines, palier ${stage}`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `biome=orchard&stage=${stage}&fill=${fill}&quality=high&time=12`);
    expect((await page.evaluate(() => window.__numebois!.describe())).biome).toBe('orchard');
    await checkScene(page, `verger-palier-${stage}`);
    expect(errors).toEqual([]);
  });
}

for (const [stage, fill] of [
  [0, 20],
  [6, 55],
  [11, 100],
]) {
  test(`îles du ciel, palier ${stage}`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `biome=sky&stage=${stage}&fill=${fill}&quality=high&time=12`);
    expect((await page.evaluate(() => window.__numebois!.describe())).biome).toBe('sky');
    await checkScene(page, `iles-palier-${stage}`);
    expect(errors).toEqual([]);
  });
}

for (const [stage, fill] of [
  [0, 20],
  [6, 55],
  [11, 100],
]) {
  test(`grand arbre de Plume, palier ${stage}`, async ({ page }) => {
    const errors = watchErrors(page);
    await openScene(page, `biome=giant&stage=${stage}&fill=${fill}&quality=high&time=12`);
    expect((await page.evaluate(() => window.__numebois!.describe())).biome).toBe('giant');
    await checkScene(page, `grand-arbre-palier-${stage}`);
    expect(errors).toEqual([]);
  });
}

test('qualité basse', async ({ page }) => {
  const errors = watchErrors(page);
  await openScene(page, 'stage=11&quality=low&time=12');
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.quality).toBe('low');
  expect(counters.pixelRatio).toBe(1);
  await checkScene(page, 'qualite-basse');
  expect(errors).toEqual([]);
});

test('formes de remplacement sans les packs', async ({ page }) => {
  const errors = watchErrors(page);
  await openScene(page, 'stage=11&quality=high&time=12&assets=placeholder');
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.placeholders).toBe(true);
  await checkScene(page, 'formes-de-remplacement');
  expect(errors).toEqual([]);
});

test('mode débogage : réglages, compteurs et pousse', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?debug&stage=1&quality=medium');
  await page.evaluate(() => window.__numebois!.ready);
  const panel = page.locator('#debug-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Appels de dessin');
  await expect(panel).toContainText('Génération des arbres');

  await page.locator('#debug-season').selectOption('autumn');
  await page.locator('#debug-stage').fill('11');
  await expect(panel).toContainText('11 · féerique');
  expect(await page.evaluate(() => window.__numebois!.describe())).toMatchObject({
    season: 'autumn',
    stage: 11,
  });
  expect(new URL(page.url()).searchParams.get('season')).toBe('autumn');

  // Slots.
  await page.locator('#debug-fill').fill('100');
  expect((await page.evaluate(() => window.__numebois!.describe())).elements).toHaveLength(22);
  expect(new URL(page.url()).searchParams.get('fill')).toBe('100');

  // Growth demonstration: by the button, then by the key.
  await page.locator('#debug-grow').click();
  await page.keyboard.press('g');
  await page.waitForTimeout(600);
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.drawCalls).toBeLessThan(BUDGET.drawCalls);
  expect(errors).toEqual([]);
});

test('bac à sable : du paysage au jeu, réponses et réserve sans sauvegarde', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?debug&stage=0&fill=10&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  await page.locator('#debug-sandbox summary').click();
  await page.locator('#debug-notion').selectOption('mental-math.add');
  await page.locator('#debug-level').selectOption('2');
  await page.locator('#debug-leaves').fill('40');
  await page.locator('#debug-seeds').fill('5');
  await page.locator('#debug-play').click();
  await page.waitForURL(/sandbox/);
  await page.evaluate(() => window.__numebois!.ready);
  expect(await page.evaluate(() => window.__numebois!.describe())).toMatchObject({
    stage: 2,
    elements: [{}, {}],
    animals: [],
  });

  const panel = page.locator('#sandbox-panel');
  const game = () => page.evaluate(() => window.__numebois!.game()!);
  await expect.poll(async () => (await game()).phase).toBe('asking');
  await expect(panel).toContainText('Additionner de tête');
  expect(await game()).toMatchObject({ leaves: 40, seeds: 5 });
  await page.locator('#debug-right').click();
  await expect.poll(async () => (await game()).leaves).toBe(41);
  await expect.poll(async () => (await game()).phase).toBe('asking');
  await page.locator('#debug-wrong').click();
  await page.locator('#debug-wrong').click();
  await expect.poll(async () => (await game()).phase).toBe('reveal');
  await page.locator('#debug-give-seeds').click();
  await expect.poll(async () => (await game()).seeds).toBe(15);
  await expect(panel).toContainText('apprentissage');

  await page.locator('#debug-landscape').click();
  await page.waitForURL(/debug/);
  await expect(page.locator('#debug-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('avec ?scene, rien d’autre que la scène', async ({ page }) => {
  await openScene(page, 'time=1');
  await expect(page.locator('#debug-panel')).toHaveCount(0);
  await expect(page.locator('#question')).toHaveCount(0);
  await expect(page.locator('canvas#scene')).toBeVisible();
});
