import type { Rng } from '../../core/rng';
import type { Character, Exercise, ExerciseContext, Vocabulary } from '../../core/types';

export const ADD_SUBTRACT = 'word-problems.add-subtract';
export const MULTIPLY = 'word-problems.multiply';

export type Operator = '+' | '−' | '×';
/** One step of the calculation; a step after the first starts from the previous result. */
export type Step = readonly [number, Operator, number];

export interface ProblemExercise extends Exercise {
  steps: readonly Step[];
  /** Hint 1: how to start. */
  method: string;
}

export function apply([a, op, b]: Step): number {
  if (op === '+') return a + b;
  return op === '−' ? a - b : a * b;
}

/** A statement and its calculation, before it becomes an exercise. */
interface Draft {
  statement: string;
  steps: Step[];
  method: string;
}

type Template = (rng: Rng, words: Vocabulary) => Draft;

const cap = (text: string) => text[0].toUpperCase() + text.slice(1);
const de = (word: string) => (/^[aeiouyâéèêîôœ]/i.test(word) ? `d’${word}` : `de ${word}`);

/** Someone of the decor other than `not`, to give to or to bring something. */
function friendOf(rng: Rng, words: Vocabulary, not: Character): Character {
  return rng.pick(words.friends.filter((friend) => friend.name !== not.name));
}

/** Two numbers whose sum stays under 100. */
function addends(rng: Rng): [number, number] {
  const a = rng.int(11, 59);
  return [a, rng.int(11, Math.min(39, 99 - a))];
}

/** A number and what is taken from it, leaving at least 10. */
function takeAway(rng: Rng): [number, number] {
  const a = rng.int(30, 99);
  return [a, rng.int(11, a - 10)];
}

const gather: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const item = rng.pick(words.items);
  const [a, b] = addends(rng);
  return {
    statement:
      `${cap(who.name)} ramasse ${a} ${item.many} ${rng.pick(words.places)}. ` +
      `Puis ${who.pronoun} en trouve ${b}. Combien ${de(item.many)} a-t-${who.pronoun} en tout ?`,
    steps: [[a, '+', b]],
    method: `${cap(who.pronoun)} en trouve encore : tu ajoutes.`,
  };
};

const bring: Template = (rng, words) => {
  const item = rng.pick(words.items);
  const [a, b] = addends(rng);
  return {
    statement:
      `Il y a ${a} ${item.many} ${rng.pick(words.places)}. ` +
      `${cap(rng.pick(words.gatherers).name)} en apporte ${b}. ` +
      `Combien ${de(item.many)} y a-t-il maintenant ?`,
    steps: [[a, '+', b]],
    method: 'Il y en a plus qu’avant : tu ajoutes.',
  };
};

const give: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const [a, b] = takeAway(rng);
  return {
    statement:
      `${cap(who.name)} a ${a} ${rng.pick(words.items).many}. ` +
      `${cap(who.pronoun)} en donne ${b} ${friendOf(rng, words, who).to}. ` +
      'Combien lui en reste-t-il ?',
    steps: [[a, '−', b]],
    method: 'Il lui en reste moins : tu enlèves.',
  };
};

const take: Template = (rng, words) => {
  const [a, b] = takeAway(rng);
  return {
    statement:
      `Il y a ${a} ${rng.pick(words.items).many} ${rng.pick(words.places)}. ` +
      `${cap(rng.pick(words.gatherers).name)} en emporte ${b}. Combien en reste-t-il ?`,
    steps: [[a, '−', b]],
    method: 'Il en reste moins qu’avant : tu enlèves.',
  };
};

const findThenGive: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const a = rng.int(10, 40);
  const b = rng.int(10, 40);
  const c = rng.int(10, a + b - 10);
  return {
    statement:
      `${cap(who.name)} a ${a} ${rng.pick(words.items).many}. ` +
      `${cap(who.pronoun)} en trouve ${b}, puis en donne ${c} ${friendOf(rng, words, who).to}. ` +
      'Combien lui en reste-t-il ?',
    steps: [
      [a, '+', b],
      [a + b, '−', c],
    ],
    method: `D’abord ce qu’${who.pronoun} trouve, puis ce qu’${who.pronoun} donne.`,
  };
};

