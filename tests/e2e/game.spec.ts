import { expect, test } from '@playwright/test';
import {
  apart,
  boxes,
  current,
  driver,
  expectSlateLayout,
  game,
  loadSave,
  reserveLabel,
  shownChoice,
  startTrail,
  wrong,
} from './helpers';

test('une boucle jouable : questions, indices et feuilles', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await startTrail(page);

  const card = page.locator('#question');
  const reserve = page.locator('#reserve');
  const dim = page.locator('#dim');
  const plume = card.locator('.plume');
  await expect(card).toBeVisible();
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(0));
  // Never the Android keyboard: no text field at all.
  await expect(page.locator('input, textarea, [contenteditable]')).toHaveCount(0);
  // One thing at a time: the forest dims behind the slate, Plume waits calmly.
  await expect(dim).toHaveClass(/on/);
  await expect(plume).toHaveClass(/calm/);
  // Her model is loaded and drawn in her own small canvas.
  await expect(plume.locator('canvas.ready')).toBeVisible();
  await expectSlateLayout(page);

  let exercise = await current(page);
  await test.info().attach('question', { body: await page.screenshot(), contentType: 'image/png' });

  // First mistake, with the fingers: Plume gives a method hint, nothing lost.
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
  await expect(plume).toHaveClass(/talk/);
  // The keys do not move under the finger when the hint appears.
  expect(await five.boundingBox()).toEqual(before);
  await expectSlateLayout(page);
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
  expect((await game(page)).leaves).toBe(0);
  expect(await five.boundingBox()).toEqual(before);
  await expectSlateLayout(page);
  await card.locator('.hint').getByRole('button', { name: 'Suivant' }).click();
  await expect(card.locator('.hint')).toHaveCount(0);
  await expect(plume).toHaveClass(/calm/);

  // Each right answer sends a leaf flying into Plume's basket, already saved in the reserve.
  // A flight lasts under a second, the praise just over one: an observer records them,
  // however slow the browser is (the CI missed the praise between two polls).
  const flights = () => page.evaluate(() => (globalThis as unknown as { flights: number }).flights);
  const praises = () => page.evaluate(() => (globalThis as unknown as { praises: number }).praises);
  await page.evaluate(() => {
    const doc = globalThis.document;
    const counter = globalThis as unknown as { flights: number; praises: number };
    counter.flights = 0;
    counter.praises = 0;
    let praising = false;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.matches('.flying.leaf')) counter.flights++;
        }
      }
      // A praise counts once, if it showed while Plume was cheering (Preact reuses its <p>).
      const praise = doc.querySelector('#question .praise');
      const cheering = doc.querySelector('#question .plume')?.classList.contains('cheer');
      if (praise?.checkVisibility() && cheering) {
        if (!praising) counter.praises++;
        praising = true;
      } else if (!praise) {
        praising = false;
      }
    }).observe(doc.body, { childList: true, subtree: true, attributes: true });
  });
  const basket = card.locator('.basket');
  for (let answer = 1; answer <= 4; answer++) {
    exercise = await current(page);
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect.poll(praises).toBe(answer);
    await expect(basket).toHaveAttribute(
      'aria-label',
      `Panier : ${answer} feuille${answer > 1 ? 's' : ''}`,
    );
    expect((await game(page)).leaves).toBe(answer);
    await expect.poll(flights).toBe(answer);
    if (answer === 1) {
      await test.info().attach('feuille', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    await expect(basket.locator('b')).toHaveText(String(answer));
    await expect(reserve).toHaveAttribute('aria-label', reserveLabel(0));
    await expect(card.locator('.praise')).toHaveCount(0);
  }
  // The forest only changes at the end of the trail: the slate never stepped aside.
  expect((await game(page)).grown).toBe(0);
  await expect(card).not.toHaveClass(/away/);
  await expect(dim).toHaveClass(/on/);
  await expect(card.locator('.instruction')).toBeVisible();
  expect(errors).toEqual([]);
});

