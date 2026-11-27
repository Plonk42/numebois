import type { Rng } from '../../core/rng';
import type { Exercise, Whole, WholeShape } from '../../core/types';
import { MAX_DENOMINATOR, fractionWords } from './words';

export const READ = 'fractions.read';

/** A fraction as written in the statements and answers: « 6/9 ». */
export const fractionText = (n: number, d: number) => `${n}/${d}`;

/** The wholes of the statements, after « de »: « 3/4 de la galette ». */
export const SHAPE_NAMES: Record<WholeShape, string> = {
  disc: 'la galette',
  strip: 'la bande',
  bar: 'la tablette',
  log: 'la tranche de tronc',
};

/** A bar of chocolate is a grid: only for a number of parts that makes one. */
const BAR_PARTS = new Set([4, 6, 8, 9, 10, 12]);

/** A shape that can be shared in `parts`. */
export function shapeFor(rng: Rng, parts: number): WholeShape {
  const shapes: WholeShape[] = ['disc', 'strip', 'log'];
  if (BAR_PARTS.has(parts)) shapes.push('bar');
  return rng.pick(shapes);
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Write the fraction of a whole drawn, colour a fraction given, or choose how it is read. */
export type ReadForm = 'write' | 'colour' | 'words';

/**
 * Levels (#61), denominators up to 12, fractions up to 1 (programme du CE2):
 * 0. a half, a third, a quarter: 1/2, 1/3, 1/4;
 * 1. more than one part, up to sixths: 2/3, 3/4, 5/6;
 * 2. up to twelfths: 6/9, 7/12;
 * 3. up to twelfths, and now and then the whole: 5/5.
 */
export const READ_LEVELS = 4;

export interface ReadExercise extends Exercise {
  numerator: number;
  denominator: number;
  form: ReadForm;
}

function drawFraction(rng: Rng, level: number): [number, number] {
  if (level === 0) return [1, rng.int(2, 4)];
  if (level === 1) {
    const d = rng.int(3, 6);
    return [rng.int(2, d - 1), d];
  }
  const d = rng.int(level === 2 ? 5 : 2, MAX_DENOMINATOR);
  if (level === 3 && rng.chance(1 / 5)) return [d, d];
  return [rng.int(1, d - 1), d];
}

/** How a fraction is read, and three ways it is not: the numbers the other way round, a part too many. */
export function wordChoices(rng: Rng, n: number, d: number): string[] {
  const right = fractionWords(n, d);
  const fits = ([a, b]: [number, number]) => a >= 1 && b >= 2 && b <= MAX_DENOMINATOR && a <= 12;
  const swapped: [number, number][] = n >= 2 && n !== d ? [[d, n]] : [];
  const near: [number, number][] = [
    [n, d + 1],
    [n, d - 1],
    [n + 1, d],
    [n - 1, d],
  ];
  const far: [number, number][] = [
    [n, d + 2],
    [n + 2, d],
    [n, d - 2],
    [n - 2, d],
  ];
  const lures: string[] = [];
  for (const pair of [...swapped, ...shuffle(rng, near), ...shuffle(rng, far)]) {
    const text = fits(pair) ? fractionWords(...pair) : null;
    if (text && text !== right && !lures.includes(text) && lures.length < 3) lures.push(text);
  }
  return shuffle(rng, [right, ...lures]);
}

export function generateRead(rng: Rng, level: number): ReadExercise {
  if (level < 0 || level >= READ_LEVELS) throw new RangeError(`niveau ${level}`);
  const [n, d] = drawFraction(rng, level);
  const form = rng.pick<ReadForm>(['write', 'colour', 'words']);
  return readExercise(rng, level, form, n, d, shapeFor(rng, d));
}

/** The fraction n/d of a whole of this shape, to write, to colour or to read (an astuce too). */
export function readExercise(
  rng: Rng,
  level: number,
  form: ReadForm,
  n: number,
  d: number,
  shape: WholeShape,
): ReadExercise {
  const base = { skill: READ, level, numerator: n, denominator: d, form };
  const whole: Whole = { shape, parts: d, coloured: n };
  if (form === 'write') {
    return {
      ...base,
      instruction: 'Écris la fraction coloriée.',
      statement: `Quelle fraction de ${SHAPE_NAMES[shape]} est coloriée ?`,
      figure: { kind: 'fraction', wholes: [whole] },
      input: { kind: 'fraction' },
      answer: fractionText(n, d),
    };
  }
  if (form === 'colour') {
    return {
      ...base,
      instruction: 'Touche les parts à colorier.',
      statement: `Colorie ${fractionText(n, d)} de ${SHAPE_NAMES[shape]}.`,
      input: { kind: 'parts', shape, parts: d },
      answer: String(n),
    };
  }
  return {
    ...base,
    instruction: 'Choisis comment se lit cette fraction.',
    statement: fractionText(n, d),
    input: { kind: 'choice', options: wordChoices(rng, n, d) },
    answer: fractionWords(n, d),
  };
}