const takeThenBring: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const a = rng.int(30, 90);
  const b = rng.int(10, a - 10);
  const c = rng.int(10, Math.min(40, 99 - (a - b)));
  return {
    statement:
      `Il y a ${a} ${rng.pick(words.items).many} ${rng.pick(words.places)}. ` +
      `${cap(who.name)} en emporte ${b}, puis ${friendOf(rng, words, who).name} en apporte ${c}. ` +
      'Combien y en a-t-il maintenant ?',
    steps: [
      [a, '−', b],
      [a - b, '+', c],
    ],
    method: 'D’abord ce qui part, puis ce qui arrive.',
  };
};

/** Two factors of the tables, from 2 to 10. */
const factors = (rng: Rng): [number, number] => [rng.int(2, 10), rng.int(2, 10)];

const groups: Template = (rng, words) => {
  const { group, item } = rng.pick(words.groups);
  const [n, k] = factors(rng);
  return {
    statement:
      `Il y a ${n} ${group.many} ${rng.pick(words.places)}. ` +
      `Dans chaque ${group.one}, il y a ${k} ${item.many}. Combien ${de(item.many)} en tout ?`,
    steps: [[n, '×', k]],
    method: `${n} ${group.many} de ${k} : c’est ${n} fois ${k}.`,
  };
};

const piles: Template = (rng, words) => {
  const item = rng.pick(words.items);
  const [n, k] = factors(rng);
  return {
    statement:
      `${cap(rng.pick(words.gatherers).name)} fait ${n} tas de ${k} ${item.many}. ` +
      `Combien ${de(item.many)} en tout ?`,
    steps: [[n, '×', k]],
    method: `${n} tas de ${k} : c’est ${n} fois ${k}.`,
  };
};

const groupsAndMore: Template = (rng, words) => {
  const { group, item } = rng.pick(words.groups);
  const [n, k] = factors(rng);
  const c = rng.int(2, 19);
  return {
    statement:
      `Il y a ${n} ${group.many} de ${k} ${item.many}, ` +
      `et ${c} ${item.many} ${rng.pick(words.places)}. Combien ${de(item.many)} en tout ?`,
    steps: [
      [n, '×', k],
      [n * k, '+', c],
    ],
    method: `D’abord, combien ${de(item.many)} dans les ${group.many} ?`,
  };
};

const groupsGiven: Template = (rng, words) => {
  const who = rng.pick(words.gatherers);
  const { group, item } = rng.pick(words.groups);
  const [n, k] = factors(rng);
  const c = rng.int(2, Math.min(19, n * k - 2));
  return {
    statement:
      `${cap(who.name)} a ${n} ${group.many} de ${k} ${item.many}. ` +
      `${cap(who.pronoun)} en donne ${c} ${friendOf(rng, words, who).to}. ` +
      'Combien lui en reste-t-il ?',
    steps: [
      [n, '×', k],
      [n * k, '−', c],
    ],
    method: `D’abord, combien ${de(item.many)} dans les ${group.many} ?`,
  };
};

/**
 * Levels of « ajouter ou enlever »:
 * 0. one addition;
 * 1. one subtraction;
 * 2. one addition or one subtraction, the child chooses;
 * 3. two steps: an addition and a subtraction.
 */
export const ADD_SUBTRACT_TEMPLATES: readonly (readonly Template[])[] = [
  [gather, bring],
  [give, take],
  [gather, bring, give, take],
  [findThenGive, takeThenBring],
];

/** Levels of « multiplier » : 0. groups of the same size; 1. then add or take some. */
export const MULTIPLY_TEMPLATES: readonly (readonly Template[])[] = [
  [groups, piles],
  [groupsAndMore, groupsGiven],
];

function problem(
  skill: string,
  templates: readonly (readonly Template[])[],
): (rng: Rng, level: number, context: ExerciseContext) => ProblemExercise {
  return (rng, level, { vocabulary }) => {
    if (!templates[level]) throw new RangeError(`niveau ${level}`);
    const draft = rng.pick(templates[level])(rng, vocabulary);
    return {
      skill,
      level,
      instruction: 'Lis bien, puis calcule.',
      statement: draft.statement,
      input: { kind: 'keypad', maxDigits: 3 },
      answer: String(apply(draft.steps.at(-1)!)),
      steps: draft.steps,
      method: draft.method,
    };
  };
}

export const generateAddSubtract = problem(ADD_SUBTRACT, ADD_SUBTRACT_TEMPLATES);
export const generateMultiply = problem(MULTIPLY, MULTIPLY_TEMPLATES);
