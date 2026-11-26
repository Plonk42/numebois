import type { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';

export const UNITS = 'time.units';

/** Keeps a quantity and its unit on one line. */
const SPACE = '\u00a0';

/**
 * A relation known by heart: `1 big = factor small`. Its key names its fact, `time.units:<key>`.
 */
export interface Relation {
  key: string;
  /** The larger unit, alone (« 1 h ») or in a phrase (« une demi-heure »). */
  one: string;
  big: string;
  small: string;
  factor: number;
}

export const RELATIONS: readonly Relation[] = [
  { key: 'hour-minutes', one: `1${SPACE}h`, big: 'h', small: 'min', factor: 60 },
  { key: 'minute-seconds', one: `1${SPACE}min`, big: 'min', small: 's', factor: 60 },
  { key: 'half-hour', one: 'une demi-heure', big: 'h', small: 'min', factor: 30 },
  { key: 'quarter-hour', one: 'un quart d’heure', big: 'h', small: 'min', factor: 15 },
  { key: 'day-hours', one: `1${SPACE}jour`, big: 'jours', small: 'h', factor: 24 },
  { key: 'week-days', one: `1${SPACE}semaine`, big: 'semaines', small: 'jours', factor: 7 },
  { key: 'year-months', one: `1${SPACE}an`, big: 'ans', small: 'mois', factor: 12 },
];

/** Relations whose multiples are worked out: hours, minutes, days, weeks. */
const MULTIPLES = RELATIONS.filter((r) =>
  ['hour-minutes', 'minute-seconds', 'day-hours', 'week-days'].includes(r.key),
);
/** Relations of the clock, mixed and taken back (1 h 20 min, 80 min). */
const CLOCK = RELATIONS.slice(0, 2);

/**
 * Levels:
 * 0. the relations by heart: 1 h = 60 min, 1 min = 60 s, une demi-heure = 30 min…;
 * 1. a few of the larger unit: 3 h = 180 min, 2 jours = 48 h;
 * 2. both units mixed: 1 h 20 min = 80 min, 2 min 15 s = 135 s;
 * 3. taken back: 80 min = 1 h 20 min, the larger unit given.
 */
export const UNITS_LEVELS = 4;

export interface UnitsExercise extends Exercise {
  relation: Relation;
  /** How many of the larger unit, and of the smaller one. */
  big: number;
  small: number;
  /** Level 3: the smaller units are given, the remainder asked. */
  back: boolean;
}

const quantity = (n: number, unit: string) => `${n}${SPACE}${unit}`;

/** `1 h = ? min`: a relation by heart, its fact. */
export function relation(relation: Relation): UnitsExercise {
  return units(relation, 1, 0, false, 0, `${relation.one} = ?${SPACE}${relation.small}`);
}

function units(
  relation: Relation,
  big: number,
  small: number,
  back: boolean,
  level: number,
  statement: string,
): UnitsExercise {
  const total = big * relation.factor + small;
  return {
    skill: UNITS,
    level,
    instruction: 'Trouve le nombre qui manque.',
    statement,
    input: { kind: 'keypad', maxDigits: 3, inline: true },
    answer: String(back ? small : total),
    relation,
    big,
    small,
    back,
  };
}

/** Counting 100 minutes to the hour, as in tens and hundreds; the units added instead. */
export function unitsLures({ relation: r, big, small, back }: UnitsExercise): number[] {
  const hundred = r.factor === 60 ? 100 : 10;
  if (back) return [big * r.factor + small - hundred * big, small + 10, small + r.factor];
  return [big * hundred + small, big + small, big * r.factor + small + 10];
}

export function generateUnits(rng: Rng, level: number): UnitsExercise {
  if (level === 0) return relation(rng.pick(RELATIONS));
  if (level === 1) {
    const r = rng.pick(MULTIPLES);
    const big = rng.int(2, r.factor === 60 ? 4 : 5);
    return units(r, big, 0, false, level, `${quantity(big, r.big)} = ?${SPACE}${r.small}`);
  }
  if (level !== 2 && level !== 3) throw new RangeError(`niveau ${level}`);
  const r = rng.pick(CLOCK);
  const big = rng.int(1, 2);
  const small = 5 * rng.int(1, 11);
  const mixed = `${quantity(big, r.big)}${SPACE}${quantity(small, r.small)}`;
  if (level === 2) return units(r, big, small, false, level, `${mixed} = ?${SPACE}${r.small}`);
  const total = quantity(big * r.factor + small, r.small);
  return units(
    r,
    big,
    small,
    true,
    level,
    `${total} = ${quantity(big, r.big)}${SPACE}?${SPACE}${r.small}`,
  );
}
