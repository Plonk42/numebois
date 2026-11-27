import type { Rng } from '../../core/rng';
import type { Exercise, Tried, Whole } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { fractionText, shuffle } from './generators';
import { MAX_DENOMINATOR, numberWord } from './words';

export const EQUAL = 'fractions.equal';

/**
 * Levels (#169), denominators up to 12:
 * 0. parts twice as small or twice as large, two strips drawn: 6/8 = ?/4, 1/2 = ?/4;
 * 1. two, three or four times: 1/3 = ?/12, 8/12 = ?/3, the strips drawn;
 * 2. the same without the strips;
 * 3. the fraction equal to 1/2 among 4.
 */
export const EQUAL_LEVELS = 4;

export interface EqualExercise extends Exercise {
  /** A numerator to find, or the equal fraction to choose. */
  form: 'missing' | 'choose';
  /** The fraction given, and the denominator of the one asked (`missing`). */
  given: readonly [number, number];
  asked: readonly [number, number];
  /** How many times smaller (or larger) the parts are. */
  factor: number;
}

/** A small fraction a/b and a factor that keeps b × factor up to 12. */
function drawPair(rng: Rng, level: number): { a: number; b: number; k: number } {
  const b = rng.int(2, 6);
  const a = rng.int(1, b - 1);
  const k = level === 0 ? 2 : rng.int(2, Math.floor(MAX_DENOMINATOR / b));
  return { a, b, k };
}

const strip = (parts: number, coloured: number): Whole => ({ shape: 'strip', parts, coloured });

/** Fractions near a/b that are not equal to it: the same number added on top and below… */
function equalLures(rng: Rng, a: number, b: number, k: number): string[] {
  const candidates: [number, number][] = [
    [a + k, b + k],
    [a + 1, b + 1],
    [a * k + 1, b * k],
    [a * k - 1, b * k],
    [a * k, b * k + 1],
    [a, b * k],
    [a * k, b],
  ];
  const lures: string[] = [];
  for (const [n, d] of shuffle(rng, candidates)) {
    const text = fractionText(n, d);
    const fits = n >= 1 && n < d && d <= MAX_DENOMINATOR && n * b !== a * d;
    if (fits && !lures.includes(text) && lures.length < 3) lures.push(text);
  }
  return lures;
}

export function generateEqual(rng: Rng, level: number): EqualExercise {
  if (level < 0 || level >= EQUAL_LEVELS) throw new RangeError(`niveau ${level}`);
  for (;;) {
    const { a, b, k } = drawPair(rng, level);
    if (level === 3) {
      const lures = equalLures(rng, a, b, k);
      if (lures.length < 3) continue;
      const right = fractionText(a * k, b * k);
      return {
        skill: EQUAL,
        level,
        form: 'choose',
        instruction: 'Trouve la fraction égale.',
        statement: `Quelle fraction est égale à ${fractionText(a, b)} ?`,
        input: { kind: 'choice', options: shuffle(rng, [right, ...lures]) },
        answer: right,
        given: [a, b],
        asked: [a * k, b * k],
        factor: k,
      };
    }
    const up = rng.chance(0.5);
    const given: [number, number] = up ? [a, b] : [a * k, b * k];
    const asked: [number, number] = up ? [a * k, b * k] : [a, b];
    return {
      skill: EQUAL,
      level,
      form: 'missing',
      instruction: 'Complète l’égalité.',
      statement: `${fractionText(...given)} = ?/${asked[1]}`,
      ...(level < 2 && {
        figure: { kind: 'fraction', wholes: [strip(given[1], given[0]), strip(asked[1], 0)] },
      }),
      input: { kind: 'keypad', maxDigits: 2, inline: true },
      answer: String(asked[0]),
      given,
      asked,
      factor: k,
    };
  }
}

/** The same number added or taken on top and below, the numerator kept, a part off. */
export function equalLuresOf({ form, given, asked }: EqualExercise): number[] {
  if (form === 'choose') return [];
  const [n] = given;
  const gap = asked[1] - given[1];
  return [n + gap, n, asked[0] + 1, asked[0] - 1].filter((x) => x >= 0 && x !== asked[0]);
}

function equalSlip({ form, given, asked }: EqualExercise, tried: Tried): string | null {
  if (form === 'choose') {
    const [n, d] = tried.answer.split('/').map(Number);
    const [a, b] = given;
    if (n - a === d - b && n !== a) {
      return `Ajouter ${n - a} en haut et en bas change la fraction.`;
    }
    return null;
  }
  const value = triedNumber(tried);
  if (value === null || value === asked[0]) return null;
  const gap = asked[1] - given[1];
  if (value === given[0] + gap && gap !== 0) {
    const verb = gap > 0 ? 'Ajouter' : 'Enlever';
    return `${verb} ${Math.abs(gap)} en haut et en bas change la fraction.`;
  }
  if (value === given[0]) {
    return 'Les parts changent de taille : le haut change aussi.';
  }
  return null;
}

/** 1: the mistake when recognised, then parts k times smaller, k times more; 2: the products. */
export function equalHint(exercise: EqualExercise, attempt: 1 | 2, tried?: Tried): string {
  const { form, given, asked, factor: k } = exercise;
  const times = numberWord(k);
  const up = asked[1] > given[1];
  let method = up
    ? `Des parts ${times} fois plus petites : ${times} fois plus de parts.`
    : `Des parts ${times} fois plus grandes : ${times} fois moins de parts.`;
  if (form === 'choose') method = 'Multiplie le haut et le bas par le même nombre.';
  if (attempt === 1) {
    const slip = tried && equalSlip(exercise, tried);
    return slip ? `${slip}\n${method}` : method;
  }
  const [small, big] = up ? [given, asked] : [asked, given];
  return `${small[0]} × ${k} = ${big[0]} et ${small[1]} × ${k} = ${big[1]}.\nDonc ${fractionText(...given)} = ${fractionText(...asked)}.`;
}
