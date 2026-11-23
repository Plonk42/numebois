import { expect, test, type Page } from '@playwright/test';

async function game(page: Page) {
  return (await page.evaluate(() => window.__numebois!.game()))!;
}

/** The exercise on the slate. */
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

/** Writes a save in IndexedDB, as the game does, then reloads the page. */
async function loadSave(page: Page, save: object) {
  const painting = { seed: 3, stage: 0, season: 'summer', elements: [], landmarks: [] };
  await page.evaluate(
    (json) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('numebois', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('kv');
        request.onsuccess = () => {
          const transaction = request.result.transaction('kv', 'readwrite');
          transaction.objectStore('kv').put(json, 'numebois:save');
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(new Error('écriture impossible'));
        };
      }),
    JSON.stringify({ painting, ...save }),
  );
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
}

const reserveLabel = (leaves: number, seeds = 0) =>
  `Réserve : ${leaves} feuille${leaves > 1 ? 's' : ''}, ${seeds} graine${seeds > 1 ? 's' : ''} dorée${seeds > 1 ? 's' : ''}`;

type Box = { x: number; y: number; width: number; height: number };

function apart(a: Box, b: Box): boolean {
  return (
    a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y
  );
}

/** Boxes of elements, measured in a single round trip (each one costs about a second on CI). */
async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.evaluate(
    (s) =>
      [...globalThis.document.querySelectorAll(s)].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    selector,
  );
}

/** The slate stays under the top bar, on screen, without scrolling, every key 56 px or more. */
async function expectSlateLayout(page: Page) {
  const viewport = page.viewportSize()!;
  const layout = await page.evaluate(() => {
    const doc = globalThis.document;
    const box = (element: Element | null) => {
      if (!element) return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const card = doc.querySelector('#question')!;
    return {
      card: box(card)!,
      bars: ['#reserve', '#trail', '#sound-toggle'].map((s) => [s, box(doc.querySelector(s))!]),
      scrolled: [card, ...card.querySelectorAll('.bench > *')]
        .filter((el) => el.scrollHeight > el.clientHeight + 1)
        .map((el) => el.className),
      keys: [...card.querySelectorAll('button')].map((key) => box(key)!),
      hint: box(card.querySelector('.hint')),
      zone: box(card.querySelector('.answer-zone')),
    };
  });
  const cardBox = layout.card;
  for (const [other, box] of layout.bars as [string, Box][]) {
    expect(cardBox.y, other).toBeGreaterThan(box.y + box.height);
  }
  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height);
  expect(layout.scrolled).toEqual([]);
  for (const box of layout.keys) {
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
  }
  // Plume's bubble never covers the answer zone.
  if (layout.hint) expect(apart(layout.hint, layout.zone!)).toBe(true);
}

test('une boucle jouable : questions, indices et feuilles', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?seed=3');
  await page.evaluate(() => window.__numebois!.ready);

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
  await test.info().attach('résumé', { body: await page.screenshot(), contentType: 'image/png' });

  // Four leaves each: the child chooses among the glowing places, the element grows there,
  // and passes a stage under a veil of light.
  const describe = () => page.evaluate(() => window.__numebois!.describe());
  expect(await describe()).toMatchObject({ seed: 3, stage: 0, elements: [] });
  for (let placed = 1; placed <= 2; placed++) {
    await page.getByRole('button', { name: 'Faire pousser' }).click();
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
  await expect(page.getByRole('button', { name: 'Faire pousser' })).toHaveCount(0);
  await expect(end).toContainText('Encore 2 feuilles pour faire pousser ta forêt.');

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

test('le choix : comparer avec <, = ou >, d’une touche, sans rouge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?stage=0');
  await page.evaluate(() => window.__numebois!.ready);
  // A save where « comparer » is in progress: the trail warms up with it.
  await loadSave(page, {
    version: 1,
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
    version: 1,
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
