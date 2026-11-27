import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { formatNumber } from '../numbers/words';
import {
  addStatement,
  multiplyStatement,
  subtractStatement,
  type AdditionExercise,
  type MultiplicationExercise,
  type SubtractionExercise,
} from './generators';

const RANKS = ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de milliers'];

/** The digit of `n` at `rank`, from the units. */
const digit = (n: number, rank: number) => Math.floor(n / 10 ** rank) % 10;

/**
 * What a wrong result tells (#168): the last digit left out, a carry forgotten in the first
 * column that differs, or that column miscalculated. `carries[r]` is the carry column r receives.
 */
export function columnSlip(
  right: number,
  carries: readonly number[],
  tried: number,
  carried: string,
  sign: 1 | -1 = 1,
  names: readonly string[] = RANKS,
) {
  const length = String(right).length;
  if (String(tried).length < length && tried === right % 10 ** (length - 1)) {
    return 'Il manque le dernier chiffre.\nÀ la fin, écris le nombre entier.';
  }
  const rank = Array.from({ length }, (_, r) => r).find((r) => digit(tried, r) !== digit(right, r));
  if (rank === undefined || rank >= names.length) return null;
  const carry = carries[rank] ?? 0;
  // Without its carry, a sum has one less in that column, a difference one more.
  if (carry > 0 && digit(tried, rank) === (digit(right, rank) - sign * carry + 10) % 10) {
    return `Aux ${names[rank]}, tu as oublié la retenue.\n${carried}`;
  }
  const again = `Recalcule la colonne des ${names[rank]}.`;
  if (rank === 0) return again;
  if (rank > 1) return `Les colonnes de droite sont bonnes.\n${again}`;
  return `${names === RANKS ? 'Les unités sont bonnes' : 'La colonne de droite est bonne'}.\n${again}`;
}

/** The carry each column receives, from the units. */
function carriesOf(sums: (rank: number) => number, ranks: number): number[] {
  const carries = [0];
  for (let r = 0; r < ranks; r++) carries.push(Math.floor((sums(r) + carries[r]) / 10));
  return carries;
}

/** 1: the mistake when recognised, else the method, column by column; 2: the result. */
export function additionHint({ rows }: AdditionExercise, attempt: 1 | 2, tried?: Tried): string {
  const sum = rows.reduce((total, n) => total + n, 0);
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const ranks = String(sum).length;
    const carries = carriesOf((r) => rows.reduce((total, n) => total + digit(n, r), 0), ranks);
    const slip =
      answer !== null && answer !== sum
        ? columnSlip(sum, carries, answer, 'Elle est en haut de la colonne.')
        : null;
    return (
      slip ??
      'Calcule chaque colonne, de droite à gauche.\nLa retenue va en haut de la colonne suivante.'
    );
  }
  return `${addStatement(rows)} = ${formatNumber(sum)}.\nRegarde les retenues en haut des colonnes.`;
}

/** 1: the mistake when recognised, else the multiplier times each digit, the bag; 2: the result. */
export function multiplicationHint(
  { a, b }: MultiplicationExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const carries = carriesOf((r) => b * digit(a, r), String(a).length);
    const slip =
      answer !== null && answer !== a * b
        ? columnSlip(a * b, carries, answer, 'Elle est dans le sac.')
        : null;
    return (
      slip ??
      `Calcule ${b} × chaque chiffre, de droite à gauche.\nAjoute le sac. À la fin, écris le nombre entier.`
    );
  }
  return `${multiplyStatement(a, b)} = ${formatNumber(a * b)}.\nLe sac garde la retenue pour la colonne suivante.`;
}

export const COMPENSATION = 'En haut trop petit ? Ajoute 10, et retiens 1 en bas.';

/**
 * The first column that differs worked the other way round, the bottom digit minus the top one
 * (« 8 − 3 » for « 3 − 8 »): the top digit needed 10 more (#173).
 */
function upsideDown({ top, bottom }: SubtractionExercise, tried: number): string | null {
  const right = top - bottom;
  let received = 0;
  for (let rank = 0; rank < String(top).length; rank++) {
    const [high, taken] = [digit(top, rank), digit(bottom, rank) + received];
    if (digit(tried, rank) !== digit(right, rank)) {
      if (high >= taken || digit(tried, rank) !== taken - high) return null;
      return `Aux ${RANKS[rank]}, ${high} − ${taken}, on ne peut pas.\n${COMPENSATION}`;
    }
    received = high < taken ? 1 : 0;
  }
  return null;
}

/** 1: the mistake when recognised, else the method by compensation; 2: the result. */
export function subtractionHint(
  exercise: SubtractionExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { top, bottom } = exercise;
  if (attempt === 2) {
    return `${subtractStatement(top, bottom)} = ${formatNumber(top - bottom)}.\nRegarde les retenues en bas des colonnes.`;
  }
  const answer = triedNumber(tried);
  if (answer === null || answer === top - bottom) {
    return `Calcule chaque colonne, de droite à gauche.\n${COMPENSATION}`;
  }
  const carries = [0];
  for (let r = 0; r < String(top).length; r++) {
    carries.push(digit(top, r) < digit(bottom, r) + carries[r] ? 1 : 0);
  }
  return (
    upsideDown(exercise, answer) ??
    columnSlip(top - bottom, carries, answer, 'Ajoute-la au chiffre du bas.', -1) ??
    `Calcule chaque colonne, de droite à gauche.\n${COMPENSATION}`
  );
}

/** The columns worked the other way round, a carry forgotten. */
export function subtractionLures({ top, bottom }: SubtractionExercise): number[] {
  const turned = Number(
    [...String(top)]
      .map((_, i, digits) => {
        const rank = digits.length - 1 - i;
        return Math.abs(digit(top, rank) - digit(bottom, rank));
      })
      .join(''),
  );
  const columns = String(top).length;
  const forgotten: number[] = [];
  let received = 0;
  for (let rank = 0; rank < columns; rank++) {
    const carry = digit(top, rank) < digit(bottom, rank) + received ? 1 : 0;
    if (received > 0) forgotten.push(top - bottom + 10 ** rank);
    received = carry;
  }
  return [turned, ...forgotten].filter((n) => n !== top - bottom);
}
