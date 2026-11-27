import type { Rng } from '../../core/rng';
import type { Character, Exercise, ExerciseContext, Tried, Vocabulary } from '../../core/types';
import { triedFraction } from '../../core/validate';

export const FRACTIONS = 'word-problems.fractions';

/** What is shared in equal parts in the statements: all feminine, « de la galette ». */
const WHOLES = ['galette', 'tarte', 'brioche', 'crêpe'];

type Pair = readonly [number, number];

export interface FractionProblemExercise extends Exercise {
  result: Pair;
  /** What is eaten, when the question is what is left: the typical mistake. */
  eaten?: Pair;
  /** Hint 1: how to start. */
  method: string;
  /** Hint 2: the calculation. */
  calc: string;
}

interface Draft {
  statement: string;
  result: Pair;
  eaten?: Pair;
  method: string;
  calc: string;
}

type Template = (rng: Rng, words: Vocabulary) => Draft;

const cap = (text: string) => text[0].toUpperCase() + text.slice(1);
const f = ([n, d]: Pair) => `${n}/${d}`;

function two(rng: Rng, words: Vocabulary): [Character, Character] {
  const who = rng.pick(words.gatherers);
  return [who, rng.pick(words.friends.filter((friend) => friend.name !== who.name))];
}

/** A whole shared, some eaten: what is left. */
const share: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const whole = rng.pick(WHOLES);
  const d = rng.int(3, 12);
  const a = rng.int(1, d - 1);
  return {
    statement:
      `${cap(who.name)} partage une ${whole} en ${d} parts égales. ` +
      `${cap(who.pronoun)} en mange ${a}. Quelle fraction de la ${whole} reste-t-il ?`,
    result: [d - a, d],
    eaten: [a, d],
    method: `La ${whole} entière, c’est ${d}/${d}.\nEnlève ce qui est mangé.`,
    calc: `${d}/${d} − ${a}/${d} = ${d - a}/${d}.`,
  };
};

/** Two friends eat some: how much is eaten. */
const together: Template = (rng, words) => {
  const [who, friend] = two(rng, words);
  const whole = rng.pick(WHOLES);
  const d = rng.int(3, 12);
  const a = rng.int(1, d - 2);
  // Some is left: « mangée » never the whole.
  const b = rng.int(1, d - a - 1);
  return {
    statement:
      `${cap(who.name)} mange ${a}/${d} de la ${whole}. ${cap(friend.name)} en mange ${b}/${d}. ` +
      `Quelle fraction de la ${whole} est mangée ?`,
    result: [a + b, d],
    method: 'On cherche tout ce qui est mangé : tu ajoutes.',
    calc: `${a}/${d} + ${b}/${d} = ${a + b}/${d}.`,
  };
};

/** A part left, some eaten: what is left now. */
const rest: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const whole = rng.pick(WHOLES);
  const d = rng.int(3, 12);
  const a = rng.int(2, d - 1);
  const b = rng.int(1, a - 1);
  return {
    statement:
      `Il reste ${a}/${d} de la ${whole}. ${cap(who.name)} en mange ${b}/${d}. ` +
      'Quelle fraction en reste-t-il maintenant ?',
    result: [a - b, d],
    eaten: [b, d],
    method: 'Il en reste moins qu’avant : tu enlèves.',
    calc: `${a}/${d} − ${b}/${d} = ${a - b}/${d}.`,
  };
};

/** Two friends eat some: what is left of the whole. */
const twoThenRest: Template = (rng, words) => {
  const [who, friend] = two(rng, words);
  const whole = rng.pick(WHOLES);
  const d = rng.int(4, 12);
  const a = rng.int(1, d - 2);
  const b = rng.int(1, d - a - 1);
  return {
    statement:
      `${cap(who.name)} mange ${a}/${d} de la ${whole}, ${friend.name} en mange ${b}/${d}. ` +
      `Quelle fraction de la ${whole} reste-t-il ?`,
    result: [d - a - b, d],
    eaten: [a + b, d],
    method: 'D’abord, ce qui est mangé.\nPuis ce qui reste du tout.',
    calc: `${a}/${d} + ${b}/${d} = ${a + b}/${d},\npuis ${d}/${d} − ${a + b}/${d} = ${d - a - b}/${d}.`,
  };
};

/** Levels: 0. one step, what is left or what is eaten; 1. from a part left, or two steps. */
export const FRACTION_TEMPLATES: readonly (readonly Template[])[] = [
  [share, together],
  [rest, twoThenRest],
];

export function generateFractionProblem(
  rng: Rng,
  level: number,
  { vocabulary }: ExerciseContext,
): FractionProblemExercise {
  if (!FRACTION_TEMPLATES[level]) throw new RangeError(`niveau ${level}`);
  const draft = rng.pick(FRACTION_TEMPLATES[level])(rng, vocabulary);
  return {
    skill: FRACTIONS,
    level,
    instruction: 'Lis bien, puis calcule.',
    input: { kind: 'fraction' },
    answer: f(draft.result),
    ...draft,
  };
}

/** What is eaten for what is left, the denominators added (#168). */
export function fractionProblemHint(
  exercise: FractionProblemExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { method, calc, eaten, result } = exercise;
  if (attempt === 2) return calc;
  const fraction = triedFraction(tried);
  const is = (pair?: Pair) => pair !== undefined && fraction?.join('/') === pair.join('/');
  if (is(eaten)) return 'Ça, c’est ce qui est mangé.\nOn cherche ce qui reste.';
  if (is([result[0], 2 * result[1]])) {
    return 'Le nombre du bas ne change pas :\nles parts gardent leur taille.';
  }
  return method;
}
