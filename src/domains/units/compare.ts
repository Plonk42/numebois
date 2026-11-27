import type { Rng } from '../../core/rng';
import type { Exercise, Tried } from '../../core/types';
import { formatNumber } from '../numbers/words';
import { signOf } from '../numbers/generators';

export const COMPARE_LENGTHS = 'units.compare-lengths';

/** Millimetres in each unit of the class table. */
const MM: Record<string, number> = { m: 1000, dm: 100, cm: 10, mm: 1 };
const UNITS = ['m', 'dm', 'cm', 'mm'];

/** A length as written: « 4 m 876 mm » is [[4, 'm'], [876, 'mm']]. */
export type Written = readonly (readonly [number, string])[];

export const lengthText = (written: Written) =>
  written.map(([n, unit]) => `${formatNumber(n)}\u00a0${unit}`).join(' ');

export const millimetres = (written: Written) =>
  written.reduce((sum, [n, unit]) => sum + n * MM[unit], 0);

/**
 * Levels (#162), lengths written in different units:
 * 0. one unit on each side, far apart, the larger number often the shorter: 56 m and 60 cm;
 * 1. one unit on each side, close or equal: 800 cm and 79 dm, 3 m and 300 cm;
 * 2. the length equal to 34 cm among 4: 3 dm 4 cm, 340 mm…;
 * 3. two units on one side, close or equal: 4 m 876 mm and 5 m, 6 m 67 cm and 700 cm.
 */
export const COMPARE_LENGTHS_LEVELS = 4;

export interface CompareLengthsExercise extends Exercise {
  /** Compared, or the length given and the right one among the choices (level 2). */
  sides: readonly [Written, Written];
}

/** A larger unit and a smaller one of the class table. */
function drawPair(rng: Rng): [string, string] {
  const big = rng.int(0, 2);
  return [UNITS[big], UNITS[rng.int(big + 1, 3)]];
}

const ratio = (big: string, small: string) => MM[big] / MM[small];

/** How many of the larger unit: a few, or up to 60 when one is 10 of the smaller. */
const drawCount = (rng: Rng, factor: number) => (factor === 10 ? rng.int(2, 60) : rng.int(1, 9));

/** Close to `around` smaller units, a little more or less: never 0, never equal. */
function near(rng: Rng, around: number, factor: number): number {
  const step = factor === 10 ? 1 : factor / 20;
  const gap = step * rng.int(1, 3) * (rng.chance(0.5) ? 1 : -1);
  return around + gap > 0 ? around + gap : around - gap;
}

function comparison(rng: Rng, level: number): [Written, Written] {
  const [big, small] = drawPair(rng);
  const factor = ratio(big, small);
  if (level === 0) {
    const k = drawCount(rng, factor);
    // Often the larger number on the shorter side (56 m and 60 cm), sometimes far longer.
    const far = 3 * k * factor <= 9999 && rng.chance(0.4);
    const m = far
      ? rng.int(2 * k * factor, 3 * k * factor)
      : rng.int(k + 1, Math.max(k + 1, Math.floor((k * factor) / 2)));
    return [[[k, big]], [[m, small]]];
  }
  if (level === 1) {
    const k = drawCount(rng, factor);
    const m = rng.chance(1 / 3) ? k * factor : near(rng, k * factor, factor);
    return [[[k, big]], [[m, small]]];
  }
  const k = drawCount(rng, factor);
  const s = factor === 10 ? rng.int(1, 9) : rng.int(1, factor - 1);
  const total = k * factor + s;
  const roll = rng.int(0, 3);
  let other: Written;
  if (roll === 0) other = [[total, small]];
  else if (roll === 1) other = [[k + 1, big]];
  else if (roll === 2) other = [[k, big]];
  else other = [[near(rng, total, factor), small]];
  return [
    [
      [k, big],
      [s, small],
    ],
    other,
  ];
}

