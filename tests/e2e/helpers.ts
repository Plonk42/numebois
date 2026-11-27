import { expect, type Page } from '@playwright/test';
import { onDial, parseTime, timeText, type TimeOfDay } from '../../src/core/time';
import type { Column, ExerciseInput } from '../../src/core/types';

export async function game(page: Page) {
  return (await page.evaluate(() => window.__numebois!.game()))!;
}

/** The game opens on the landscape: a touch on the trail, at the bottom, starts it. */
export async function startTrail(page: Page) {
  await page.getByRole('button', { name: 'Chemin du progrès' }).click();
  await expect(page.locator('#question')).toBeVisible();
}

/** The number of the question each exercise was read at (`GameProbe.asked`). */
const askedAt = new WeakMap<object, number>();

/** The exercise on the slate, once it waits for an answer. */
export async function current(page: Page) {
  // The stone counts as soon as the answer is right: the praised question stays a moment, locked.
  await expect.poll(async () => (await game(page)).phase).toBe('asking');
  const statement = await page
    .locator('#question .statement')
    .evaluate((node) => node.getAttribute('aria-label') ?? node.textContent);
  await expect.poll(async () => (await game(page)).exercise?.statement).toBe(statement);
  const { exercise, asked } = await game(page);
  askedAt.set(exercise!, asked);
  return exercise!;
}

/**
 * The answer to `exercise` was taken: in a drill or a challenge, the next question may come
 * before the probe shows anything else, and may be the same fact again, so a question asked
 * after it counts too.
 */
export async function answered(page: Page, exercise: { statement: string }) {
  const asked = askedAt.get(exercise);
  await expect
    .poll(async () => {
      const now = await game(page);
      if (now.phase !== 'asking') return true;
      return asked === undefined
        ? now.exercise?.statement !== exercise.statement
        : now.asked !== asked;
    })
    .toBe(true);
}

/**
 * In a drill or a challenge, the answer shown after a mistake stays under 2 s: an observer in
 * the page keeps what it showed, however slow the runner. Call it before the wrong answer, then
 * `revealed`.
 */
