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

/** Open a scene with a frozen time (fixed camera, reproducible frame) and wait for it. */
async function openScene(page: Page, query: string): Promise<void> {
  await page.goto(`./?${query}`);
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

  // Growth demonstration: by the button, then by the key.
  await page.locator('#debug-grow').click();
  await page.keyboard.press('g');
  await page.waitForTimeout(600);
  const counters = await page.evaluate(() => window.__numebois!.counters());
  expect(counters.drawCalls).toBeLessThan(BUDGET.drawCalls);
  expect(errors).toEqual([]);
});

test('sans ?debug, rien d’autre que la scène', async ({ page }) => {
  await openScene(page, 'time=1');
  await expect(page.locator('#debug-panel')).toHaveCount(0);
  await expect(page.locator('canvas#scene')).toBeVisible();
});
