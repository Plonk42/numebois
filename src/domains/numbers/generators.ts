import type { Exercise } from '../../core/types';
import type { Rng } from '../../core/rng';
import { formatNumber, numberWords } from './words';

export const WRITE_DIGITS = 'numbers.write-digits';

export interface WriteDigitsExercise extends Exercise {
  value: number;
}

/**
 * Levels of « écrire en chiffres »:
 * 0. three digits;
 * 1. four digits, no zero;
 * 2. four digits with an empty rank (zero among the hundreds, tens or units);
 * 3. four digits ending in 70 to 99 (« soixante-dix », « quatre-vingt… »), or 10 000.
 */
export const WRITE_DIGITS_LEVELS = 4;

function drawValue(rng: Rng, level: number): number {
  switch (level) {
    case 0:
      return rng.int(100, 999);
    case 1:
      return rng.int(1, 9) * 1000 + rng.int(1, 9) * 100 + rng.int(1, 9) * 10 + rng.int(1, 9);
    case 2:
      for (;;) {
        const value = rng.int(1000, 9999);
        if (hasEmptyRank(value)) return value;
      }
    case 3:
      if (rng.chance(0.1)) return 10_000;
      return rng.int(1, 9) * 1000 + rng.int(0, 9) * 100 + rng.int(70, 99);
    default:
      throw new RangeError(`niveau ${level}`);
  }
}

/** A zero among the hundreds, tens or units. */
export function hasEmptyRank(value: number): boolean {
  return String(value).slice(1).includes('0');
}

export function generateWriteDigits(rng: Rng, level: number): WriteDigitsExercise {
  const value = drawValue(rng, level);
  return {
    skill: WRITE_DIGITS,
    level,
    instruction: 'Écris ce nombre en chiffres.',
    statement: numberWords(value),
    input: { kind: 'keypad', maxDigits: 5 },
    answer: String(value),
    value,
  };
}

export const READ = 'numbers.read';
export const DECOMPOSE = 'numbers.decompose';
export const COMPARE = 'numbers.compare';
export const ORDER = 'numbers.order';

function levelError(level: number): RangeError {
  return new RangeError(`niveau ${level}`);
}

/** The value with two of its digits swapped, or null when they are equal. */
function swapDigits(value: number, i: number, j: number): number | null {
  const digits = [...String(value)];
  if (digits[i] === digits[j] || (Math.min(i, j) === 0 && digits[Math.max(i, j)] === '0')) {
    return null;
  }
  [digits[i], digits[j]] = [digits[j], digits[i]];
  return Number(digits.join(''));
}

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface ReadExercise extends Exercise {
  value: number;
}

/** Levels of « lire un nombre », as « écrire en chiffres »: the words among 3. */
export const READ_LEVELS = WRITE_DIGITS_LEVELS;

export function generateRead(rng: Rng, level: number): ReadExercise {
  const value = drawValue(rng, level);
  // Close mistakes: two digits swapped, or one rank too far.
  const lures = new Set<number>();
  const length = String(value).length;
  for (let attempt = 0; lures.size < 2 && attempt < 40; attempt++) {
    const lure = rng.chance(0.7)
      ? swapDigits(value, rng.int(0, length - 1), rng.int(0, length - 1))
      : rng.pick([value * 10, Math.floor(value / 10)]);
    if (lure !== null && lure !== value && lure >= 100 && lure <= 10_000) lures.add(lure);
  }
  for (let lure = value - 1; lures.size < 2; lure--) lures.add(lure);
  const answer = numberWords(value);
  return {
    skill: READ,
    level,
    instruction: 'Comment se lit ce nombre ?',
    statement: formatNumber(value),
    input: { kind: 'choice', options: shuffled(rng, [answer, ...[...lures].map(numberWords)]) },
    answer,
    value,
  };
}

/** Compose from the ranks, or find a digit or a count of a rank. */
export interface DecomposeExercise extends Exercise {
  value: number;
  ask: 'compose' | 'digit' | 'count';
  /** 0 units, 1 tens, 2 hundreds, 3 thousands. */
  rank: number;
}

export const RANK_NAMES = [
  ['unité', 'unités'],
  ['dizaine', 'dizaines'],
  ['centaine', 'centaines'],
  ['millier', 'milliers'],
] as const;

/**
 * Levels of « décomposer »:
 * 0. 3 centaines, 2 dizaines, 4 unités → 324;
 * 1. four digits with an empty rank, which is not named: 3 milliers, 4 dizaines, 2 unités;
 * 2. the hundreds (or tens) digit of a four-digit number;
 * 3. the number of tens (or hundreds) in a four-digit number.
 */
export const DECOMPOSE_LEVELS = 4;

