import type { Exercise, Tried } from '../../core/types';
import { Rng } from '../../core/rng';
import { triedNumber } from '../../core/validate';
import { formatNumber } from './words';

export const OPERATION_WORDS = 'numbers.operation-words';

type Calculation = 'sum' | 'difference' | 'product';
type Operator = '+' | '−' | '×';

/** What is asked: a result named by its word, even or odd, a multiple, or the word itself. */
export type OperationWordsAsk = Calculation | 'even' | 'multiple' | 'word';

/** A word of the operations (BO CE2): terme, somme, différence, facteur, produit. */
export type OperationWord = 'un terme' | 'un facteur' | 'la somme' | 'la différence' | 'le produit';

export interface OperationWordsExercise extends Exercise {
  ask: OperationWordsAsk;
  /** The numbers of the operation, or the number to judge (`even`, `multiple`). */
  a: number;
  b: number;
  /** `multiple`: whose multiples are asked. */
  of?: number;
  /** `word`: the operation, and which of its numbers is named (2: the result). */
  operator?: Operator;
  named?: 0 | 1 | 2;
}

/**
 * Levels of « les mots des opérations » (#178):
 * 0. la somme de 12 et 25, la différence entre 60 et 37, at the keypad;
 * 1. the same, and le produit de 6 et 7;
 * 2. pair ou impair, up to 9 999;
 * 3. multiples: « 75 est-il un multiple de 25 ? », or the multiple of 7 among 4;
 * 4. the word of a number in an operation: terme, somme, différence, facteur, produit.
 */
export const OPERATION_WORDS_LEVELS = 5;

/** Multiples recognised by their last digits, or in the tables. */
const DIVISORS = [2, 5, 10, 25, 50, 100, 3, 4, 6, 7, 8, 9] as const;

const WORDS: readonly OperationWord[] = [
  'un terme',
  'un facteur',
  'la somme',
  'la différence',
  'le produit',
];

const OPERATIONS: Record<
  Calculation,
  { word: OperationWord; name: string; sign: Operator; phrase: (a: number, b: number) => string }
> = {
  sum: {
    word: 'la somme',
    name: 'addition',
    sign: '+',
    phrase: (a, b) => `La somme de ${a} et ${b}\u00a0?`,
  },
  difference: {
    word: 'la différence',
    name: 'soustraction',
    sign: '−',
    phrase: (a, b) => `La différence entre ${a} et ${b}\u00a0?`,
  },
  product: {
    word: 'le produit',
    name: 'multiplication',
    sign: '×',
    phrase: (a, b) => `Le produit de ${a} et ${b}\u00a0?`,
  },
};

const CALCULATION_OF: Record<Operator, Calculation> = {
  '+': 'sum',
  '−': 'difference',
  '×': 'product',
};

/** What each word means, to name a word chosen for another (#168). */
const MEANING: Record<OperationWord, string> = {
  'un terme': 'Un terme, c’est un nombre qu’on additionne ou soustrait.',
  'un facteur': 'Un facteur, c’est un nombre qu’on multiplie.',
  'la somme': 'La somme, c’est le résultat d’une addition.',
  'la différence': 'La différence, c’est le résultat d’une soustraction.',
  'le produit': 'Le produit, c’est le résultat d’une multiplication.',
};

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function capital(text: string): string {
  return text[0].toUpperCase() + text.slice(1);
}

/** Two numbers of an addition, a subtraction (the larger first) or a multiplication. */
function drawPair(rng: Rng, ask: Calculation): [number, number] {
  if (ask === 'product') return [rng.int(2, 9), rng.int(2, 9)];
  if (ask === 'sum') {
    const a = rng.int(11, 79);
    return [a, rng.int(11, 99 - a)];
  }
  const a = rng.int(30, 99);
  return [a, rng.int(11, a - 5)];
}

export function resultOf(ask: Calculation, a: number, b: number): number {
  if (ask === 'sum') return a + b;
  return ask === 'difference' ? Math.abs(a - b) : a * b;
}

function calculation(rng: Rng, level: number): OperationWordsExercise {
  const asks: readonly Calculation[] =
    level === 0 ? ['sum', 'difference'] : ['sum', 'difference', 'product'];
  const ask = rng.pick(asks);
  const [a, b] = drawPair(rng, ask);
  return {
    skill: OPERATION_WORDS,
    level,
    instruction: 'Calcule de tête.',
    statement: OPERATIONS[ask].phrase(a, b),
    input: { kind: 'keypad', maxDigits: 3 },
    answer: String(resultOf(ask, a, b)),
    ask,
    a,
    b,
  };
}