export async function watchReveal(page: Page) {
  await page.evaluate(() => {
    const doc = globalThis.document;
    const seen = globalThis as unknown as { revealed: { answer: string; hint: boolean } | null };
    seen.revealed = null;
    const observer = new MutationObserver(() => {
      const shown = doc.querySelector('#question .shown');
      if (!shown) return;
      seen.revealed = {
        answer: shown.textContent ?? '',
        hint: doc.querySelector('#question .hint') !== null,
      };
      observer.disconnect();
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
  });
}

/**
 * What the answer shown after the mistake to `exercise` looked like (`watchReveal`), once the
 * probe has caught up with the page: the next `current` reads the next question.
 */
export async function revealed(page: Page, exercise: { statement: string }) {
  const read = () => page.evaluate(() => (globalThis as unknown as { revealed: unknown }).revealed);
  await expect.poll(read).not.toBeNull();
  await answered(page, exercise);
  return (await read()) as { answer: string; hint: boolean };
}

/** A wrong answer: the expected one with its last digit changed. */
export function wrong(answer: string): string {
  const last = Number(answer.at(-1));
  return answer.slice(0, -1) + String((last + 1) % 10);
}

/** How a choice is written on its button: a number offered among choices is grouped (3 240). */
export function shownChoice(option: string): string {
  return /^\d{4,}$/.test(option) ? `${option.slice(0, -3)}\u202f${option.slice(-3)}` : option;
}

/** How a test answers through a widget, as the child would. */
export interface Driver<I extends ExerciseInput> {
  answer(page: Page, input: I, value: string): Promise<void>;
  /** Answers other than the expected one: two when the widget allows them. */
  wrongs(input: I, expected: string): string[];
}

const RANK_NAMES = ['unités', 'dizaines', 'centaines', 'milliers'];

/** The box of a number being set out in the grid of a column operation (#158). */
export const rowBox = (page: Page, row: number, rank: number) =>
  page
    .locator('#question')
    .getByRole('button', { name: `Ligne ${row + 1}, ${RANK_NAMES[rank]}`, exact: true });

/** Sets the numbers out right, with a touch or digit by digit, while the question asks it. */
export async function poseColumns(
  page: Page,
  { rows, setup }: Extract<ExerciseInput, { kind: 'column' }>,
) {
  if (!setup || (await page.locator('#question .box.term').count()) === 0) return;
  for (const [row, n] of rows.entries()) {
    await rowBox(page, row, String(n).length - 1).dispatchEvent('pointerdown');
    if (setup === 'write') await page.keyboard.type(String(n));
  }
  if (setup === 'write') await page.keyboard.press('Enter');
  await expect(page.locator('#question .box.term')).toHaveCount(0);
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
      page
        .locator('#question .choice')
        .getByRole('button', { name: shownChoice(value), exact: true })
        .click(),
    wrongs: (input, expected) => input.options.filter((option) => option !== expected).slice(0, 2),
  },
  compare: {
    async answer(page, _, value) {
      const card = page.locator('#question');
      await card.locator('.choice').getByRole('button', { name: value, exact: true }).click();
      await card.locator('.submit').click();
    },
    wrongs: (_, expected) => ['<', '=', '>'].filter((sign) => sign !== expected),
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
  column: {
    async answer(page, input, value) {
      const { columns, mode } = input;
      await poseColumns(page, input);
      const typed = columnKeys(columns, value);
      if (mode === 'alone') {
        await page.getByRole('button', { name: 'Chiffre des unités' }).dispatchEvent('pointerdown');
      }
      await page.keyboard.type(typed.join(''));
      if (mode === 'alone') await page.keyboard.press('Enter');
    },
    // Guided or accompanied, a wrong digit waits in its column: never sent.
    wrongs: ({ mode }, expected) =>
      mode === 'alone'
        ? [1, 2].map(
            (shift) => expected.slice(0, -1) + String((Number(expected.at(-1)) + shift) % 10),
          )
        : [],
  },
  time: {
    async answer(page, input, value) {
      const time = parseTime(value)!;
      const pad = (n = 0) => String(n).padStart(2, '0');
      const parts = [String(time.hours), pad(time.minutes), pad(time.seconds)];
      const boxes = ['Heures', 'Minutes', 'Secondes'].slice(0, input.seconds ? 3 : 2);
      // A touch on a box empties it, then the digits are written in it.
      for (const [i, name] of boxes.entries()) {
        await page
          .locator('#question .time-entry')
          .getByRole('button', { name, exact: true })
          .dispatchEvent('pointerdown');
        await page.keyboard.type(parts[i]);
      }
      await page.keyboard.press('Enter');
    },
    wrongs: (_, expected) => {
      const time = parseTime(expected)!;
      return [
        timeText({ ...time, hours: (time.hours + 1) % 24 }),
        timeText({ ...time, minutes: (time.minutes + 5) % 60 }),
      ];
    },
  },
  clock: {
    // The arrows turn the hands from where they are: by `step` minutes, or by an hour.
    async answer(page, { step }, value) {
      const clock = page.locator('#question .clock.set');
      const onFace = ({ hours, minutes }: TimeOfDay) => (hours % 12) * 60 + minutes;
      const from = onFace(parseTime((await clock.getAttribute('data-time'))!)!);
      const gap = onFace(parseTime(value)!) - from;
      const hours = Math.trunc(gap / 60);
      const minutes = (gap - hours * 60) / step;
      for (let i = 0; i < Math.abs(hours); i++) {
        await page.keyboard.press(hours > 0 ? 'ArrowUp' : 'ArrowDown');
      }
      for (let i = 0; i < Math.abs(minutes); i++) {
        await page.keyboard.press(minutes > 0 ? 'ArrowRight' : 'ArrowLeft');
      }
      await expect(clock).toHaveAttribute('data-time', value);
      await page.keyboard.press('Enter');
    },
    wrongs: (_, expected) => {
      const { hours, minutes } = parseTime(expected)!;
      return [timeText(onDial(hours + 1, minutes)), timeText(onDial(hours, (minutes + 5) % 60))];
    },
  },
  ruler: {
    async answer(page, _, value) {
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(value);
      await page.keyboard.press('Enter');
    },
    wrongs: (_, expected) => [Number(expected) + 1, Number(expected) - 1].map(String),
  },
  draw: {
    // The arrows lengthen or shorten the line drawn from the point, by a millimetre.
    async answer(page, _, value) {
      const sheet = page.locator('#question .sheet.draw');
      const gap = Number(value) - Number(await sheet.getAttribute('data-length'));
      for (let i = 0; i < Math.abs(gap); i++) {
        await page.keyboard.press(gap > 0 ? 'ArrowRight' : 'ArrowLeft');
      }
      await expect(sheet).toHaveAttribute('data-length', value);
      await page.keyboard.press('Enter');
    },
    // A pencil line is a millimetre wide: 3 mm off is another length.
    wrongs: (_, expected) => [Number(expected) + 3, Number(expected) - 3].map(String),
  },
  fraction: {
    // A touch on a box empties it, then its number is written in it.
    async answer(page, _, value) {
      const entry = page.locator('#question .fraction-entry');
      for (const [i, name] of ['Numérateur', 'Dénominateur'].entries()) {
        await entry.getByRole('button', { name, exact: true }).dispatchEvent('pointerdown');
        await page.keyboard.type(value.split('/')[i]);
      }
      await page.keyboard.press('Enter');
    },
    wrongs: (_, expected) => {
      const [n, d] = expected.split('/').map(Number);
      return [`${n + 1}/${d}`, `${n}/${d + 1}`];
    },
  },
  parts: {
    // A touch on a part colours it or takes its colour off: the first ones coloured.
    async answer(page, { parts }, value) {
      const whole = page.locator('#question .whole.touch');
      const on = await whole
        .locator('.part')
        .evaluateAll((paths) =>
          paths.map((path) => /\b(on|tried)\b/.test(path.getAttribute('class') ?? '')),
        );
      for (let i = 0; i < parts; i++) {
        if (on[i] !== i < Number(value)) {
          await whole.locator(`[data-part="${i}"]`).dispatchEvent('pointerdown');
        }
      }
      await page.locator('#question .submit').click();
    },
    wrongs: ({ parts }, expected) =>
      [Number(expected) + 1, Number(expected) - 1].filter((n) => n >= 1 && n <= parts).map(String),
  },
};

export function driver(input: ExerciseInput): Driver<ExerciseInput> {
  return DRIVERS[input.kind] as Driver<ExerciseInput>;
}

/**
 * The keys of a column operation as the cursor goes, from the units: the digit of each column,
 * then its carry; a number written whole from its left digit (#164).
 */
export function columnKeys(columns: readonly Column[], value: string): string[] {
  const typed: string[] = [];
  let i = 0;
  while (i < columns.length) {
    let end = i;
    while (columns[end + 1]?.joined) end++;
    for (let j = end; j >= i; j--) typed.push(value.at(-1 - j) ?? '0');
    if (columns[i].carry > 0 && end + 1 < columns.length) typed.push(String(columns[i].carry));
    i = end + 1;
  }
  return typed;
}

/** Writes a save in IndexedDB, as the game does, then reloads the page. */
export async function loadSave(page: Page, save: object) {
  const painting = {
    biome: 'clearing',
    seed: 3,
    stage: 0,
    season: 'summer',
    seasons: ['summer'],
    night: 'none',
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
      // A bar out of sight (the trail during an astuce) covers nothing.
      bars: ['#reserve', '#trail', '#sound-toggle']
        .map((s) => doc.querySelector(s)!)
        .filter((bar) => getComputedStyle(bar).opacity !== '0')
        .map((bar) => [`#${bar.id}`, box(bar)!]),
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
