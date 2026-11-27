import type { Rng } from '../../core/rng';
import type { Exercise, Figure } from '../../core/types';
import { formatNumber } from '../numbers/words';

export const RELATIONS_SKILL = 'units.relations';
export const CONVERT = 'units.convert';

/** Keeps a quantity and its unit on one line. */
const SPACE = '\u00a0';

/** The columns of a conversion table, from the largest unit. */
export const TABLES = {
  length: ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'],
  mass: ['kg', 'hg', 'dag', 'g'],
  volume: ['L', 'dL', 'cL', 'mL'],
} as const;
type Family = keyof typeof TABLES;

/** A relation known by heart: `1 big = factor small`, the fact `units.relations:<big>-<small>`. */
export interface UnitRelation {
  big: string;
  small: string;
  factor: number;
}

export const UNIT_RELATIONS: readonly UnitRelation[] = [
  { big: 'km', small: 'm', factor: 1000 },
  { big: 'm', small: 'dm', factor: 10 },
  { big: 'm', small: 'cm', factor: 100 },
  { big: 'm', small: 'mm', factor: 1000 },
  { big: 'dm', small: 'cm', factor: 10 },
  { big: 'cm', small: 'mm', factor: 10 },
  { big: 'kg', small: 'g', factor: 1000 },
  { big: 'L', small: 'dL', factor: 10 },
  { big: 'L', small: 'cL', factor: 100 },
  { big: 'dL', small: 'cL', factor: 10 },
  { big: '€', small: 'c', factor: 100 },
];

/** « 5 000 mm »: digits grouped as at school. */
const quantity = (n: number, unit: string) => `${formatNumber(n)}${SPACE}${unit}`;

/**
 * Levels: 0. the relation, `1 m = ? cm`; 1. taken back, `100 cm = ? m`.
 */
export const RELATIONS_LEVELS = 2;

export interface RelationExercise extends Exercise {
  relation: UnitRelation;
  back: boolean;
}

export function unitRelation(
  relation: UnitRelation,
  back: boolean,
  level: number,
): RelationExercise {
  const { big, small, factor } = relation;
  return {
    skill: RELATIONS_SKILL,
    level,
    instruction: 'Trouve le nombre qui manque.',
    statement: back
      ? `${quantity(factor, small)} = ?${SPACE}${big}`
      : `${quantity(1, big)} = ?${SPACE}${small}`,
    input: { kind: 'keypad', maxDigits: 4, inline: true },
    answer: String(back ? 1 : factor),
    relation,
    back,
  };
}

export function generateRelation(rng: Rng, level: number): RelationExercise {
  if (level !== 0 && level !== 1) throw new RangeError(`niveau ${level}`);
  return unitRelation(rng.pick(UNIT_RELATIONS), level === 1, level);
}

/**
 * Levels of converting, the table beside the statement except at level 4:
 * 0. one unit into a smaller one, `4 m = ? cm`;
 * 1. two units of length into the smaller one, `3 m 25 cm = ? cm`;
 * 2. the same with masses and volumes, `2 kg 300 g = ? g`;
 * 3. into the larger unit and what is left, `325 cm = 3 m ? cm`;
 * 4. any of them, without the table;
 * 5. into the larger unit, exact (#161): `5 000 mm = ? m`, `230 cm = ? dm`;
 * 6. the pairs m–mm, dm–mm, dm–cm into the smaller unit: `2 m 400 mm = ? mm`, `20 dm = ? mm`;
 * 7. the same pairs into two units, the larger or the smaller one asked: `456 cm = ? dm 6 cm`.
 */
export const CONVERT_LEVELS = 8;

/** Two units of a table and how many of the smaller one make a larger one. */
export interface Pair {
  family: Family;
  big: string;
  small: string;
}

const length = (big: string, small: string): Pair => ({ family: 'length', big, small });

const SINGLE_PAIRS: readonly Pair[] = [
  length('m', 'cm'),
  length('m', 'dm'),
  length('km', 'm'),
  length('cm', 'mm'),
  length('dm', 'cm'),
];
const LENGTH_PAIRS: readonly Pair[] = [length('m', 'cm'), length('km', 'm'), length('cm', 'mm')];
const OTHER_PAIRS: readonly Pair[] = [
  { family: 'mass', big: 'kg', small: 'g' },
  { family: 'volume', big: 'L', small: 'cL' },
  { family: 'volume', big: 'L', small: 'dL' },
];
/** Every pair of the class table m | dm | cm | mm. */
const CLASS_PAIRS: readonly Pair[] = [
  length('m', 'dm'),
  length('m', 'cm'),
  length('m', 'mm'),
  length('dm', 'cm'),
  length('dm', 'mm'),
  length('cm', 'mm'),
];
/** The pairs seen in class beyond m–cm and cm–mm. */
const NEW_PAIRS: readonly Pair[] = [length('m', 'mm'), length('dm', 'mm'), length('dm', 'cm')];

/** The table of the class, without km, hm nor dam (#161). */
export const CLASS_LENGTHS = ['m', 'dm', 'cm', 'mm'] as const;

/** The columns of the table for a pair: the class one when the km is not involved. */
export function columnsOf({ family, big }: Pair): readonly string[] {
  return family === 'length' && big !== 'km' ? CLASS_LENGTHS : TABLES[family];
}

export function factorOf(pair: Pair): number {
  const units = columnsOf(pair);
  return 10 ** (units.indexOf(pair.small) - units.indexOf(pair.big));
}

/** What the child finds: everything in the smaller unit, the larger part, or what is left. */
export type Asked = 'total' | 'big' | 'small';