function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The length given in one unit, the right one in other units, and three that are not. */
function equalChoices(rng: Rng): { given: Written; right: Written; lures: Written[] } {
  let [big, small] = drawPair(rng);
  // Not from metres to millimetres: 3 435 mm is far from the lengths seen in class.
  while (ratio(big, small) > 100) [big, small] = drawPair(rng);
  const factor = ratio(big, small);
  const k = rng.int(1, factor === 10 ? 9 : 4);
  const s = factor === 10 ? rng.int(1, 9) : 5 * rng.int(1, factor / 5 - 1);
  const total = k * factor + s;
  const given: Written = [[total, small]];
  const bigger = UNITS[UNITS.indexOf(big) - 1];
  const below = UNITS[UNITS.indexOf(small) + 1];
  const smaller = UNITS.slice(UNITS.indexOf(small) + 1);
  const rights: Written[] = [
    [
      [k, big],
      [s, small],
    ],
    ...smaller.map((u) => [[total * ratio(small, u), u]] as Written),
  ];
  const right = rng.pick(rights);
  // The same digits in another unit: 59 dm, 5 m 9 cm, 5 dm 9 mm for 59 cm.
  const candidates: Written[] = [
    ...UNITS.filter((u) => u !== small).map((u) => [[total, u]] as Written),
    ...(bigger
      ? [
          [
            [k, bigger],
            [s, small],
          ] as Written,
        ]
      : []),
    ...(below
      ? [
          [
            [k, big],
            [s, below],
          ] as Written,
        ]
      : []),
  ];
  const seen = new Set([lengthText(given), lengthText(right)]);
  const lures: Written[] = [];
  for (const lure of shuffle(rng, candidates)) {
    const text = lengthText(lure);
    if (seen.has(text) || millimetres(lure) === total * MM[small] || lures.length === 3) continue;
    seen.add(text);
    lures.push(lure);
  }
  return { given, right, lures };
}

export function generateCompareLengths(rng: Rng, level: number): CompareLengthsExercise {
  if (level === 2) {
    const { given, right, lures } = equalChoices(rng);
    return {
      skill: COMPARE_LENGTHS,
      level,
      instruction: 'Trouve la mesure égale.',
      statement: `Quelle mesure est égale à ${lengthText(given)} ?`,
      input: { kind: 'choice', options: shuffle(rng, [right, ...lures]).map(lengthText) },
      answer: lengthText(right),
      sides: [given, right],
    };
  }
  if (level < 0 || level >= COMPARE_LENGTHS_LEVELS) throw new RangeError(`niveau ${level}`);
  const [a, b] = comparison(rng, level);
  const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
  return {
    skill: COMPARE_LENGTHS,
    level,
    instruction: 'Choisis le bon signe.',
    statement: `${lengthText(left)}\u00a0?\u00a0${lengthText(right)}`,
    input: { kind: 'compare', left: lengthText(left), right: lengthText(right) },
    answer: signOf(millimetres(left), millimetres(right)),
    sides: [left, right],
  };
}

/** The smallest unit written on either side: both lengths are compared in it. */
function commonUnit(sides: readonly Written[]): string {
  return UNITS[Math.max(...sides.flat().map(([, unit]) => UNITS.indexOf(unit)))];
}

/** The numbers compared without their units, the sign the other way round, the same digits (#168). */
function compareSlip(
  { level, sides, answer }: CompareLengthsExercise,
  tried: string,
): string | null {
  if (tried === answer) return null;
  const digits = (text: string) => text.replace(/\D/g, '');
  const [left, right] = sides;
  if (level === 2) {
    if (digits(tried) !== digits(lengthText(left))) return null;
    return `Mêmes chiffres, autre unité : ce n’est pas égal.\nPlace ${lengthText(left)} dans le tableau.`;
  }
  const bare = (side: Written) => (side.length === 1 ? side[0][0] : null);
  const [x, y] = [bare(left), bare(right)];
  if (x !== null && y !== null && tried === signOf(x, y)) {
    return `Tu as comparé les nombres, pas les longueurs.\nÉcris les deux mesures en ${commonUnit(sides)}.`;
  }
  if (answer === '=' || tried === '=') return null;
  return 'Le signe est à l’envers.\nLa pointe montre la plus petite longueur.';
}

/** 1: the mistake when recognised, else both lengths in the same unit; 2: each one converted. */
export function compareLengthsHint(
  exercise: CompareLengthsExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { level, sides, answer } = exercise;
  const slip = attempt === 1 && tried && compareSlip(exercise, tried.answer);
  if (slip) return slip;
  const unit = commonUnit(sides);
  const inUnit = (side: Written) => millimetres(side) / MM[unit];
  if (level === 2) {
    const [given] = sides;
    if (attempt === 1) {
      return `Place ${lengthText(given)} dans le tableau.\nLis-le dans les autres unités.`;
    }
    return `${lengthText(given)} = ${answer}.`;
  }
  if (attempt === 1) return `Écris les deux mesures en ${unit}.\nPuis compare les nombres.`;
  const lines = sides
    .filter((side) => side.length > 1 || side[0][1] !== unit)
    .map((side) => `${lengthText(side)} = ${formatNumber(inUnit(side))}\u00a0${unit}.`);
  return [...lines, `${lengthText(sides[0])} ${answer} ${lengthText(sides[1])}.`].join('\n');
}