function evenOrOdd(rng: Rng, level: number): OperationWordsExercise {
  const digits = rng.int(2, 4);
  const a = rng.int(10 ** (digits - 1), 10 ** digits - 1);
  return {
    skill: OPERATION_WORDS,
    level,
    instruction: 'Choisis le bon mot.',
    statement: `${formatNumber(a)} est-il pair ou impair\u00a0?`,
    input: { kind: 'choice', options: ['pair', 'impair'] },
    answer: a % 2 === 0 ? 'pair' : 'impair',
    ask: 'even',
    a,
    b: 0,
  };
}

function largestOf(of: number): number {
  if (of >= 25) return 1000;
  if (of === 10) return 990;
  return of <= 5 ? 99 : of * 10;
}

/** A number up to `largestOf(of)`, a multiple of `of` or not, as asked. */
function drawNear(rng: Rng, of: number, multiple: boolean): number {
  for (;;) {
    const n = rng.int(of + 1, largestOf(of));
    // Not a multiple of 10, 25… but ending in 0 or 5 all the same: it has to be checked.
    if ((n % of === 0) === multiple && (multiple || of < 10 || n % 5 === 0)) return n;
  }
}

function multiples(rng: Rng, level: number): OperationWordsExercise {
  const of = rng.pick(DIVISORS);
  const base = { skill: OPERATION_WORDS, level, ask: 'multiple' as const, of, b: 0 };
  if (rng.chance(0.5)) {
    const a = drawNear(rng, of, rng.chance(0.5));
    return {
      ...base,
      instruction: 'Réponds par oui ou par non.',
      statement: `${formatNumber(a)} est-il un multiple de ${of}\u00a0?`,
      input: { kind: 'choice', options: ['oui', 'non'] },
      answer: a % of === 0 ? 'oui' : 'non',
      a,
    };
  }
  const a = drawNear(rng, of, true);
  const others = new Set<number>();
  while (others.size < 3) others.add(drawNear(rng, of, false));
  return {
    ...base,
    instruction: 'Choisis le bon nombre.',
    statement: `Lequel est un multiple de ${of}\u00a0?`,
    input: { kind: 'choice', options: shuffled(rng, [a, ...others]).map(formatNumber) },
    answer: formatNumber(a),
    a,
  };
}

export function wordOf(operator: Operator, named: 0 | 1 | 2): OperationWord {
  if (named < 2) return operator === '×' ? 'un facteur' : 'un terme';
  return OPERATIONS[CALCULATION_OF[operator]].word;
}

/** The numbers of a `word` exercise: both terms or factors, then the result. */
function numbersOf({ a, b, operator }: OperationWordsExercise): [number, number, number] {
  return [a, b, resultOf(CALCULATION_OF[operator!], a, b)];
}

function word(rng: Rng, level: number): OperationWordsExercise {
  const operator = rng.pick(['+', '−', '×'] as const);
  let [a, b] = drawPair(rng, CALCULATION_OF[operator]);
  // 60 − 30 = 30: which 30 is named?
  while (resultOf(CALCULATION_OF[operator], a, b) === b)
    [a, b] = drawPair(rng, CALCULATION_OF[operator]);
  const named = rng.pick([0, 1, 2, 2] as const);
  const answer = wordOf(operator, named);
  const others = shuffled(
    rng,
    WORDS.filter((w) => w !== answer),
  ).slice(0, 3);
  const exercise: OperationWordsExercise = {
    skill: OPERATION_WORDS,
    level,
    instruction: 'Choisis le bon mot.',
    statement: '',
    input: { kind: 'choice', options: shuffled(rng, [answer, ...others]) },
    answer,
    ask: 'word',
    a,
    b,
    operator,
    named,
  };
  const numbers = numbersOf(exercise);
  exercise.statement = `Dans ${a} ${operator} ${b} = ${numbers[2]}, ${numbers[named]} est…`;
  return exercise;
}

