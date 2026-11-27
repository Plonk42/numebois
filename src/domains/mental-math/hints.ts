import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { formatNumber } from '../numbers/words';
import { complementLures } from './lures';
import type {
  ComplementExercise,
  DoubleHalfExercise,
  OperationExercise,
  Operator,
  TimesTenExercise,
} from './generators';

function apply(a: number, op: Operator, b: number): number {
  return op === '+' ? a + b : a - b;
}

const OPPOSITE: Record<Operator, Operator> = { '+': '−', '−': '+' };

const NINE_ELEVEN_METHOD: Record<string, string> = {
  '+9': 'Ajouter 9, c’est ajouter 10 puis enlever 1.',
  '+11': 'Ajouter 11, c’est ajouter 10 puis encore 1.',
  '−9': 'Enlever 9, c’est enlever 10 puis remettre 1.',
  '−11': 'Enlever 11, c’est enlever 10 puis encore 1.',
};

/** 10 added or taken away, its correction forgotten (#168). */
const TEN_ONLY: Record<string, string> = {
  '+9': 'Tu as ajouté 10, c’est 1 de trop.\nEnlève encore 1.',
  '+11': 'Tu as ajouté 10.\nAjoute encore 1.',
  '−9': 'Tu as enlevé 10, c’est 1 de trop.\nRemets 1.',
  '−11': 'Tu as enlevé 10.\nEnlève encore 1.',
};

const tenForgotten = (a: number, b: number) =>
  `Tu as écrit les unités, pas la dizaine.\n${a} + ${b}, c’est plus que 10.`;

/** The mistake named, then the method: the hint after a recognised wrong answer (#168). */
const named = (mistake: string, method: string) => `${mistake}\n${method}`;

/** 1: one off, or the ten forgotten, else the method; 2: the sum worked out. */
export function sumHint(exercise: OperationExercise, attempt: 1 | 2, tried?: Tried): string {
  const { a, b } = exercise;
  const result = a + b;
  const answer = triedNumber(tried);
  if (attempt === 1 && answer !== null && answer !== result) {
    if (result > 10 && answer === result - 10) return tenForgotten(a, b);
    if (Math.abs(answer - result) === 1) {
      return named('Tu es à 1 du bon nombre.', sumMethod(exercise, 1));
    }
  }
  return sumMethod(exercise, attempt);
}

function sumMethod({ a, b }: OperationExercise, attempt: 1 | 2): string {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const result = a + b;
  if (a === b) {
    return attempt === 1 ? `C’est le double de ${a}.` : `Le double de ${a}, c’est ${result}.`;
  }
  if (result <= 10) {
    return attempt === 1
      ? `Pars de ${big} et avance de ${small}.`
      : `${big} + ${small} = ${result}.`;
  }
  const toTen = 10 - big;
  if (attempt === 1) return `Pars de ${big}, va jusqu’à 10, puis ajoute le reste.`;
  return `${big} + ${toTen} = 10, puis 10 + ${small - toTen} = ${result}.`;
}

/** What a wrong result tells: the units right but the tens not, or a subtraction upside down. */
function addSubtractSlip({ a, op, b }: OperationExercise, answer: number): string | null {
  const result = apply(a, op, b);
  const [ua, ub] = [a % 10, b % 10];
  const crosses = op === '+' ? ua + ub >= 10 : ub > ua;
  if (answer % 10 === result % 10) {
    const right = 'Les unités sont bonnes.';
    if (op === '+' && crosses && answer === result - 10) {
      return named(right, `${ua} + ${ub} = ${ua + ub} : garde la dizaine en plus !`);
    }
    if (op === '−' && crosses && answer === result + 10) {
      return named(right, 'Tu as défait une dizaine : il en reste une de moins.');
    }
    return named(right, 'Recompte les dizaines.');
  }
  if (op === '−' && crosses && answer === a - ua - (b - ub) + ub - ua) {
    const upside = `Tu as fait ${ub} − ${ua}, à l’envers.`;
    if (b < 10) return named(upside, `Descends d’abord jusqu’à ${a - ua}, puis enlève le reste.`);
    return named(upside, `Enlève d’abord ${b - ub}, puis encore ${ub}.`);
  }
  return null;
}

/**
 * 1: the mistake when recognised, else units first, by the ten when crossing it, tens then units
 * for two-digit numbers; 2: the steps worked out.
 */
