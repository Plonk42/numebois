import { formatNumber } from '../numbers/words';
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

/** Units first, by the ten when crossing it, tens then units for two-digit numbers. */
export function addSubtractHint(exercise: OperationExercise, attempt: 1 | 2): string {
  const { a, op, b } = exercise;
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

/** Through 10: + 9 is + 10 − 1, − 11 is − 10 − 1… */
export function nineElevenHint({ a, op, b }: OperationExercise, attempt: 1 | 2): string {
  const fix = b === 11 ? op : OPPOSITE[op];
  if (attempt === 1) return NINE_ELEVEN_METHOD[`${op}${b}`];
  const middle = apply(a, op, 10);
  return `${a} ${op} 10 = ${middle}, puis ${middle} ${fix} 1 = ${apply(middle, fix, 1)}.`;
}

/** Counting up to 10, by tens to 100, or up to the next ten then to 100. */
export function complementHint({ given, target }: ComplementExercise, attempt: 1 | 2): string {
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

/** Small or round numbers as a sum; other ones tens and units apart. */
export function doubleHalfHint({ kind, value }: DoubleHalfExercise, attempt: 1 | 2): string {
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

/** Each unit becomes a ten (or a hundred), whatever the order. */
export function timesTenHint(
  { value, factor, factorFirst }: TimesTenExercise,
  attempt: 1 | 2,
): string {
  const [one, many] = factor === 10 ? ['dizaine', 'dizaines'] : ['centaine', 'centaines'];
  if (attempt === 1) {
    const method = `× ${factor} : chaque unité devient une ${one}.`;
    return factorFirst ? `${factor} × ${value}, c’est ${value} × ${factor}.\n${method}` : method;
  }
  const product = factorFirst ? `${factor} × ${value}` : `${value} × ${factor}`;
  return `${product} = ${formatNumber(value * factor)} : ${value} ${many}.`;
}