test('un sentier complet : 10 pierres, un résumé bienveillant, et la forêt pousse où l’enfant choisit', async ({
  page,
}) => {
  // A whole trail, then two elements that grow and pass a stage: about 3 minutes on CI.
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  // Nothing in the reserve yet: it is a button all the same, and shows what there is to earn.
  const reserveButton = page.getByRole('button', { name: reserveLabel(0) });
  await expect(reserveButton).toHaveId('reserve');
  await expect(reserveButton).not.toHaveClass(/ready/);
  await reserveButton.click();
  await expect(page.locator('#shop .article').first()).toBeDisabled();
  await expect(page.locator('#shop .article').first()).toContainText('Encore 4 feuilles');
  await expect(page.locator('#trail')).toHaveClass(/aside/);
  // It stays a button, pressed: nothing moves under the finger, a second touch closes the shop.
  await expect(reserveButton).toHaveAttribute('aria-pressed', 'true');
  await reserveButton.click();
  await expect(page.locator('#shop')).toHaveCount(0);
  await expect(reserveButton).toHaveAttribute('aria-pressed', 'false');
  await startTrail(page);
  const card = page.locator('#question');
  const path = page.locator('#trail');
  const dim = page.locator('#dim');
  await expect(path.locator('.stone')).toHaveCount(10);
  await expect(path).toHaveAttribute('aria-label', 'Pierre 1 sur 10');

  // The path, small at the bottom with its sign, stays clear of the reserve, the sound button
  // and the slate.
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => Math.round((await boxes(page, '#trail'))[0].width))
    .toBeLessThan(700);
  const [pathBox, smallSign] = await boxes(page, '#trail, #trail .sign');
  expect(Math.round(viewport.height - pathBox.y - pathBox.height)).toBe(12);
  for (const other of ['#reserve', '#sound-toggle', '#question']) {
    const [box] = await boxes(page, other);
    expect(apart(box, pathBox) && apart(box, smallSign), other).toBe(true);
  }

  // Leaves flying into the basket, then out of it, and the praises: short, an observer counts them.
  await page.evaluate(() => {
    const counter = globalThis as unknown as { flights: number; praises: number };
    counter.flights = 0;
    counter.praises = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        // The heading may stay the same element and turn into the praise.
        const { target } = record;
        if (record.type === 'attributes' && target instanceof Element) {
          if (target.matches('#question .praise')) counter.praises++;
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.matches('.flying.leaf')) counter.flights++;
          if (node instanceof Element && node.matches('#question .praise')) counter.praises++;
        }
      }
    }).observe(globalThis.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  });
  for (let stone = 0; stone < 10; stone++) {
    await expect(path.locator('.stone.crossed')).toHaveCount(stone);
    const exercise = await current(page);
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect.poll(async () => (await game(page)).stone).toBe(stone + 1);
  }
  // Each right answer was praised (1.1 s: under load, too short to catch on screen).
  expect(
    await page.evaluate(() => (globalThis as unknown as { praises: number }).praises),
  ).toBeGreaterThanOrEqual(10);
  // The end of the trail, over the whole forest: the slate and the dimming are gone.
  const end = page.locator('#trail-end');
  await expect(end.locator('.praise')).toHaveText('Sentier terminé !');
  await expect(end).toContainText('Tu as gagné 10 feuilles.');
  await expect(card).toHaveCount(0);
  await expect(dim).not.toHaveClass(/on/);
  await expect(path.locator('.stone.crossed')).toHaveCount(10);
  // Plume pours her basket into the reserve, leaf after leaf.
  await expect(page.locator('#reserve')).toHaveAttribute('aria-label', reserveLabel(10), {
    timeout: 15_000,
  });
  await expect(end.locator('.basket')).toHaveAttribute('aria-label', 'Panier : 0 feuille');
  await expect(end.locator('.basket.pouring')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as { flights: number }).flights))
    .toBe(20);
  const [endBox] = await boxes(page, '#trail-end');
  expect(endBox.y + endBox.height).toBeLessThanOrEqual(pathBox.y);
  expect(Math.abs(endBox.x + endBox.width / 2 - viewport.width / 2)).toBeLessThan(2);

  // Then the forest is the child's: a walk, the reserve glows, the trail grows where it is,
  // its sign calling: a touch on it starts the next one.
  await expect(end).toHaveCount(0);
  await expect(page.locator('#walk')).toBeVisible();
  await expect(page.locator('#walk button')).toHaveCount(0);
  expect((await game(page)).phase).toBe('walking');
  await expect(page.locator('#reserve')).toHaveClass(/ready/);
  const sign = page.getByRole('button', { name: 'Chemin du progrès' });
  await expect(sign).toHaveId('trail');
  await expect(sign.locator('.sign')).toHaveText('Chemindu progrès');
  await expect(path.locator('.stone.here')).toHaveCount(1);
  await expect
    .poll(async () => {
      const [trail, plank] = await boxes(page, '#trail, #trail .sign');
      return [
        Math.round(viewport.height - trail.y - trail.height),
        plank.width > 150,
        // Back to its full size, its growth over.
        trail.width > pathBox.width * 1.3,
      ];
    })
    .toEqual([12, true, true]);
  const [trailBox, signBox, firstStone] = await boxes(page, '#trail, #trail .sign, #trail .stone');
  expect(trailBox.width).toBeGreaterThan(pathBox.width * 1.3);
  // The sign stands on the grass of the trail, before the first stone, hardly higher than it;
  // the trail is centred.
  expect(signBox.x).toBeGreaterThanOrEqual(trailBox.x - 2);
  expect(signBox.x + signBox.width).toBeLessThan(firstStone.x + firstStone.width / 2);
  expect(signBox.y).toBeGreaterThan(trailBox.y - 24);
  expect(signBox.y + signBox.height).toBeLessThan(trailBox.y + trailBox.height);
  expect(Math.abs(trailBox.x + trailBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
  for (const other of ['#reserve', '#sound-toggle']) {
    const [box] = await boxes(page, other);
    expect(apart(box, signBox) && apart(box, trailBox), other).toBe(true);
  }
  // A single season: nothing to choose, no bar.
  await expect(page.locator('#seasons')).toHaveCount(0);

  // A touch on the reserve opens the shop: an element in leaves, the doe three elements away.
  const shopCard = page.locator('#shop');
  await page.locator('#reserve').click();
  await expect(shopCard).toBeVisible();
  await expect(page.locator('#walk')).toHaveCount(0);
  const shop = shopCard.locator('.articles');
  const shoot = shop.getByRole('button', { name: 'Une pousse, 4 feuilles' });
  const doe = shop.getByRole('button', { name: 'Une biche, 2 graines dorées' });
  await expect(shoot).toBeEnabled();
  await expect(doe).toBeDisabled();
  await expect(doe).toContainText('Encore 3 pousses');
  await expect(doe.locator('img')).toHaveAttribute('src', /^data:image\/png/);
  const [shopBox] = await boxes(page, '#shop');
  expect(shopBox.y + shopBox.height).toBeLessThanOrEqual(viewport.height);
  for (const box of await boxes(page, '#shop button')) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  await expect(shopCard.locator('.actions button')).toHaveText(['Fermer']);
  await test.info().attach('boutique', { body: await page.screenshot(), contentType: 'image/png' });

  // Closed, the walk again; the reserve opens it again.
  await shopCard.getByRole('button', { name: 'Fermer' }).click();
  await expect(shopCard).toHaveCount(0);
  await expect(page.locator('#walk')).toBeVisible();
  await page.locator('#reserve').click();
  await expect(shopCard).toBeVisible();

  // Four leaves each: the child chooses among the glowing places, the element grows there,
  // and passes a stage under a veil of light.
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  expect(await describe()).toMatchObject({ seed: 3, stage: 0, elements: [], animals: [] });
  for (let placed = 1; placed <= 2; placed++) {
    await shoot.click();
    await expect(shopCard).toHaveClass(/away/);
    const spots = page.getByRole('button', { name: 'Planter ici' });
    await expect(spots).toHaveCount(3);
    await expect(page.locator('#spots-hint')).toContainText('Touche une place qui brille.');
    for (const box of await boxes(page, '.spot')) {
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(56);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    // Nothing is spent before the choice.
    await expect(page.locator('#reserve')).toHaveAttribute(
      'aria-label',
      reserveLabel(10 - 4 * (placed - 1)),
    );
    if (placed === 1) {
      await test
        .info()
        .attach('choix', { body: await page.screenshot(), contentType: 'image/png' });
    }
    const chosen = spots.nth(placed === 1 ? 2 : 1);
    const slot = Number(await chosen.getAttribute('data-slot'));
    await chosen.tap();
    await expect(spots).toHaveCount(0);
    await expect(page.locator('#reserve')).toHaveAttribute(
      'aria-label',
      reserveLabel(10 - 4 * placed),
    );
    expect((await describe()).elements.map((e) => e.slot).at(-1)).toBe(slot);
    expect((await describe()).elements).toHaveLength(placed);
    if (placed === 1) {
      await test.info().attach('pousse', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await expect(page.locator('#veil')).toHaveClass(/on/);
      await test.info().attach('palier', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    await expect(shopCard).not.toHaveClass(/away/);
    expect(await describe()).toMatchObject({ stage: placed });
  }
  // The probe follows the render a moment after the card comes back.
  await expect.poll(async () => (await game(page)).grown).toBe(2);
  // What is still to earn, never what is missing.
  await expect(shoot).toBeDisabled();
  await expect(shoot).toContainText('Encore 2 feuilles');
  await expect(doe).toContainText('Encore 1 pousse');

  // Nothing within reach: closed, the reserve rests; a touch on the top of the sign, above
  // the strip, starts another trail.
  await shopCard.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('#reserve')).not.toHaveClass(/ready/);
  await page.locator('#trail .sign').click({ position: { x: 90, y: 12 } });
  await expect(sign).toHaveCount(0);
  await expect(card.locator('.instruction')).toBeVisible();
  await expect(dim).toHaveClass(/on/);
  await expect(path.locator('.stone.crossed')).toHaveCount(0);
  await expect(path.locator('.stone.here')).toHaveCount(1);
  // The trail stays at the bottom, small again.
  await expect
    .poll(async () => {
      const [box] = await boxes(page, '#trail');
      return [Math.round(viewport.height - box.y - box.height), Math.round(box.width)];
    })
    .toEqual([12, Math.round(pathBox.width)]);
  expect((await game(page)).role).toBe('warmup');

  // The painting and the reserve come back as they were.
  const painting = await describe();
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect(await describe()).toEqual(painting);
  await expect(page.locator('#reserve')).toHaveAttribute('aria-label', reserveLabel(2));
  expect(errors).toEqual([]);
});

test('la boutique : une biche achetée en graines dorées rejoint la prairie et y reste', async ({
  page,
}) => {
  // A short trail, then the doe settles: about 3 minutes on CI.
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 2,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 3,
      season: 'summer',
      seasons: ['summer'],
      night: 'none',
      elements: [0, 1, 2].map((slot) => ({ slot, day: 1 })),
      animals: [],
    },
    progress: [],
    facts: [],
    history: [],
  });
  await startTrail(page);
  const animals = async () => (await page.evaluate(() => window.__numebois!.counters())).animals;
  expect(await animals()).toBe(0);
  const { stones } = await game(page);
  for (let stone = 0; stone < stones; stone++) {
    const exercise = await current(page);
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect.poll(async () => (await game(page)).stone).toBe(stone + 1);
  }
  const end = page.locator('#shop');
  const shop = end.locator('.articles');
  const doe = shop.getByRole('button', { name: 'Une biche, 2 graines dorées' });
  // Once Plume has poured her basket into the reserve, a touch on it opens the shop.
  await expect(page.locator('#reserve')).toHaveClass(/ready/, { timeout: 20_000 });
  await page.locator('#reserve').click();
  await expect(doe).toBeEnabled();
  await expect(doe.locator('img')).toHaveAttribute('src', /^data:image\/png/);
  // The fox waits for stage 5: four elements away.
  await expect(shop.getByRole('button', { name: /^Un renard/ })).toContainText('Encore 4 pousses');
  // Measured once the card has slid in.
  await end.evaluate((card) => Promise.all(card.getAnimations().map((a) => a.finished)));
  const layout = await page.evaluate(() => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const doc = globalThis.document;
    return {
      card: box(doc.querySelector('#shop')!),
      reserve: box(doc.querySelector('#reserve')!),
      buttons: [...doc.querySelectorAll('#shop button')].map(box),
    };
  });
  const viewport = page.viewportSize()!;
  expect(layout.card.y).toBeGreaterThan(layout.reserve.y + layout.reserve.height);
  expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(viewport.height);
  for (const box of layout.buttons) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  await test.info().attach('boutique', { body: await page.screenshot(), contentType: 'image/png' });

  // One touch: the seeds are spent, the card steps aside, the camera comes close to the meadow,
  // the doe appears in view, then the camera goes back (#107).
  const seeds = (await game(page)).seeds;
  const camera = () => page.evaluate(() => window.__numebois!.camera());
  const home = await camera();
  const moved = async () => Math.hypot(...(await camera()).map((v, i) => v - home[i]));
  await doe.click();
  await expect(page.locator('#arrival')).toHaveText('Une biche arrive !');
  await expect(end).toHaveClass(/away/);
  await expect.poll(moved).toBeGreaterThan(15);
  await expect.poll(animals).toBe(1);
  const [doeOnScreen] = await page.evaluate(() => window.__numebois!.animals());
  expect(doeOnScreen.x).toBeGreaterThan(0);
  expect(doeOnScreen.x).toBeLessThan(viewport.width);
  expect(doeOnScreen.y).toBeGreaterThan(0);
  expect(doeOnScreen.y).toBeLessThan(viewport.height);
  await test.info().attach('arrivée', { body: await page.screenshot(), contentType: 'image/png' });
  expect((await game(page)).seeds).toBe(seeds - 2);
  expect(await page.evaluate(() => window.__numebois!.describe().animals)).toEqual(['Deer']);
  // The arrival waits on the scene's clock, slower than the wall clock on a loaded runner.
  await expect(end).not.toHaveClass(/away/, { timeout: 45_000 });
  expect(await moved()).toBeLessThan(3);
  await expect(page.locator('#arrival')).toHaveCount(0);
  await expect(shop.getByRole('button', { name: /^Une biche/ })).toHaveCount(0);

  // The doe stays in the painting.
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect(await page.evaluate(() => window.__numebois!.describe().animals)).toEqual(['Deer']);
  expect(await animals()).toBe(1);
  expect((await game(page)).seeds).toBe(seeds - 2);
  expect(errors).toEqual([]);
});

