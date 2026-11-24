import { expect, type Page } from '@playwright/test';
import type { ExerciseInput } from '../../src/core/types';

export async function game(page: Page) {
  return (await page.evaluate(() => window.__numebois!.game()))!;
}

/** The game opens on the landscape: a touch on the trail, at the bottom, starts it. */
export async function startTrail(page: Page) {
  await page.getByRole('button', { name: 'Chemin du progrès' }).click();
  await expect(page.locator('#question')).toBeVisible();
}

/** The exercise on the slate, once it waits for an answer. */
export async function current(page: Page) {
  // The stone counts as soon as the answer is right: the praised question stays a moment, locked.
  await expect.poll(async () => (await game(page)).phase).toBe('asking');
  const statement = await page.locator('#question .statement').textContent();
  await expect.poll(async () => (await game(page)).exercise?.statement).toBe(statement);
  return (await game(page)).exercise!;
}

/** A wrong answer: the expected one with its last digit changed. */
export function wrong(answer: string): string {
  const last = Number(answer.at(-1));
  return answer.slice(0, -1) + String((last + 1) % 10);
}

/** How a test answers through a widget, as the child would. */
export interface Driver<I extends ExerciseInput> {
  answer(page: Page, input: I, value: string): Promise<void>;
  /** Answers other than the expected one: two when the widget allows them. */
  wrongs(input: I, expected: string): string[];
}

/** One driver per kind of input: a new kind does not compile without its driver. */
const DRIVERS: { [K in ExerciseInput['kind']]: Driver<Extract<ExerciseInput, { kind: K }>> } = {
  keypad: {
    async answer(page, input, value) {
      for (let i = 0; i < input.maxDigits; i++) await page.keyboard.press('Backspace');
      await page.keyboard.type(value);
      await page.keyboard.press('Enter');
    },
    wrongs: (_, expected) =>
      [1, 2].map((shift) => expected.slice(0, -1) + String((Number(expected.at(-1)) + shift) % 10)),
  },
  choice: {
    answer: (page, _, value) =>
      page.locator('#question .choice').getByRole('button', { name: value, exact: true }).click(),
    wrongs: (input, expected) => input.options.filter((option) => option !== expected).slice(0, 2),
  },
  'number-line': {
    async answer(page, _, value) {
      // A tick is a line without width: the finger lands on the drawing, above it.
      const line = page.locator('#question .number-line.place');
      const x = await line
        .locator(`[data-value="${value}"]`)
        .evaluate((tick) => tick.getBoundingClientRect().x);
      const box = (await line.boundingBox())!;
      await page.mouse.click(x, box.y + box.height / 2);
      await page.locator('#question .submit').click();
    },
    wrongs: ({ line }, expected) =>
      [1, -1]
        .map((side) => Number(expected) + side * line.step)
        .filter((value) => value >= line.from && value <= line.to)
        .map(String),
  },
};

export function driver(input: ExerciseInput): Driver<ExerciseInput> {
  return DRIVERS[input.kind] as Driver<ExerciseInput>;
}

/** Writes a save in IndexedDB, as the game does, then reloads the page. */
export async function loadSave(page: Page, save: object) {
  const painting = {
    biome: 'clearing',
    seed: 3,
    stage: 0,
    season: 'summer',
    seasons: ['summer'],
    elements: [],
    animals: [],
  };
  const journal = { started: 0, acquired: [], automated: [] };
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
    JSON.stringify({ painting, journal, ...save }),
  );
  await page.reload();
  await page.evaluate(() => window.__numebois!.ready);
}

export const reserveLabel = (leaves: number, seeds = 0) =>
  `Réserve : ${leaves} feuille${leaves > 1 ? 's' : ''}, ${seeds} graine${seeds > 1 ? 's' : ''} dorée${seeds > 1 ? 's' : ''}`;

export type Box = { x: number; y: number; width: number; height: number };

export function apart(a: Box, b: Box): boolean {
  return (
    a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y
  );
}

/** Boxes of elements, measured in a single round trip (each one costs about a second on CI). */
export async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.evaluate(
    (s) =>
      [...globalThis.document.querySelectorAll(s)].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    selector,
  );
}

/** The slate stays clear of the bars, on screen, without scrolling, every key 56 px or more. */
export async function expectSlateLayout(page: Page) {
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
    expect(apart(cardBox, box), other).toBe(true);
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
