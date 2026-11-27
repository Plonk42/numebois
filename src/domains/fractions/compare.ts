import type { Rng } from '../../core/rng';
import type { Exercise, Tried } from '../../core/types';
import { signOf } from '../numbers/generators';
import { fractionText } from './generators';
import { MAX_DENOMINATOR, partsName } from './words';

export const COMPARE = 'fractions.compare';

/** The same denominator, the same numerator, or one denominator a multiple of the other. */
export type CompareKind = 'denominator' | 'numerator' | 'multiple';

/**
 * Levels (#62), fractions under 1, denominators up to 12, two strips drawn one under the other
 * on the first three:
 * 0. the same denominator: 5/12 and 7/12;
 * 1. the same numerator: 5/12 and 5/8, 1/6 and 1/3;
 * 2. a denominator a multiple of the other: 7/12 and 5/6, sometimes equal;
 * 3. any of the three, without the strips.
 */
export const COMPARE_LEVELS = 4;

const KINDS: readonly CompareKind[] = ['denominator', 'numerator', 'multiple'];

export interface CompareFractionsExercise extends Exercise {
  kind: CompareKind;
  left: readonly [number, number];
  right: readonly [number, number];
}

/** Two different numbers from `min` to `max`. */
function two(rng: Rng, min: number, max: number): [number, number] {
  const a = rng.int(min, max);
  let b = rng.int(min, max - 1);
  if (b >= a) b++;
  return [a, b];
}

function drawPair(rng: Rng, kind: CompareKind): [[number, number], [number, number]] {
  if (kind === 'denominator') {
    const d = rng.int(3, MAX_DENOMINATOR);
    const [a, b] = two(rng, 1, d - 1);
    return [
      [a, d],
      [b, d],
    ];
  }
  if (kind === 'numerator') {
    const n = rng.int(1, 5);
    const [c, d] = two(rng, n + 1, MAX_DENOMINATOR);
    return [
      [n, c],
      [n, d],
    ];
  }
  const small = rng.int(2, 6);
  const k = rng.int(2, Math.floor(MAX_DENOMINATOR / small));
  const a = rng.int(1, small - 1);
  // Now and then equal: 2/4 and 1/2.
  const b = rng.chance(1 / 5) ? a * k : rng.int(1, small * k - 1);
  return [
    [a, small],
    [b, small * k],
  ];
}

export function generateCompareFractions(rng: Rng, level: number): CompareFractionsExercise {
  if (level < 0 || level >= COMPARE_LEVELS) throw new RangeError(`niveau ${level}`);
  const kind = level < 3 ? KINDS[level] : rng.pick(KINDS);
  const [a, b] = drawPair(rng, kind);
  const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
  const [l, r] = [fractionText(...left), fractionText(...right)];
  return {
    skill: COMPARE,
    level,
    kind,
    left,
    right,
    instruction: 'Choisis le bon signe.',
    statement: `${l}\u00a0?\u00a0${r}`,
    ...(level < 3 && {
      figure: {
        kind: 'fraction',
        wholes: [left, right].map(([n, d]) => ({ shape: 'strip', parts: d, coloured: n })),
      },
    }),
    input: { kind: 'compare', left: l, right: r },
    answer: signOf(left[0] * right[1], right[0] * left[1]),
  };
}

/** The fraction written in the parts of the other one: 5/6 in twelfths. */
function inLargerDenominator({ left, right }: CompareFractionsExercise) {
  const [small, big] = left[1] < right[1] ? [left, right] : [right, left];
  const k = big[1] / small[1];
  return { small, big, k, scaled: [small[0] * k, big[1]] as const };
}

/** The denominators compared as numbers, the numerators compared alone, the sign reversed (#168). */
function compareSlip(exercise: CompareFractionsExercise, tried: string): string | null {
  const { kind, left, right, answer } = exercise;
  if (tried === answer || !['<', '>'].includes(tried)) return null;
  if (kind === 'numerator') {
    const [big, small] = left[1] > right[1] ? [left[1], right[1]] : [right[1], left[1]];
    return `${big} est plus grand que ${small},\nmais les ${partsName(big)} sont plus petits.`;
  }
  if (kind === 'multiple' && tried === signOf(left[0], right[0]) && left[0] !== right[0]) {
    const { small, big } = inLargerDenominator(exercise);
    return `Les parts n’ont pas la même taille.\nÉcris d’abord ${fractionText(...small)} en ${partsName(big[1])}.`;
  }
  if (answer === '=') return null;
  return 'Le signe est à l’envers.\nLa pointe montre la plus petite fraction.';
}

/** 1: the mistake when recognised, else how to compare; 2: the comparison worked out. */
export function compareFractionsHint(
  exercise: CompareFractionsExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { kind, left, right, answer } = exercise;
  const slip = attempt === 1 && tried && compareSlip(exercise, tried.answer);
  if (slip) return slip;
  const done = `${fractionText(...left)} ${answer} ${fractionText(...right)}.`;
  if (kind === 'denominator') {
    if (attempt === 1) return 'Les parts ont la même taille.\nPlus il y en a, plus c’est grand.';
    return `${left[0]} parts contre ${right[0]} :\n${done}`;
  }
  if (kind === 'numerator') {
    if (attempt === 1) {
      return 'Autant de parts de chaque côté.\nPlus il y a de parts en tout, plus elles sont petites.';
    }
    const [large, small] = left[1] < right[1] ? [left[1], right[1]] : [right[1], left[1]];
    return `Un ${partsName(large, true)} est plus grand qu’un ${partsName(small, true)}.\nDonc ${done}`;
  }
  const { small, big, scaled } = inLargerDenominator(exercise);
  if (attempt === 1) {
    return `Écris ${fractionText(...small)} en ${partsName(big[1])}.\nPuis compare les nombres du haut.`;
  }
  return `${fractionText(...small)} = ${fractionText(...scaled)}.\nDonc ${done}`;
}