test('les saisons : l’automne acheté, l’enfant choisit la saison de son tableau', async ({
  page,
}) => {
  // A short trail, then two seasons under the veil: about 3 minutes on CI.
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 3,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 3,
      season: 'summer',
      seasons: ['summer'],
      night: 'none',
      elements: [0, 1, 2].map((slot) => ({ slot, day: 1 })),
      animals: [],
    },
    progress: [],
    facts: [],
    history: [],
  });
  await startTrail(page);
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  const picker = page.locator('#seasons');
  const summer = picker.getByRole('button', { name: 'L’été' });
  const autumn = picker.getByRole('button', { name: 'L’automne' });
  // One season, nothing to choose: no bar, during a question as after it.
  await expect(picker).toHaveCount(0);

  const { stones } = await game(page);
  for (let stone = 0; stone < stones; stone++) {
    const exercise = await current(page);
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect.poll(async () => (await game(page)).stone).toBe(stone + 1);
  }
  const end = page.locator('#shop');
  const offer = end
    .locator('.articles')
    .getByRole('button', { name: 'L’automne, 3 graines dorées' });
  // Once Plume has poured her basket into the reserve, a touch on it opens the shop.
  await expect(page.locator('#reserve')).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(picker).toHaveCount(0);
  await page.locator('#reserve').click();
  await expect(offer).toBeEnabled();

  // One touch: the seeds are spent and autumn comes over the painting, which keeps summer.
  // The announcement is short and the page busy under the veil: an observer keeps what showed.
  await page.evaluate(() => {
    const doc = globalThis.document;
    const seen: string[] = [];
    Object.assign(window, { seen });
    new MutationObserver(() => {
      const text = doc.querySelector('#arrival')?.textContent;
      if (text && !seen.includes(text)) seen.push(text);
      if (doc.querySelector('#shop.away') && !seen.includes('away')) seen.push('away');
    }).observe(doc.querySelector('#ui')!, { childList: true, subtree: true, attributes: true });
  });
  await offer.click();
  await expect(autumn).toHaveAttribute('aria-pressed', 'true');
  await expect(end).not.toHaveClass(/away/);
  await expect(page.locator('#arrival')).toHaveCount(0);
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen.sort()).toEqual(['away', 'L’automne arrive !'].sort());
  expect((await game(page)).seeds).toBe(0);
  expect(await describe()).toMatchObject({ season: 'autumn', seasons: ['summer', 'autumn'] });
  await expect(picker.getByRole('button')).toHaveCount(2);
  await expect(end.locator('.articles').getByRole('button', { name: /^L’automne/ })).toHaveCount(0);
  await test.info().attach('automne', { body: await page.screenshot(), contentType: 'image/png' });

  // One touch on the bar: summer again, nothing else bought.
  await summer.click();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
  await expect(end).not.toHaveClass(/away/);
  expect(await describe()).toMatchObject({ season: 'summer', seasons: ['summer', 'autumn'] });
  expect((await game(page)).seeds).toBe(0);

  // During the walk, the bar stays clear of the other buttons.
  await end.getByRole('button', { name: 'Fermer' }).click();
  await expect(summer).toBeEnabled();
  const [bar, ...others] = await Promise.all(
    ['#seasons', '#trail', '#trail .sign', '#sound-toggle'].map(
      async (s) => (await boxes(page, s))[0],
    ),
  );
  for (const other of others) expect(apart(bar, other)).toBe(true);

  // The season chosen and the one bought stay in the painting, once written.
  const saved = () =>
    page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const request = indexedDB.open('numebois', 1);
          request.onsuccess = () => {
            const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
            get.onsuccess = () => {
              request.result.close();
              resolve(JSON.parse(String(get.result)).painting.season);
            };
          };
        }),
    );
  await expect.poll(saved).toBe('summer');
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect(await describe()).toMatchObject({ season: 'summer', seasons: ['summer', 'autumn'] });
  // Between two trails, the season can change; the trail keeps waiting.
  await expect(picker.getByRole('button')).toHaveCount(2);
  await autumn.click();
  await expect(autumn).toHaveAttribute('aria-pressed', 'true');
  await expect(autumn).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Chemin du progrès' })).toBeVisible();
  expect(await describe()).toMatchObject({ season: 'autumn', seasons: ['summer', 'autumn'] });
  // During a question, nothing else: the bar goes.
  await startTrail(page);
  await expect(picker).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('la nuit : achetée dans la boutique, choisie comme une cinquième saison (#85)', async ({
  page,
}) => {
  // Three changes under the veil and a reload: about a minute and a half on CI.
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-24T10:00:00.000Z',
    leaves: 0,
    seeds: 3,
    trailLength: 'short',
    painting: {
      biome: 'clearing',
      seed: 3,
      stage: 5,
      season: 'summer',
      seasons: ['summer', 'autumn'],
      night: 'none',
      elements: [0, 1, 2, 3, 4, 5, 6].map((slot) => ({ slot, day: 1 })),
      animals: [],
    },
    progress: [],
    facts: [],
    history: [],
  });
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  const picker = page.locator('#seasons');
  const summer = picker.getByRole('button', { name: 'L’été' });
  const moon = picker.getByRole('button', { name: 'La nuit' });
  const shop = page.locator('#shop');
  const offer = shop
    .locator('.articles')
    .getByRole('button', { name: 'La nuit, 3 graines dorées' });
  // Not bought yet: the bar has only the seasons.
  await expect(picker.getByRole('button')).toHaveCount(2);
  await expect(moon).toHaveCount(0);

  // One touch in the shop: the seeds are spent and the night falls, nothing else moves.
  await page.locator('#reserve').click();
  await expect(offer).toBeEnabled();
  await offer.click();
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect(shop).not.toHaveClass(/away/);
  expect((await game(page)).seeds).toBe(0);
  expect(await describe()).toMatchObject({
    season: 'summer',
    seasons: ['summer', 'autumn'],
    night: 'shown',
    elements: [0, 1, 2, 3, 4, 5, 6].map((slot) => ({ slot, day: 1 })),
  });
  await expect(picker.getByRole('button')).toHaveCount(3);
  await expect(shop.locator('.articles').getByRole('button', { name: /^La nuit/ })).toHaveCount(0);
  await test.info().attach('nuit', { body: await page.screenshot(), contentType: 'image/png' });

  // Back to the day of summer, then the night again, from the bar.
  await shop.getByRole('button', { name: 'Fermer' }).click();
  await summer.click();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
  await expect(summer).toBeEnabled();
  expect(await describe()).toMatchObject({ season: 'summer', night: 'owned' });
  await moon.click();
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect(moon).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Chemin du progrès' })).toBeVisible();

  // The night stays in the painting, once written.
  const saved = () =>
    page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const request = indexedDB.open('numebois', 1);
          request.onsuccess = () => {
            const get = request.result.transaction('kv').objectStore('kv').get('numebois:save');
            get.onsuccess = () => {
              request.result.close();
              resolve(JSON.parse(String(get.result)).painting.night);
            };
          };
        }),
    );
  await expect.poll(saved).toBe('shown');
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
  expect(await describe()).toMatchObject({ season: 'summer', night: 'shown' });
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('comparer : le signe posé entre les deux nombres, changé, puis validé, sans rouge', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // A save where « comparer » is in progress: the trail warms up with it.
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 0,
    seeds: 0,
    trailLength: 'normal',
    progress: [
      { skill: 'numbers.compare', stage: 'learning', level: 2, recent: [], box: 0, due: null },
    ],
    facts: [],
    history: [],
  });
  await startTrail(page);
  const exercise = await current(page);
  expect(exercise.skill).toBe('numbers.compare');
  if (exercise.input.kind !== 'compare') throw new Error(exercise.input.kind);
  const card = page.locator('#question');
  const signs = card.locator('.choice button');
  const between = card.locator('.comparison .between');
  const submit = card.locator('.submit');
  await expect(signs).toHaveText(['<', '=', '>']);
  // The two numbers apart, an empty place between them, nothing to confirm yet.
  await expect(card.locator('.comparison .number')).toHaveText([
    exercise.input.left,
    exercise.input.right,
  ]);
  await expect(between).toHaveText('');
  await expect(submit).toBeDisabled();
  await expectSlateLayout(page);
  const [wrongSign, otherSign] = ['<', '=', '>'].filter((sign) => sign !== exercise.answer);
  // A touch sets the sign between the numbers without checking it; another one replaces it.
  await card.getByRole('button', { name: otherSign, exact: true }).click();
  await expect(between).toHaveText(otherSign);
  await card.getByRole('button', { name: wrongSign, exact: true }).click();
  await expect(between).toHaveText(wrongSign);
  await expect(card.locator('.hint')).toHaveCount(0);
  await submit.click();
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(card.getByRole('button', { name: wrongSign, exact: true })).toHaveClass(/tried/);
  await expect(between).toHaveText('');
  await expectSlateLayout(page);
  await test.info().attach('comparer', { body: await page.screenshot(), contentType: 'image/png' });
  // The keyboard too: the sign itself, then Enter.
  await page.keyboard.press(exercise.answer);
  await expect(between).toHaveText(exercise.answer);
  // The praise is short and the runner sometimes slow: an observer keeps that it showed.
  await page.evaluate(() => {
    const doc = globalThis.document;
    const seen = globalThis as unknown as { praised: boolean };
    seen.praised = false;
    new MutationObserver(() => {
      if (doc.querySelector('#question .praise')) seen.praised = true;
    }).observe(doc.body, { childList: true, subtree: true, attributes: true });
  });
  await page.keyboard.press('Enter');
  // Within the praise, before the next question.
  await expect(card.locator('.comparison .between.right')).toHaveText(exercise.answer);
  await expect(card.locator('.choice button.right')).toHaveText(exercise.answer);
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as { praised: boolean }).praised))
    .toBe(true);
  expect(errors).toEqual([]);
});

