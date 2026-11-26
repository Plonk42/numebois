import type { Exercise, Figure, NumberLine } from '../../core/types';
import { Rng } from '../../core/rng';
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

/** How a number to decompose is shown, to work several methods. */
export type DecomposeShow =
  /** « 3 centaines, 2 dizaines, 4 unités » (an empty rank left out), or the question in a sentence. */
  | 'words'
  /** Every rank in order, the empty one too: « 3 milliers, 0 centaine, 4 dizaines, 2 unités ». */
  | 'named'
  /** The same ranks in another order: « 4 unités, 3 centaines, 2 dizaines ». */
  | 'mixed'
  /** 300 + 20 + 4. */
  | 'sum'
  /** Plates, bars and cubes (`Figure` blocks). */
  | 'blocks'
  /** The number in the place-value table, to read a column (`Figure` place-value). */
  | 'table';

/** Compose from the ranks, or find a digit or a count of a rank. */
export interface DecomposeExercise extends Exercise {
  value: number;
  ask: 'compose' | 'digit' | 'count';
  /** 0 units, 1 tens, 2 hundreds, 3 thousands. */
  rank: number;
  show: DecomposeShow;
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
 * 1. four digits with an empty rank, named or not: 3 milliers, 4 dizaines, 2 unités;
 * 2. the hundreds (or tens) digit of a four-digit number;
 * 3. the number of tens (or hundreds) in a four-digit number.
 */
export const DECOMPOSE_LEVELS = 4;

/**
 * The ways of showing each level: the easy ones, where the digits are almost copied (they
 * reassure), and the ones that work a method.
 */
export const DECOMPOSE_SHOWS: readonly {
  easy: readonly DecomposeShow[];
  effort: readonly DecomposeShow[];
}[] = [
  { easy: ['words', 'sum'], effort: ['mixed', 'blocks'] },
  { easy: ['named'], effort: ['words', 'mixed', 'sum'] },
  { easy: ['table'], effort: ['words'] },
  { easy: ['table'], effort: ['words'] },
];
/** Share of the easy ways at each level (owner, #110). */
export const EASY_SHOW_SHARE = 1 / 4;

/** The ranks of `value`, as words (in order or not, the empty one named or not) or as a sum. */
function composeStatement(rng: Rng, value: number, ranks: number[], show: DecomposeShow): string {
  if (show === 'blocks') return 'Quel nombre\u00a0?';
  const digit = (r: number) => Math.floor(value / 10 ** r) % 10;
  let parts = show === 'named' ? ranks : ranks.filter((r) => digit(r) > 0);
  if (show === 'sum') return parts.map((r) => formatNumber(digit(r) * 10 ** r)).join(' + ');
  if (show === 'mixed' && parts.length > 1) {
    const order = parts;
    while (parts.every((r, i) => r === order[i])) parts = shuffled(rng, order);
  }
  return parts.map((r) => `${digit(r)} ${RANK_NAMES[r][digit(r) >= 2 ? 1 : 0]}`).join(', ');
}

/** A number to write in digits from its ranks, shown as `show` (`rng` only shuffles `mixed`). */
export function composeExercise(
  value: number,
  show: DecomposeShow,
  level: number,
  rng = new Rng(0),
): DecomposeExercise {
  const digit = (r: number) => Math.floor(value / 10 ** r) % 10;
  const ranks = [3, 2, 1, 0].filter((r) => 10 ** r <= value);
  return {
    skill: DECOMPOSE,
    level,
    instruction: 'Écris ce nombre en chiffres.',
    statement: composeStatement(rng, value, ranks, show),
    ...(show === 'blocks' && {
      figure: { kind: 'blocks', hundreds: digit(2), tens: digit(1), units: digit(0) },
    }),
    input: { kind: 'keypad', maxDigits: 4, inline: show === 'sum' },
    answer: String(value),
    value,
    ask: 'compose',
    rank: 0,
    show,
  };
}

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
  const shows = DECOMPOSE_SHOWS[level];
  const show = rng.pick(rng.chance(EASY_SHOW_SHARE) ? shows.easy : shows.effort);
  if (ask === 'compose') return composeExercise(value, show, level, rng);
  const digit = (r: number) => Math.floor(value / 10 ** r) % 10;
  const ranks = [3, 2, 1, 0].filter((r) => 10 ** r <= value);
  let instruction = 'Trouve le chiffre.';
  let statement: string;
  let answer: number;
  const figure: Figure | undefined =
    show === 'table' ? { kind: 'place-value', digits: ranks.map(digit) } : undefined;
  if (ask === 'digit') {
    statement =
      show === 'table'
        ? `Le chiffre des ${RANK_NAMES[rank][1]}\u00a0?`
        : `Le chiffre des ${RANK_NAMES[rank][1]} de ${formatNumber(value)}`;
    answer = digit(rank);
  } else {
    instruction = 'Compte en tout.';
    statement =
      show === 'table'
        ? `Combien de ${RANK_NAMES[rank][1]} en tout\u00a0?`
        : `Combien de ${RANK_NAMES[rank][1]} dans ${formatNumber(value)} ?`;
    answer = Math.floor(value / 10 ** rank);
  }
  return {
    skill: DECOMPOSE,
    level,
    instruction,
    statement,
    ...(figure && { figure }),
    input: { kind: 'keypad', maxDigits: 4, inline: show === 'sum' },
    answer: String(answer),
    value,
    ask,
    rank,
    show,
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
    input: { kind: 'compare', left: formatNumber(a), right: formatNumber(b) },
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

export const LINE_READ = 'numbers.number-line-read';
export const LINE_PLACE = 'numbers.number-line-place';

/**
 * Levels of the number line, 11 ticks, for both notions:
 * 0. 0 to 10 by 1, numbers under 0, 5 and 10;
 * 1. 0 to 100 by 10, numbers under 0, 50 and 100;
 * 2. a ten, 40 to 50 by 1, numbers at both ends;
 * 3. a hundred, 300 to 400 by 10, numbers at both ends;
 * 4. a thousand, 2 000 to 3 000 by 100, numbers at both ends.
 */
export const NUMBER_LINE_LEVELS = 5;

function drawLine(rng: Rng, level: number): NumberLine {
  if (level === 0) return { from: 0, to: 10, step: 1, labels: [0, 5, 10] };
  if (level === 1) return { from: 0, to: 100, step: 10, labels: [0, 50, 100] };
  if (level > 4) throw levelError(level);
  const step = 10 ** (level - 2);
  const from = rng.int(1, 9) * step * 10;
  return { from, to: from + step * 10, step, labels: [from, from + step * 10] };
}

/** A tick without its number. */
function drawTick(rng: Rng, line: NumberLine): number {
  const ticks = Array.from(
    { length: (line.to - line.from) / line.step + 1 },
    (_, i) => line.from + i * line.step,
  );
  return rng.pick(ticks.filter((tick) => !line.labels.includes(tick)));
}

export interface NumberLineExercise extends Exercise {
  line: NumberLine;
  value: number;
}

export function generateLineRead(rng: Rng, level: number): NumberLineExercise {
  const line = drawLine(rng, level);
  const value = drawTick(rng, line);
  return {
    skill: LINE_READ,
    level,
    instruction: 'Lis la droite graduée.',
    statement: 'Quel nombre montre la flèche ?',
    figure: { kind: 'number-line', line, arrow: value },
    input: { kind: 'keypad', maxDigits: 4 },
    answer: String(value),
    line,
    value,
  };
}

export function generateLinePlace(rng: Rng, level: number): NumberLineExercise {
  const line = drawLine(rng, level);
  const value = drawTick(rng, line);
  return {
    skill: LINE_PLACE,
    level,
    instruction: 'Place ce nombre sur la droite.',
    statement: formatNumber(value),
    input: { kind: 'number-line', line },
    answer: String(value),
    line,
    value,
  };
}