export function addSubtractHint(
  exercise: OperationExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { a, op, b } = exercise;
  const answer = triedNumber(tried);
  if (attempt === 1 && answer !== null && answer !== apply(a, op, b)) {
    const slip = addSubtractSlip(exercise, answer);
    if (slip) return slip;
  }
  if (b < 10) return oneDigitHint(exercise, attempt);
  const result = apply(a, op, b);
  const units = b % 10;
  if (units === 0) {
    const tens = a - (a % 10);
    if (attempt === 1) return `Compte en dizaines : ${tens / 10} ${op} ${b / 10} dizaines.`;
    return `${tens} ${op} ${b} = ${apply(tens, op, b)}, donc ${a} ${op} ${b} = ${result}.`;
  }
  if (attempt === 1) {
    return op === '+'
      ? 'Ajoute d’abord les dizaines, puis les unités.'
      : 'Enlève d’abord les dizaines, puis les unités.';
  }
  const middle = apply(a, op, b - units);
  return `${a} ${op} ${b - units} = ${middle}, puis ${middle} ${op} ${units} = ${result}.`;
}

function oneDigitHint({ a, op, b }: OperationExercise, attempt: 1 | 2): string {
  const result = apply(a, op, b);
  const crosses = op === '+' ? (a % 10) + b >= 10 : b > a % 10;
  if (!crosses) {
    const step = `${a % 10} ${op} ${b}`;
    if (attempt === 1) return `Calcule les unités : ${step}.`;
    return `${step} = ${apply(a % 10, op, b)}, donc ${a} ${op} ${b} = ${result}.`;
  }
  const ten = a - (a % 10) + (op === '+' ? 10 : 0);
  if (attempt === 1) {
    return op === '+'
      ? `Va d’abord jusqu’à ${ten}, puis ajoute le reste.`
      : `Descends d’abord jusqu’à ${ten}, puis enlève le reste.`;
  }
  const first = Math.abs(ten - a);
  return `${a} ${op} ${first} = ${ten}, puis ${ten} ${op} ${b - first} = ${result}.`;
}

/** Through 10: + 9 is + 10 − 1, − 11 is − 10 − 1…; 10 alone, or 9 and 11 swapped, named. */
export function nineElevenHint(
  { a, op, b }: OperationExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const fix = b === 11 ? op : OPPOSITE[op];
  const method = NINE_ELEVEN_METHOD[`${op}${b}`];
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const other = b === 9 ? 11 : 9;
    if (answer === apply(a, op, 10)) return TEN_ONLY[`${op}${b}`];
    if (answer === apply(a, op, other)) return named(`Ça, c’est ${a} ${op} ${other}.`, method);
    return method;
  }
  const middle = apply(a, op, 10);
  return `${a} ${op} 10 = ${middle}, puis ${middle} ${fix} 1 = ${apply(middle, fix, 1)}.`;
}

/**
 * Counting up to 10, by tens to 100, or up to the next ten then to 100; an answer one (or one
 * ten) off is first checked: « 3 + 6 = 9, pas 10 ».
 */
export function complementHint(
  exercise: ComplementExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { given, target } = exercise;
  const answer = triedNumber(tried);
  if (attempt === 1 && answer !== null && complementLures(exercise).includes(answer)) {
    const check = `${given} + ${answer} = ${given + answer}, pas ${target}.`;
    return named(check, complementMethod(exercise, 1));
  }
  return complementMethod(exercise, attempt);
}

function complementMethod({ given, target }: ComplementExercise, attempt: 1 | 2): string {
  const missing = target - given;
  if (target === 10) {
    return attempt === 1 ? `Compte de ${given} jusqu’à 10.` : `${given} + ${missing} = 10.`;
  }
  if (given % 10 === 0) {
    if (attempt === 1) return `Compte en dizaines, de ${given / 10} jusqu’à 10.`;
    return `${given / 10} + ${missing / 10} = 10, donc ${given} + ${missing} = 100.`;
  }
  const ten = given - (given % 10) + 10;
  if (attempt === 1) return `Va d’abord jusqu’à ${ten}, puis jusqu’à 100.`;
  return (
    `${given} + ${ten - given} = ${ten}, puis ${ten} + ${100 - ten} = 100.\n` +
    `${ten - given} + ${100 - ten} = ${missing}.`
  );
}