test('le QCM : une question du pavé parfois proposée parmi 4 nombres', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?practice=times-tables.products&level=1&seed=3&stage=0&quality=low');
  await page.evaluate(() => window.__numebois!.ready);
  const card = page.locator('#question');
  // The first question on the keypad, then right answers until one is offered among choices.
  let exercise = await current(page);
  expect(exercise.input.kind).toBe('keypad');
  await expect(card.locator('.keypad')).toBeVisible();
  for (let stone = 0; exercise.input.kind === 'keypad'; stone++) {
    expect(stone).toBeLessThan(9);
    await driver(exercise.input).answer(page, exercise.input, exercise.answer);
    await expect.poll(async () => (await game(page)).stone).toBe(stone + 1);
    exercise = await current(page);
  }
  if (exercise.input.kind !== 'choice') throw new Error(exercise.input.kind);
  const choices = card.locator('.choice.numbers button');
  await expect(choices).toHaveCount(4);
  await expect(card.locator('.keypad')).toHaveCount(0);
  expect(new Set(exercise.input.options).size).toBe(4);
  expect(exercise.input.options).toContain(exercise.answer);
  await expectSlateLayout(page);
  const [wrongChoice] = driver(exercise.input).wrongs(exercise.input, exercise.answer);
  await driver(exercise.input).answer(page, exercise.input, wrongChoice);
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(
    card.locator('.choice').getByRole('button', { name: shownChoice(wrongChoice), exact: true }),
  ).toHaveClass(/tried/);
  await expectSlateLayout(page);
  await test.info().attach('QCM', { body: await page.screenshot(), contentType: 'image/png' });
  await driver(exercise.input).answer(page, exercise.input, exercise.answer);
  await expect(card.locator('.choice button.right')).toHaveText(exercise.answer);
  expect(errors).toEqual([]);
});