export function generateOperationWords(rng: Rng, level: number): OperationWordsExercise {
  if (level <= 1) return calculation(rng, level);
  if (level === 2) return evenOrOdd(rng, level);
  if (level === 3) return multiples(rng, level);
  if (level === 4) return word(rng, level);
  throw new RangeError(`niveau ${level}`);
}

/** The result of another operation on the same two numbers. */
export function operationWordsLures({ ask, a, b }: OperationWordsExercise): number[] {
  if (ask === 'sum') return a === b ? [] : [Math.abs(a - b)];
  if (ask === 'difference' || ask === 'product') return [a + b];
  return [];
}

/** The result of another operation given (#168): « 37, c’est la somme : 12 + 25. » */
function calculationSlip(ask: Calculation, a: number, b: number, tried?: Tried): string | null {
  const answer = triedNumber(tried);
  if (answer === null || answer === resultOf(ask, a, b)) return null;
  const other = (['sum', 'difference', 'product'] as const).find(
    (o) => o !== ask && resultOf(o, a, b) === answer,
  );
  if (!other) return null;
  const { word: said, sign } = OPERATIONS[other];
  const { word: wanted, name } = OPERATIONS[ask];
  const [x, y] = other === 'difference' ? [Math.max(a, b), Math.min(a, b)] : [a, b];
  return `${answer}, c’est ${said} : ${x} ${sign} ${y}.\nPour ${wanted}, fais une ${name}.`;
}

/** How to tell a multiple of `of` (multiples of 2 are the even numbers). */
function multipleMethod(of: number): string {
  switch (of) {
    case 2:
      return 'Les multiples de 2 sont les nombres pairs.';
    case 5:
      return 'Un multiple de 5 finit par 0 ou par 5.';
    case 10:
      return 'Un multiple de 10 finit par 0.';
    case 25:
      return 'Un multiple de 25 finit par 00, 25, 50 ou 75.';
    case 50:
      return 'Un multiple de 50 finit par 00 ou par 50.';
    case 100:
      return 'Un multiple de 100 finit par 00.';
    default:
      return `Les multiples de ${of} sont dans la table de ${of}.`;
  }
}

/** « 75 = 3 × 25 », or the two multiples around a number that is not one. */
function multipleAnswer(n: number, of: number): string {
  const times = Math.floor(n / of);
  if (n % of === 0) return `${formatNumber(n)} = ${times} × ${of}.\nC’est un multiple de ${of}.`;
  const [below, above] = [times * of, (times + 1) * of].map(formatNumber);
  return `${formatNumber(n)} est entre ${below} et ${above}.\nCe n’est pas un multiple de ${of}.`;
}

const WORD_METHOD =
  'Addition : termes et somme.\nSoustraction : termes et différence.\nMultiplication : facteurs et produit.';

function wordHint(exercise: OperationWordsExercise, attempt: 1 | 2, tried?: Tried): string {
  const n = numbersOf(exercise)[exercise.named!];
  const { name } = OPERATIONS[CALCULATION_OF[exercise.operator!]];
  if (attempt === 2) return `C’est une ${name}.\n${n} est ${exercise.answer}.`;
  const chosen = WORDS.find((w) => w === tried?.answer && w !== exercise.answer);
  if (!chosen) return WORD_METHOD;
  const role = exercise.named === 2 ? 'est le résultat' : 'n’est pas le résultat';
  return `${MEANING[chosen]}\nIci, c’est une ${name}, et ${n} ${role}.`;
}

export function operationWordsHint(
  exercise: OperationWordsExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { ask, a, b } = exercise;
  if (ask === 'even') {
    if (attempt === 1)
      return 'Regarde le chiffre des unités.\nPair : il finit par 0, 2, 4, 6 ou 8.';
    return `${formatNumber(a)} finit par ${a % 10} : il est ${exercise.answer}.`;
  }
  if (ask === 'multiple') {
    return attempt === 1 ? multipleMethod(exercise.of!) : multipleAnswer(a, exercise.of!);
  }
  if (ask === 'word') return wordHint(exercise, attempt, tried);
  const { word: wanted, name, sign } = OPERATIONS[ask];
  if (attempt === 2)
    return `${a} ${sign} ${b} = ${exercise.answer}.\n${capital(wanted)} est ${exercise.answer}.`;
  return (
    calculationSlip(ask, a, b, tried) ?? `${capital(wanted)}, c’est le résultat d’une ${name}.`
  );
}
