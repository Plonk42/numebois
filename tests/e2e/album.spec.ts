import { expect, test } from '@playwright/test';
import { apart, boxes, current, game, loadSave, reserveLabel, startTrail } from './helpers';

test('un tableau complet : grand final, cadre, nouveau décor ; il reste vivant dans l’Album', async ({
  page,
}) => {
  // A short trail, the last element, the grand finale, then the Album: about 3 minutes on CI.
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  // One element is missing from the painting; the reserve pays for it after a short trail.
  await loadSave(page, {
    version: 5,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 11,
      season: 'summer',
      seasons: ['summer'],
      elements: Array.from({ length: 21 }, (_, slot) => ({ slot, day: 1 })),
      animals: [],
    },
    journal: { started: 0, acquired: ['numbers.write-digits'], automated: [] },
    progress: [],
    facts: [],
    history: [],
  });
  // Nothing in the Album yet: no book.
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#album-button')).toHaveCount(0);
  await startTrail(page);
  const { stones } = await game(page);
  for (let stone = 0; stone < stones; stone++) {
    const exercise = await current(page);
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await game(page)).stone, { timeout: 8000 }).toBe(stone + 1);
  }
  await expect(page.locator('#reserve')).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator('#album-button')).toHaveCount(0);
  await page.locator('#reserve').click();
  await page.getByRole('button', { name: 'Une pousse, 4 feuilles' }).click();
  await page.getByRole('button', { name: 'Planter ici' }).first().tap();
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  const finished = await describe();
  expect(finished.elements).toHaveLength(22);
  const trees = await page.evaluate(() => window.__numebois!.trees());

  // The grand finale over the whole painting, its sound, nothing to touch.
  const banner = page.locator('#finale');
  await expect(banner).toHaveText('Ton tableau est terminé !', { timeout: 12_000 });
  // The probe follows the page after its paint.
  await expect.poll(async () => (await game(page)).phase).toBe('finale');
  await expect(page.locator('#shop')).toHaveCount(0);
  await expect(page.locator('#new-trail')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.__numebois!.sound().played.includes('finale')))
    .toBe(true);
  await test
    .info()
    .attach('grand final', { body: await page.screenshot(), contentType: 'image/png' });

  // Then the frame closes around it, with its plaque: it joins the Album. The frame stays a
  // few seconds: everything is read in one round trip.
  await expect(page.locator('#frame .plaque')).toContainText('La clairière', { timeout: 15_000 });
  const framing = await page.evaluate(() => {
    const doc = globalThis.document;
    const box = (selector: string) => {
      const { x, y, width, height } = doc.querySelector(selector)!.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      plaque: doc.querySelector('#frame .plaque')!.textContent,
      banner: doc.querySelector('#finale')!.textContent,
      apart: [box('#frame .plaque'), box('#finale')],
    };
  });
  expect(framing.plaque).toMatch(/^La clairièreDu 1er janvier au \d+(er)? \p{L}+$/u);
  expect(framing.banner).toBe('Il rejoint ton album !');
  expect(apart(framing.apart[0], framing.apart[1])).toBe(true);
  await test.info().attach('cadre', { body: await page.screenshot(), contentType: 'image/png' });

  // The next painting: the décor painted least first, each one shown complete.
  const next = page.locator('#next-painting');
  const choices = next.getByRole('button');
  await expect(choices).toHaveText(['Le verger des collines', 'La clairière'], {
    timeout: 15_000,
  });
  await expect(choices.first()).toBeEnabled({ timeout: 15_000 });
  for (const image of await next.locator('img').all()) {
    await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
  }
  const viewport = page.viewportSize()!;
  const [card] = await boxes(page, '#next-painting');
  expect(card.y).toBeGreaterThan(70);
  expect(card.y + card.height).toBeLessThanOrEqual(viewport.height);
  for (const box of await boxes(page, '#next-painting button')) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  await test.info().attach('tableau suivant', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // One touch: the orchard starts at once, the light goes, the forest is the child's again.
  await choices.first().click();
  await expect(next).toHaveCount(0);
  await expect(page.locator('#frame')).toHaveCount(0);
  expect(await describe()).toMatchObject({ biome: 'orchard', stage: 0, elements: [], animals: [] });
  await expect.poll(async () => (await game(page)).phase).toBe('walking');
  await expect(page.locator('#veil')).not.toHaveClass(/on/);
  await expect(page.locator('#reserve')).toHaveAttribute('aria-label', reserveLabel(2));
  await expect(page.locator('#album-button')).toBeVisible();
  const painting = await describe();

  // After a reload: the new painting, and the finished one in the Album.
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect(await describe()).toEqual(painting);
  await page.locator('#album-button').click();
  const album = page.locator('#album');
  await expect(album.locator('.praise')).toHaveText('Ton album');
  const pages = album.locator('.pages button');
  await expect(pages).toHaveCount(1);
  await expect(pages.first()).toHaveAccessibleName(/^La clairière, fini le /);
  const picture = await pages.first().locator('img').getAttribute('src');
  expect(picture).toMatch(/^data:image\/webp;base64,/);
  // About 30 kB: the Album stays light however many paintings it keeps.
  const bytes = (picture!.length * 3) / 4;
  expect(bytes).toBeLessThan(60_000);
  await test.info().attach('album', { body: await page.screenshot(), contentType: 'image/png' });

  // Its page: the painting alive again, as it was, with what was learnt meanwhile.
  await pages.first().click();
  const sheet = page.locator('#album-page');
  await expect(sheet.locator('.title')).toHaveText('La clairière');
  await expect(sheet).toContainText('Tu as appris :');
  await expect(sheet.locator('.learnt li')).toHaveText(['Écrire un nombre en chiffres']);
  await expect(album).toHaveCount(0);
  expect(await describe()).toEqual(finished);
  expect(await page.evaluate(() => window.__numebois!.trees())).toEqual(trees);
  expect(await page.evaluate(() => window.__numebois!.view().active)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__numebois!.counters().fps), { timeout: 10_000 })
    .toBeGreaterThan(0);
  for (const other of ['#reserve', '#trail', '#sound-toggle']) {
    const [box] = await boxes(page, other);
    expect(apart(box, (await boxes(page, '#album-page'))[0]), other).toBe(true);
  }
  await test.info().attach('page de l’album', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // Back to the Album, then to the painting in progress.
  await sheet.getByRole('button', { name: 'Retour à l’album' }).click();
  await expect(pages).toHaveCount(1);
  await album.getByRole('button', { name: 'Fermer' }).click();
  await expect(album).toHaveCount(0);
  await expect(page.locator('#welcome')).toBeVisible();
  expect(await describe()).toEqual(painting);
  expect(errors).toEqual([]);
});
