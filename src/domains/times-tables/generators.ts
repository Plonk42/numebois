import type { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';

export const PRODUCTS = 'times-tables.products';
export const MISSING_FACTOR = 'times-tables.missing-factor';

/** Keeps an operation on one line. */
const SPACE = '\u00a0';

/**
 * Tables of each level, for both notions:
 * 0. tables of 2, 5 and 10;
 * 1. tables of 3 and 4;
 * 2. tables of 6 and 9;
 * 3. tables of 7 and 8;
 * 4. all the tables from 2 to 10, mixed.
 */
export const TABLES_BY_LEVEL: readonly (readonly number[])[] = [
  [2, 5, 10],
  [3, 4],
  [6, 9],
  [7, 8],
  [2, 3, 4, 5, 6, 7, 8, 9, 10],
];
export const TABLES_LEVELS = TABLES_BY_LEVEL.length;
/** The other factor: × 1 is left out, it teaches nothing. */
export const MIN_FACTOR = 2;
export const MAX_FACTOR = 10;

/** `a × b`, in the order shown; the table is either factor (commutativity). */
export interface ProductExercise extends Exercise {
  a: number;
  b: number;
}

/** A factor of the level's tables and another one, in a random order. */
function drawFactors(rng: Rng, level: number): [number, number] {
  const tables = TABLES_BY_LEVEL[level];
  if (!tables) throw new RangeError(`niveau ${level}`);
  const table = rng.pick(tables);
  const other = rng.int(MIN_FACTOR, MAX_FACTOR);
  return rng.chance(0.5) ? [table, other] : [other, table];
}

export function generateProduct(rng: Rng, level: number): ProductExercise {
  const [a, b] = drawFactors(rng, level);
  return product(a, b, level);
}

/** The first level whose tables hold either factor. */
export function levelOfProduct(a: number, b: number): number {
  return TABLES_BY_LEVEL.findIndex((tables) => tables.includes(a) || tables.includes(b));
}

export function product(a: number, b: number, level: number): ProductExercise {
  return {
    skill: PRODUCTS,
    level,
    instruction: 'Calcule de tête.',
    statement: `${a}${SPACE}×${SPACE}${b}`,
    input: { kind: 'keypad', maxDigits: 3, inline: true },
    answer: String(a * b),
    a,
    b,
  };
}

/** `a × ? = a × b` or `? × b = a × b`: the factor of the table stays shown. */
export interface MissingFactorExercise extends Exercise {
  a: number;
  b: number;
  hidden: 'a' | 'b';
}

export function generateMissingFactor(rng: Rng, level: number): MissingFactorExercise {
  const [a, b] = drawFactors(rng, level);
  return missingFactor(rng, a, b, level);
}

export function missingFactor(
  rng: Rng,
  a: number,
  b: number,
  level: number,
): MissingFactorExercise {
  const tables = TABLES_BY_LEVEL[level];
  // The table is the shown factor; with two tables of the level, either one.
  let hidden: 'a' | 'b' = rng.pick(['a', 'b']);
  if (!tables.includes(a)) hidden = 'a';
  else if (!tables.includes(b)) hidden = 'b';
  const product = a * b;
  const left = hidden === 'a' ? '?' : String(a);
  const right = hidden === 'b' ? '?' : String(b);
  return {
    skill: MISSING_FACTOR,
    level,
    instruction: 'Trouve le nombre qui manque.',
    statement: [left, '×', right, '=', String(product)].join(SPACE),
    input: { kind: 'keypad', maxDigits: 2, inline: true },
    answer: String(hidden === 'a' ? a : b),
    a,
    b,
    hidden,
  };
}