test('une notion acquise : une graine dorée, seule à l’écran, rejoint la réserve', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // « Écrire en chiffres » at its last level: one more right answer acquires it.
  const recent = Array.from({ length: 4 }, () => ({ level: 3, right: true, day: 1 }));
  await loadSave(page, {
    version: 6,
    savedAt: '2026-11-23T10:00:00.000Z',
    leaves: 7,
    seeds: 0,
    trailLength: 'normal',
    progress: [
      {
        skill: 'numbers.write-digits',
        stage: 'learning',
        level: 3,
        recent,
        box: 0,
        due: null,
      },
    ],
    facts: [],
    history: [],
  });
  const reserve = page.locator('#reserve');
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(7));
  await startTrail(page);
  const exercise = await current(page);
  expect(exercise.skill).toBe('numbers.write-digits');
  await page.keyboard.type(exercise.answer);
  await page.keyboard.press('Enter');

  const gift = page.locator('#seed-gift');
  await expect(gift).toContainText('Une graine dorée !');
  await expect(gift).toContainText('Tu as appris : écrire un nombre en chiffres.');
  // Alone over the lit forest: the slate steps aside, the dimming lifts.
  await expect(page.locator('#question')).toHaveClass(/away/);
  await expect(page.locator('#dim')).not.toHaveClass(/on/);
  await test.info().attach('graine dorée', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(7, 1));
  await expect(reserve.locator('.seeds b')).toHaveText('1');
  await expect(page.locator('#question .basket b')).toHaveText('1');
  await expect(gift).toHaveCount(0);
  await expect(page.locator('#question .instruction')).toBeVisible();
  expect((await game(page)).seeds).toBe(1);
  expect(errors).toEqual([]);
});

