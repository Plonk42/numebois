import { expect, test } from '@playwright/test';
import {
  apart,
  boxes,
  current,
  expectSlateLayout,
  game,
  loadSave,
  reserveLabel,
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

  // Each right answer sends a leaf flying to the reserve. A flight lasts under a second:
  // an observer counts them, however slow the browser is.
  const flights = () => page.evaluate(() => (globalThis as unknown as { flights: number }).flights);
  await page.evaluate(() => {
    const counter = globalThis as unknown as { flights: number };
    counter.flights = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.matches('.flying.leaf')) counter.flights++;
        }
      }
    }).observe(globalThis.document.body, { childList: true, subtree: true });
  });
  for (let answer = 1; answer <= 4; answer++) {
    exercise = await current(page);
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect(card.locator('.praise')).toBeVisible();
    await expect(plume).toHaveClass(/cheer/);
    await expect(reserve).toHaveAttribute('aria-label', reserveLabel(answer));
    await expect.poll(flights).toBe(answer);
    if (answer === 1) {
      await test.info().attach('feuille', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    await expect(reserve.locator('.leaves b')).toHaveText(String(answer));
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
  // A whole trail, then two elements that grow and pass a stage: about 2 minutes on CI.
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await startTrail(page);
  const card = page.locator('#question');
  const path = page.locator('#trail');
  const dim = page.locator('#dim');
  await expect(path.locator('.stone')).toHaveCount(10);
  await expect(path).toHaveAttribute('aria-label', 'Pierre 1 sur 10');

  // The path stays clear of the reserve, the sound button and the slate.
  const [pathBox] = await boxes(page, '#trail');
  for (const other of ['#reserve', '#sound-toggle', '#question']) {
    const [box] = await boxes(page, other);
    expect(apart(box, pathBox), other).toBe(true);
  }

  for (let stone = 0; stone < 10; stone++) {
    await expect(path.locator('.stone.crossed')).toHaveCount(stone);
    const exercise = await current(page);
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect(card.locator('.praise')).toBeVisible();
    await expect.poll(async () => (await game(page)).stone, { timeout: 8000 }).toBe(stone + 1);
  }
  // The end of the trail, over the whole forest: the slate and the dimming are gone.
  const end = page.locator('#trail-end');
  await expect(end.locator('.praise')).toHaveText('Sentier terminé !');
  await expect(end).toContainText('Tu as franchi 10 pierres.');
  await expect(end).toContainText('Tu as gagné 10 feuilles.');
  await expect(card).toHaveCount(0);
  await expect(dim).not.toHaveClass(/on/);
  await expect(path.locator('.stone.crossed')).toHaveCount(10);
  const [endBox] = await boxes(page, '#trail-end');
  const viewport = page.viewportSize()!;
  expect(endBox.y + endBox.height).toBeLessThanOrEqual(viewport.height);
  expect(Math.abs(endBox.x + endBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
  for (const box of await boxes(page, '#trail-end button')) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  // The shop of the forest: an element in leaves, the doe still three elements away.
  const shop = end.locator('.shop');
  const shoot = shop.getByRole('button', { name: 'Une pousse, 4 feuilles' });
  const doe = shop.getByRole('button', { name: 'Une biche, 2 graines dorées' });
  await expect(shoot).toBeEnabled();
  await expect(doe).toBeDisabled();
  await expect(doe).toContainText('Encore 3 pousses');
  await expect(doe.locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await test.info().attach('résumé', { body: await page.screenshot(), contentType: 'image/png' });

  // A walk in the forest from the end of the trail, then back to the shop.
  await end.getByRole('button', { name: 'Se promener' }).click();
  await expect(end).toHaveClass(/away/);
  await expect(page.locator('#walk')).toBeVisible();
  await page.getByRole('button', { name: 'J’ai fini' }).click();
  await expect(page.locator('#walk')).toHaveCount(0);
  await expect(end).not.toHaveClass(/away/);

  // Four leaves each: the child chooses among the glowing places, the element grows there,
  // and passes a stage under a veil of light.
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  expect(await describe()).toMatchObject({ seed: 3, stage: 0, elements: [], animals: [] });
  for (let placed = 1; placed <= 2; placed++) {
    await shoot.click();
    await expect(end).toHaveClass(/away/);
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
      await expect(page.locator('#veil')).toHaveClass(/on/, { timeout: 8000 });
      await test.info().attach('palier', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    await expect(end).not.toHaveClass(/away/, { timeout: 12_000 });
    expect(await describe()).toMatchObject({ stage: placed });
  }
  expect((await game(page)).grown).toBe(2);
  // What is still to earn, never what is missing.
  await expect(shoot).toBeDisabled();
  await expect(shoot).toContainText('Encore 2 feuilles');
  await expect(doe).toContainText('Encore 1 pousse');
  await expect(end).toContainText('Ta forêt a grandi !');

  await page.getByRole('button', { name: 'Encore un sentier' }).click();
  await expect(card.locator('.instruction')).toBeVisible();
  await expect(dim).toHaveClass(/on/);
  await expect(path.locator('.stone.crossed')).toHaveCount(0);
  await expect(path.locator('.stone.here')).toHaveCount(1);
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
  // A short trail, then the doe settles: about a minute on CI.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 4,
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
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await game(page)).stone, { timeout: 8000 }).toBe(stone + 1);
  }
  const end = page.locator('#trail-end');
  const shop = end.locator('.shop');
  const doe = shop.getByRole('button', { name: 'Une biche, 2 graines dorées' });
  await expect(doe).toBeEnabled();
  await expect(doe.locator('img')).toHaveAttribute('src', /^data:image\/png/);
  // The fox waits for stage 5: four elements away.
  await expect(shop.getByRole('button', { name: /^Un renard/ })).toContainText('Encore 4 pousses');
  const layout = await page.evaluate(() => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const doc = globalThis.document;
    return {
      card: box(doc.querySelector('#trail-end')!),
      reserve: box(doc.querySelector('#reserve')!),
      buttons: [...doc.querySelectorAll('#trail-end button')].map(box),
    };
  });
  const viewport = page.viewportSize()!;
  expect(layout.card.y).toBeGreaterThan(layout.reserve.y + layout.reserve.height);
  expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(viewport.height);
  for (const box of layout.buttons) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  await test.info().attach('boutique', { body: await page.screenshot(), contentType: 'image/png' });

  // One touch: the seeds are spent, the card steps aside, the doe comes into the meadow.
  const seeds = (await game(page)).seeds;
  await doe.click();
  await expect(page.locator('#arrival')).toHaveText('Une biche arrive !');
  await expect(end).toHaveClass(/away/);
  await test.info().attach('arrivée', { body: await page.screenshot(), contentType: 'image/png' });
  expect((await game(page)).seeds).toBe(seeds - 2);
  expect(await page.evaluate(() => window.__numebois!.describe().animals)).toEqual(['Deer']);
  expect(await animals()).toBe(1);
  await expect(end).not.toHaveClass(/away/, { timeout: 12_000 });
  await expect(page.locator('#arrival')).toHaveCount(0);
  await expect(shop.getByRole('button', { name: /^Une biche/ })).toHaveCount(0);
  await expect(end).toContainText('Ta forêt a grandi !');

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
  // A short trail, then two seasons under the veil: about a minute on CI.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);
  await loadSave(page, {
    version: 4,
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
  // During a question, the season of the painting stays: one season, nothing to touch.
  await expect(picker.getByRole('button')).toHaveCount(1);
  await expect(summer).toBeDisabled();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
  const [bar, trail, sound] = await Promise.all(
    ['#seasons', '#trail', '#sound-toggle'].map(async (s) => (await boxes(page, s))[0]),
  );
  expect(apart(bar, trail) && apart(bar, sound)).toBe(true);

  const { stones } = await game(page);
  for (let stone = 0; stone < stones; stone++) {
    const exercise = await current(page);
    await page.keyboard.type(exercise.answer);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await game(page)).stone, { timeout: 8000 }).toBe(stone + 1);
  }
  const end = page.locator('#trail-end');
  const offer = end.locator('.shop').getByRole('button', { name: 'L’automne, 3 graines dorées' });
  await expect(offer).toBeEnabled();
  await expect(summer).toBeEnabled();

  // One touch: the seeds are spent and autumn comes over the painting, which keeps summer.
  // The announcement is short and the page busy under the veil: an observer keeps what showed.
  await page.evaluate(() => {
    const doc = globalThis.document;
    const seen: string[] = [];
    Object.assign(window, { seen });
    new MutationObserver(() => {
      const text = doc.querySelector('#arrival')?.textContent;
      if (text && !seen.includes(text)) seen.push(text);
      if (doc.querySelector('#trail-end.away') && !seen.includes('away')) seen.push('away');
    }).observe(doc.querySelector('#ui')!, { childList: true, subtree: true, attributes: true });
  });
  await offer.click();
  await expect(autumn).toHaveAttribute('aria-pressed', 'true', { timeout: 12_000 });
  await expect(end).not.toHaveClass(/away/, { timeout: 12_000 });
  await expect(page.locator('#arrival')).toHaveCount(0);
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen.sort()).toEqual(['away', 'L’automne arrive !'].sort());
  expect((await game(page)).seeds).toBe(0);
  expect(await describe()).toMatchObject({ season: 'autumn', seasons: ['summer', 'autumn'] });
  await expect(picker.getByRole('button')).toHaveCount(2);
  await expect(end.locator('.shop').getByRole('button', { name: /^L’automne/ })).toHaveCount(0);
  await test.info().attach('automne', { body: await page.screenshot(), contentType: 'image/png' });

  // One touch on the bar: summer again, nothing else bought.
  await summer.click();
  await expect(summer).toHaveAttribute('aria-pressed', 'true', { timeout: 12_000 });
  await expect(end).not.toHaveClass(/away/, { timeout: 12_000 });
  expect(await describe()).toMatchObject({ season: 'summer', seasons: ['summer', 'autumn'] });
  expect((await game(page)).seeds).toBe(0);

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
  await expect(picker.getByRole('button')).toHaveCount(2);
  await expect(autumn).toBeDisabled();
  expect(errors).toEqual([]);
});

test('le choix : comparer avec <, = ou >, d’une touche, sans rouge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // A save where « comparer » is in progress: the trail warms up with it.
  await loadSave(page, {
    version: 4,
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
  const card = page.locator('#question');
  const signs = card.locator('.choice button');
  await expect(signs).toHaveText(['<', '=', '>']);
  await expectSlateLayout(page);
  const wrongSign = ['<', '=', '>'].find((sign) => sign !== exercise.answer)!;
  await card.getByRole('button', { name: wrongSign, exact: true }).click();
  await expect(card.locator('.hint')).toContainText('Presque !');
  await expect(card.getByRole('button', { name: wrongSign, exact: true })).toHaveClass(/tried/);
  await expectSlateLayout(page);
  await test.info().attach('choix', { body: await page.screenshot(), contentType: 'image/png' });
  await card.getByRole('button', { name: exercise.answer, exact: true }).click();
  // Within the praise, before the next question.
  await expect(card.locator('.choice button.right')).toHaveText(exercise.answer);
  await expect(card.locator('.praise')).toBeVisible();
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
    version: 4,
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
  await expect(reserve).toHaveAttribute('aria-label', reserveLabel(8, 1));
  await expect(reserve.locator('.seeds b')).toHaveText('1');
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
