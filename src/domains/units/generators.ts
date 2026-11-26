import type { Rng } from '../../core/rng';
import type { Exercise, Figure } from '../../core/types';

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

const quantity = (n: number, unit: string) => `${n}${SPACE}${unit}`;

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
 * Levels of converting, the table beside the statement until the last one:
 * 0. one unit into a smaller one, `4 m = ? cm`;
 * 1. two units of length into the smaller one, `3 m 25 cm = ? cm`;
 * 2. the same with masses and volumes, `2 kg 300 g = ? g`;
 * 3. into the larger unit and what is left, `325 cm = 3 m ? cm`;
 * 4. any of them, without the table.
 */
export const CONVERT_LEVELS = 5;

/** Two units of a table and how many of the smaller one make a larger one. */
interface Pair {
  family: Family;
  big: string;
  small: string;
}

const SINGLE_PAIRS: readonly Pair[] = [
  { family: 'length', big: 'm', small: 'cm' },
  { family: 'length', big: 'm', small: 'dm' },
  { family: 'length', big: 'km', small: 'm' },
  { family: 'length', big: 'cm', small: 'mm' },
  { family: 'length', big: 'dm', small: 'cm' },
];
const LENGTH_PAIRS: readonly Pair[] = [
  { family: 'length', big: 'm', small: 'cm' },
  { family: 'length', big: 'km', small: 'm' },
  { family: 'length', big: 'cm', small: 'mm' },
];
const OTHER_PAIRS: readonly Pair[] = [
  { family: 'mass', big: 'kg', small: 'g' },
  { family: 'volume', big: 'L', small: 'cL' },
  { family: 'volume', big: 'L', small: 'dL' },
];

function factorOf({ family, big, small }: Pair): number {
  const units: readonly string[] = TABLES[family];
  return 10 ** (units.indexOf(small) - units.indexOf(big));
}

export interface ConvertExercise extends Exercise {
  pair: Pair;
  /** How many of the larger unit and of the smaller one. */
  big: number;
  small: number;
  /** Level 3: the smaller units given, what is left asked. */
  back: boolean;
}

/** The table with the digits of `total` (in the smaller unit) ending in its column. */
function table(pair: Pair, total: number, marks: readonly string[]): Figure {
  const units: readonly string[] = TABLES[pair.family];
  const end = units.indexOf(pair.small);
  const digits: (number | null)[] = units.map(() => null);
  [...String(total)].reverse().forEach((digit, i) => {
    if (end - i >= 0) digits[end - i] = Number(digit);
  });
  return { kind: 'conversion', units, digits, marks: marks.map((unit) => units.indexOf(unit)) };
}

/** The pairs of each form of question. */
const PAIRS_OF_FORM = [SINGLE_PAIRS, LENGTH_PAIRS, OTHER_PAIRS, LENGTH_PAIRS];

/** Some of the smaller unit, fewer than one of the larger: 25 cm, 350 g, 4 mm. */
function drawSmall(rng: Rng, factor: number): number {
  let step = 1;
  if (factor >= 1000) step = 50;
  else if (factor === 100) step = 5;
  return step * rng.int(1, factor / step - 1);
}

function convertStatement(form: number, pair: Pair, big: number, small: number): string {
  const { big: b, small: s } = pair;
  if (form === 0) return `${quantity(big, b)} = ?${SPACE}${s}`;
  if (form === 3)
    return `${quantity(big * factorOf(pair) + small, s)} = ${quantity(big, b)} ?${SPACE}${s}`;
  return `${quantity(big, b)} ${quantity(small, s)} = ?${SPACE}${s}`;
}

export function generateConvert(rng: Rng, level: number): ConvertExercise {
  if (!Number.isInteger(level) || level < 0 || level >= CONVERT_LEVELS) {
    throw new RangeError(`niveau ${level}`);
  }
  const form = level === 4 ? rng.int(0, 3) : level;
  const pair = rng.pick(PAIRS_OF_FORM[form]);
  const factor = factorOf(pair);
  const big = rng.int(1, form === 0 ? 9 : 4);
  const small = form === 0 ? 0 : drawSmall(rng, factor);
  const total = big * factor + small;
  const back = form === 3;
  // The table holds what is given: the larger unit alone, or every digit down to the smaller.
  let shown = table(pair, total, back ? [pair.big, pair.small] : [pair.small]);
  if (form === 0) shown = table({ ...pair, small: pair.big }, big, [pair.small]);
  return {
    skill: CONVERT,
    level,
    instruction: level === 4 ? 'Convertis.' : 'Convertis avec le tableau.',
    statement: convertStatement(form, pair, big, small),
    ...(level === 4 ? {} : { figure: shown }),
    input: { kind: 'keypad', maxDigits: 4, inline: true },
    answer: String(back ? small : total),
    pair,
    big,
    small,
    back,
  };
}

/** 100 instead of 1 000, or the two numbers put side by side without the zeros. */
export function convertLures({ pair, big, small, back }: ConvertExercise): number[] {
  const factor = factorOf(pair);
  if (back) return [big * factor + small - big, small * 10, small + factor];
  return [big * (factor / 10) + small, Number(`${big}${small}`), big * factor * 10 + small];
}