export interface ConvertExercise extends Exercise {
  pair: Pair;
  /** How many of the larger unit and of the smaller one. */
  big: number;
  small: number;
  asked: Asked;
}

/** The table with the digits of `total` (in the `end` unit) ending in its column. */
function table(pair: Pair, total: number, end: string, marks: readonly string[]): Figure {
  const units = columnsOf(pair);
  const last = units.indexOf(end);
  const digits: (number | null)[] = units.map(() => null);
  [...String(total)].reverse().forEach((digit, i) => {
    if (last - i >= 0) digits[last - i] = Number(digit);
  });
  return { kind: 'conversion', units, digits, marks: marks.map((unit) => units.indexOf(unit)) };
}

/** Some of the smaller unit, fewer than one of the larger: 25 cm, 350 g, 4 mm. */
function drawSmall(rng: Rng, factor: number, step = factor >= 1000 ? 50 : factor / 20): number {
  const by = Math.max(1, step);
  return by * rng.int(1, factor / by - 1);
}

/** How many of the larger unit: a few, or up to 60 when a larger one is 10 smaller ones. */
function drawBig(rng: Rng, pair: Pair): number {
  const factor = factorOf(pair);
  if (factor !== 10) return rng.int(1, 9);
  // The total stays in the table: 9 m = 90 dm at most.
  const room = 10 ** (columnsOf(pair).indexOf(pair.small) + 1) - 1;
  return rng.int(2, Math.min(60, Math.floor(room / factor)));
}

function convertStatement({ pair, big, small, asked }: ConvertExercise): string {
  const { big: b, small: s } = pair;
  const total = quantity(big * factorOf(pair) + small, s);
  if (asked === 'small') return `${total} = ${quantity(big, b)} ?${SPACE}${s}`;
  if (asked === 'big')
    return small === 0
      ? `${total} = ?${SPACE}${b}`
      : `${total} = ?${SPACE}${b} ${quantity(small, s)}`;
  return small === 0
    ? `${quantity(big, b)} = ?${SPACE}${s}`
    : `${quantity(big, b)} ${quantity(small, s)} = ?${SPACE}${s}`;
}

/** The pair, the quantities and what is asked at a level (level 4: one of the first four). */
function draw(rng: Rng, level: number): [Pair, number, number, Asked] {
  switch (level) {
    case 0: {
      const pair = rng.pick(SINGLE_PAIRS);
      return [pair, rng.int(1, 9), 0, 'total'];
    }
    case 1:
    case 2: {
      const pair = rng.pick(level === 1 ? LENGTH_PAIRS : OTHER_PAIRS);
      return [pair, rng.int(1, 4), drawSmall(rng, factorOf(pair)), 'total'];
    }
    case 3: {
      const pair = rng.pick(LENGTH_PAIRS);
      return [pair, rng.int(1, 4), drawSmall(rng, factorOf(pair)), 'small'];
    }
    case 4:
      return draw(rng, rng.int(0, 3));
    case 5: {
      const pair = rng.pick(CLASS_PAIRS);
      return [pair, drawBig(rng, pair), 0, 'big'];
    }
    case 6: {
      const pair = rng.pick(NEW_PAIRS);
      if (rng.chance(0.5)) return [pair, rng.int(1, 9), 0, 'total'];
      return [pair, rng.int(1, 4), drawSmall(rng, factorOf(pair)), 'total'];
    }
    case 7: {
      const pair = rng.pick(NEW_PAIRS);
      const factor = factorOf(pair);
      const asked = rng.pick(['big', 'small'] as const);
      return [pair, drawBig(rng, pair), drawSmall(rng, factor, 1), asked];
    }
    default:
      throw new RangeError(`niveau ${level}`);
  }
}

export function generateConvert(rng: Rng, level: number): ConvertExercise {
  if (!Number.isInteger(level)) throw new RangeError(`niveau ${level}`);
  const [pair, big, small, asked] = draw(rng, level);
  return convertExercise(pair, big, small, asked, level);
}

/** `big` and `small` of a pair, `asked` at a level (an astuce builds its own). */
export function convertExercise(
  pair: Pair,
  big: number,
  small: number,
  asked: Asked,
  level: number,
): ConvertExercise {
  const total = big * factorOf(pair) + small;
  // The table holds what is given: the larger unit alone, or every digit down to the smaller.
  let shown = table(
    pair,
    total,
    pair.small,
    asked === 'small' ? [pair.big, pair.small] : [pair.small],
  );
  if (asked === 'big') shown = table(pair, total, pair.small, [pair.big]);
  if (asked === 'total' && small === 0) shown = table(pair, big, pair.big, [pair.small]);
  const exercise: ConvertExercise = {
    skill: CONVERT,
    level,
    instruction: level === 4 ? 'Convertis.' : 'Convertis avec le tableau.',
    statement: '',
    ...(level === 4 ? {} : { figure: shown }),
    input: { kind: 'keypad', maxDigits: 4, inline: true },
    answer: String({ total, big, small }[asked]),
    pair,
    big,
    small,
    asked,
  };
  return { ...exercise, statement: convertStatement(exercise) };
}

/**
 * 100 instead of 1 000, the two numbers put side by side without the zeros, the zeros not taken
 * away, one column too far.
 */
export function convertLures({ pair, big, small, asked }: ConvertExercise): number[] {
  const factor = factorOf(pair);
  const total = big * factor + small;
  if (asked === 'small') return [total - big, small * 10, small + factor];
  if (asked === 'big') return [Math.floor(total / (factor * 10)), total, Math.floor(total / 10)];
  return [big * (factor / 10) + small, Number(`${big}${small}`), big * factor * 10 + small];
}