export function generateDecompose(rng: Rng, level: number): DecomposeExercise {
  let value: number;
  let ask: DecomposeExercise['ask'] = 'compose';
  let rank = 0;
  if (level === 0) value = rng.int(1, 9) * 100 + rng.int(1, 9) * 10 + rng.int(1, 9);
  else if (level === 1) value = drawValue(rng, 2);
  else if (level === 2 || level === 3) {
    value = rng.int(1000, 9999);
    ask = level === 2 ? 'digit' : 'count';
    rank = rng.int(1, 2);
  } else throw levelError(level);
  const digit = (r: number) => Math.floor(value / 10 ** r) % 10;
  let instruction = 'Écris ce nombre en chiffres.';
  let statement: string;
  let answer: number;
  if (ask === 'compose') {
    statement = [3, 2, 1, 0]
      .filter((r) => digit(r) > 0 && 10 ** r <= value)
      .map((r) => `${digit(r)} ${RANK_NAMES[r][digit(r) >= 2 ? 1 : 0]}`)
      .join(', ');
    answer = value;
  } else if (ask === 'digit') {
    instruction = 'Trouve le chiffre.';
    statement = `Le chiffre des ${RANK_NAMES[rank][1]} de ${formatNumber(value)}`;
    answer = digit(rank);
  } else {
    instruction = 'Compte en tout.';
    statement = `Combien de ${RANK_NAMES[rank][1]} dans ${formatNumber(value)} ?`;
    answer = Math.floor(value / 10 ** rank);
  }
  return {
    skill: DECOMPOSE,
    level,
    instruction,
    statement,
    input: { kind: 'keypad', maxDigits: 4 },
    answer: String(answer),
    value,
    ask,
    rank,
  };
}

export type Sign = '<' | '=' | '>';

export interface CompareExercise extends Exercise {
  a: number;
  b: number;
}

export function signOf(a: number, b: number): Sign {
  if (a < b) return '<';
  return a > b ? '>' : '=';
}

/**
 * Levels of « comparer »:
 * 0. three digits, different hundreds;
 * 1. four digits, same thousands;
 * 2. traps: the same digits in another order, a different number of digits, or equal.
 */
export const COMPARE_LEVELS = 3;

function comparePair(rng: Rng, level: number): [number, number] {
  switch (level) {
    case 0: {
      const [h1, h2] = shuffled(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      return [h1 * 100 + rng.int(0, 99), h2 * 100 + rng.int(0, 99)];
    }
    case 1: {
      const thousands = rng.int(1, 9) * 1000;
      const [x, y] = shuffled(
        rng,
        Array.from({ length: 900 }, (_, i) => i + 100),
      );
      return [thousands + x, thousands + y];
    }
    case 2: {
      const a = rng.int(1000, 9999);
      const trap = rng.next();
      if (trap < 0.2) return [a, a];
      if (trap < 0.4) {
        const small = rng.int(1000, 1999);
        const large = rng.int(Math.max(100, small % 1000), 999);
        return rng.chance(0.5) ? [small, large] : [large, small];
      }
      for (let attempt = 0; attempt < 30; attempt++) {
        const b = swapDigits(a, rng.int(0, 3), rng.int(0, 3));
        if (b !== null && b !== a) return [a, b];
      }
      // Nothing to swap (1 111, 1 000): compare with a neighbour.
      return [a, a + rng.pick([-1, 1])];
    }
    default:
      throw levelError(level);
  }
}

export function generateCompare(rng: Rng, level: number): CompareExercise {
  const [a, b] = comparePair(rng, level);
  return {
    skill: COMPARE,
    level,
    instruction: 'Choisis le bon signe.',
    statement: `${formatNumber(a)}\u00a0?\u00a0${formatNumber(b)}`,
    input: { kind: 'choice', options: ['<', '=', '>'] },
    answer: signOf(a, b),
    a,
    b,
  };
}

export interface OrderExercise extends Exercise {
  values: readonly number[];
  want: 'largest' | 'smallest';
}

/**
 * Levels of « ranger »: find the largest or the smallest of
 * 0. three numbers of three digits;
 * 1. four numbers of four digits with the same thousands;
 * 2. four numbers with the same digits, or of three and four digits.
 */
export const ORDER_LEVELS = 3;

function orderValues(rng: Rng, level: number): number[] {
  const values = new Set<number>();
  if (level === 0) while (values.size < 3) values.add(rng.int(100, 999));
  else if (level === 1) {
    const thousands = rng.int(1, 9) * 1000;
    while (values.size < 4) values.add(thousands + rng.int(0, 999));
  } else if (level === 2) {
    const base = rng.int(1000, 9999);
    values.add(base);
    for (let attempt = 0; values.size < 4 && attempt < 30; attempt++) {
      const other = swapDigits(base, rng.int(0, 3), rng.int(0, 3));
      if (other !== null) values.add(other);
    }
    while (values.size < 4) values.add(rng.int(100, 999));
  } else throw levelError(level);
  return [...values];
}

export function generateOrder(rng: Rng, level: number): OrderExercise {
  const values = orderValues(rng, level);
  const want = rng.chance(0.5) ? 'largest' : 'smallest';
  const target = want === 'largest' ? Math.max(...values) : Math.min(...values);
  return {
    skill: ORDER,
    level,
    instruction: 'Range ces nombres dans ta tête.',
    statement: want === 'largest' ? 'Le plus grand ?' : 'Le plus petit ?',
    input: { kind: 'choice', options: values.map((value) => formatNumber(value)) },
    answer: formatNumber(target),
    values,
    want,
  };
}