/** What a wrong double or half tells: the number copied, the ten forgotten, the double… */
function doubleHalfSlip(exercise: DoubleHalfExercise, answer: number): string | null {
  const { kind, value } = exercise;
  if (kind === 'double') {
    const double = 2 * value;
    if (answer === value) return `Tu as recopié ${value}.\nLe double, c’est ${value} + ${value}.`;
    if (value <= 10 && double > 10 && answer === double - 10) return tenForgotten(value, value);
    if (value > 10 && answer % 10 === double % 10) {
      return `Les unités sont bonnes.\nRecompte le double de ${value - (value % 10)}.`;
    }
    return null;
  }
  if (answer === 2 * value) {
    return `Ça, c’est le double de ${value}.\nLa moitié est plus petite que ${value}.`;
  }
  if (Math.abs(answer - value / 2) === 5) {
    const check = `${answer} + ${answer} = ${2 * answer}, pas ${value}.`;
    return named(check, doubleHalfMethod(exercise, 1));
  }
  return null;
}

/** 1: the mistake when recognised, else the method; 2: the double or half worked out. */
export function doubleHalfHint(
  exercise: DoubleHalfExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { kind, value } = exercise;
  const answer = triedNumber(tried);
  const right = kind === 'double' ? 2 * value : value / 2;
  if (attempt === 1 && answer !== null && answer !== right) {
    const slip = doubleHalfSlip(exercise, answer);
    if (slip) return slip;
  }
  return doubleHalfMethod(exercise, attempt);
}

/** Small or round numbers as a sum; other ones tens and units apart. */
function doubleHalfMethod({ kind, value }: DoubleHalfExercise, attempt: 1 | 2): string {
  const units = value % 10;
  const tens = value - units;
  if (kind === 'double') {
    if (value <= 10 || units === 0) {
      return attempt === 1
        ? `Le double de ${value}, c’est ${value} + ${value}.`
        : `${value} + ${value} = ${2 * value}.`;
    }
    if (attempt === 1) return 'Double les dizaines, puis les unités.';
    return (
      `Double de ${tens} : ${2 * tens}. Double de ${units} : ${2 * units}.\n` +
      `${2 * tens} + ${2 * units} = ${2 * value}.`
    );
  }
  const half = value / 2;
  if (value <= 20 || units === 0) {
    return attempt === 1
      ? `Cherche le nombre qui, ajouté à lui-même, fait ${value}.`
      : `${half} + ${half} = ${value}, donc la moitié de ${value} est ${half}.`;
  }
  if (attempt === 1) return 'Partage les dizaines, puis les unités.';
  return (
    `Moitié de ${tens} : ${tens / 2}. Moitié de ${units} : ${units / 2}.\n` +
    `${tens / 2} + ${units / 2} = ${half}.`
  );
}

const RANKS: Record<number, [string, string]> = {
  10: ['dizaine', 'dizaines'],
  100: ['centaine', 'centaines'],
};

/** What a wrong product by 10 or 100 tells: the other rank, one zero too many, or a sum. */
function timesTenSlip({ value, factor, factorFirst }: TimesTenExercise, answer: number) {
  const times = (k: number) =>
    factorFirst ? `${formatNumber(k)} × ${value}` : `${value} × ${formatNumber(k)}`;
  const other = factor === 10 ? 100 : 10;
  if (answer === value * other) return `Ça, c’est ${times(other)} : ${value} ${RANKS[other][1]}.`;
  if (factor === 100 && answer === value * 1000) return `Ça, c’est ${times(1000)}.`;
  if (answer !== value + factor) return null;
  const sum = factorFirst ? `${factor} + ${value}` : `${value} + ${factor}`;
  return `${sum} = ${value + factor} : c’est une addition.`;
}

/** Each unit becomes a ten (or a hundred), whatever the order; the wrong rank or a sum named. */
export function timesTenHint(exercise: TimesTenExercise, attempt: 1 | 2, tried?: Tried): string {
  const { value, factor, factorFirst } = exercise;
  const [one, many] = RANKS[factor];
  if (attempt === 1) {
    const method = `× ${factor} : chaque unité devient une ${one}.`;
    const answer = triedNumber(tried);
    const slip = answer === null ? null : timesTenSlip(exercise, answer);
    if (slip) return named(slip, method);
    return factorFirst ? `${factor} × ${value}, c’est ${value} × ${factor}.\n${method}` : method;
  }
  const product = factorFirst ? `${factor} × ${value}` : `${value} × ${factor}`;
  return `${product} = ${formatNumber(value * factor)} : ${value} ${many}.`;
}