test('l’ardoise tient le plus long énoncé avec la réponse montrée ; Entrée pour continuer', async ({
  page,
}) => {
  await page.goto('./?seed=3&time=1');
  await page.evaluate(() => window.__numebois!.ready);
  await startTrail(page);
  const exercise = await current(page);
  await page.keyboard.type(wrong(exercise.answer));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(String((Number(exercise.answer.at(-1)) + 2) % 10));
  await page.keyboard.press('Enter');
  const card = page.locator('#question');
  await expect(card.locator('.hint .next')).toBeVisible();
  // The longest number in words, sized as the slate sizes it, and the longest hint.
  await card.evaluate((element) => {
    const statement = element.querySelector('.statement')!;
    statement.className = 'statement small';
    statement.textContent = 'neuf-mille-neuf-cent-quatre-vingt-dix-neuf';
    element.querySelector('.hint span')!.textContent =
      'neuf-mille · neuf-cent · quatre-vingt-dix-neuf\n' +
      '9 milliers, 9 centaines, 9 dizaines, 9 unités : 9 999.';
  });
  await expectSlateLayout(page);
  await test.info().attach('pire cas', { body: await page.screenshot(), contentType: 'image/png' });

  // Enter goes on, like the button.
  const stone = (await game(page)).stone;
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await game(page)).stone).toBe(stone + 1);
  await expect(card.locator('.hint')).toHaveCount(0);
});
