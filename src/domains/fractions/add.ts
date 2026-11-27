import type { Rng } from '../../core/rng';
import type { Exercise, Tried, Whole } from '../../core/types';
import { triedFraction } from '../../core/validate';
import { fractionText, shapeFor } from './generators';
import { MAX_DENOMINATOR, fractionWords, partsName } from './words';

export const ADD = 'fractions.add';

/** Two fractions with the same denominator added or taken away, the whole completed, or a denominator a multiple of the other. */
export type AddKind = 'add' | 'subtract' | 'complete' | 'multiple';

/**
 * Levels (#170), results up to 1, denominators up to 12:
 * 0. the same denominator added, the parts drawn in two colours: 2/5 + 1/5;
 * 1. the same denominator taken away, 4/5 − 1/5, or the whole completed, 3/10 + ? = 10/10;
 * 2. a denominator a multiple of the other, the parts drawn: 1/2 + 1/4, 5/6 − 1/3;
 * 3. any of them, without the parts drawn.
 */
export const ADD_LEVELS = 4;

type Pair = readonly [number, number];

export interface AddFractionsExercise extends Exercise {
  kind: AddKind;
  operator: '+' | '−';
  first: Pair;
  second: Pair;
  result: Pair;
}

const KINDS_BY_LEVEL: readonly (readonly AddKind[])[] = [
  ['add'],
  ['subtract', 'complete'],
  ['multiple'],
  ['add', 'subtract', 'complete', 'multiple'],
];

interface Draft {
  kind: AddKind;
  operator: '+' | '−';
  first: Pair;
  second: Pair;
  result: Pair;
}

function sameDenominator(rng: Rng, kind: AddKind): Draft {
  const d = rng.int(3, MAX_DENOMINATOR);
  if (kind === 'add') {
    const a = rng.int(1, d - 1);
    const b = rng.int(1, d - a);
    return { kind, operator: '+', first: [a, d], second: [b, d], result: [a + b, d] };
  }
  if (kind === 'subtract') {
    const a = rng.int(2, d);
    const b = rng.int(1, a - 1);
    return { kind, operator: '−', first: [a, d], second: [b, d], result: [a - b, d] };
  }
  const a = rng.int(1, d - 1);
  return { kind, operator: '+', first: [a, d], second: [d - a, d], result: [d, d] };
}

/** 1/2 + 1/4, 5/6 − 1/3: the result in the smaller parts. */
function multiple(rng: Rng): Draft {
  const s = rng.int(2, 6);
  const k = rng.int(2, Math.floor(MAX_DENOMINATOR / s));
  const big = s * k;
  const a = rng.int(1, s - 1);
  const small: Pair = [a, s];
  if (rng.chance(0.5) && a * k < big) {
    const b = rng.int(1, big - a * k);
    const [first, second]: Pair[] = rng.chance(0.5) ? [small, [b, big]] : [[b, big], small];
    return { kind: 'multiple', operator: '+', first, second, result: [a * k + b, big] };
  }
  if (rng.chance(0.5) && a * k > 1) {
    const b = rng.int(1, a * k - 1);
    return {
      kind: 'multiple',
      operator: '−',
      first: small,
      second: [b, big],
      result: [a * k - b, big],
    };
  }
  const c = rng.int(a * k + 1, big);
  return {
    kind: 'multiple',
    operator: '−',
    first: [c, big],
    second: small,
    result: [c - a * k, big],
  };
}

/** The whole drawn: the first fraction coloured, the second in another colour (an addition). */
function figureOf(rng: Rng, { kind, first, second, result }: Draft): Whole {
  const parts = result[1];
  const shape = shapeFor(rng, parts);
  if (kind === 'complete') return { shape, parts, coloured: first[0] };
  const inParts = ([n, d]: Pair) => (n * parts) / d;
  return { shape, parts, coloured: inParts(first), added: inParts(second) };
}

export function generateAddFractions(rng: Rng, level: number): AddFractionsExercise {
  if (level < 0 || level >= ADD_LEVELS) throw new RangeError(`niveau ${level}`);
  const kind = rng.pick(KINDS_BY_LEVEL[level]);
  const draft = kind === 'multiple' ? multiple(rng) : sameDenominator(rng, kind);
  const { operator, first, second, result } = draft;
  const drawn = level < 3 && (kind === 'add' || kind === 'complete' || operator === '+');
  const statement =
    kind === 'complete'
      ? `${fractionText(...first)} + ? = ${fractionText(...result)}`
      : `${fractionText(...first)} ${operator} ${fractionText(...second)} = ?`;
  return {
    skill: ADD,
    level,
    ...draft,
    instruction: kind === 'complete' ? 'Complète jusqu’au tout.' : 'Calcule.',
    statement,
    ...(drawn && { figure: { kind: 'fraction', wholes: [figureOf(rng, draft)] } }),
    input: { kind: 'fraction' },
    answer: fractionText(...(kind === 'complete' ? second : result)),
  };
}

/** The smaller fraction written in the parts of the other one: 1/2 in quarters. */
function scaled({ first, second }: AddFractionsExercise) {
  const [small, big] = first[1] < second[1] ? [first, second] : [second, first];
  const k = big[1] / small[1];
  return { small, inBig: [small[0] * k, big[1]] as const, big };
}

/** The denominators added too, the numerators added before the parts are alike (#168). */
function addSlip(exercise: AddFractionsExercise, tried: Tried): string | null {
  const fraction = triedFraction(tried);
  if (!fraction) return null;
  const { kind, operator, first, second } = exercise;
  const [n, d] = fraction;
  const top = operator === '+' ? first[0] + second[0] : first[0] - second[0];
  if (operator === '+' && d === first[1] + second[1] && n === top) {
    return 'Le nombre du bas ne change pas :\nles parts gardent leur taille.';
  }
  if (kind === 'multiple' && n === top && (d === first[1] || d === second[1])) {
    const { small, big } = scaled(exercise);
    return `Les parts n’ont pas la même taille.\nÉcris d’abord ${fractionText(...small)} en ${partsName(big[1])}.`;
  }
  if (kind === 'complete' && n === first[0] && d === first[1]) {
    return 'Ça, c’est la partie donnée.\nCompte les parts qui manquent jusqu’au tout.';
  }
  if (kind === 'subtract' && n === first[0] + second[0] && d === first[1]) {
    return 'Ça, c’est l’addition.\nIci, on enlève des parts.';
  }
  return null;
}

/** 1: the mistake when recognised, else the method; 2: the calculation said in words. */
export function addFractionsHint(
  exercise: AddFractionsExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const slip = attempt === 1 && tried && addSlip(exercise, tried);
  if (slip) return slip;
  const { kind, operator, first, second, result } = exercise;
  if (kind === 'complete') {
    const [a, d] = first;
    if (attempt === 1) return `Le tout, c’est ${d}/${d}.\nCompte les parts qui manquent.`;
    return `${d} − ${a} = ${d - a} : il manque ${fractionText(d - a, d)}.`;
  }
  if (kind === 'multiple') {
    const { small, inBig } = scaled(exercise);
    const verb = operator === '+' ? 'ajoute' : 'enlève';
    if (attempt === 1) {
      return `Écris ${fractionText(...small)} en ${partsName(inBig[1])}.\nPuis ${verb} les nombres du haut.`;
    }
    return `${fractionText(...small)} = ${fractionText(...inBig)}.\nDonc ${exercise.statement.replace('?', fractionText(...result))}.`;
  }
  if (attempt === 1) {
    const verb = operator === '+' ? 'Ajoute' : 'Enlève';
    return `Les parts ont la même taille.\n${verb} les nombres du haut, celui du bas ne change pas.`;
  }
  const word = operator === '+' ? 'plus' : 'moins';
  const said = `${fractionWords(...first)} ${word} ${fractionWords(...second)}`;
  return `${said[0].toUpperCase()}${said.slice(1)},\ncela fait ${fractionWords(...result)}.`;
}
