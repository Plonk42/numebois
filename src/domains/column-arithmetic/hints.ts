import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { formatNumber } from '../numbers/words';
import {
  addStatement,
  multiplyStatement,
  type AdditionExercise,
  type MultiplicationExercise,
} from './generators';

const RANKS = ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de milliers'];

/** The digit of `n` at `rank`, from the units. */
const digit = (n: number, rank: number) => Math.floor(n / 10 ** rank) % 10;

/**
 * What a wrong result tells (#168): the last digit left out, a carry forgotten in the first
 * column that differs, or that column miscalculated. `carries[r]` is the carry column r receives.
 */
function columnSlip(right: number, carries: readonly number[], tried: number, carried: string) {
  const length = String(right).length;
  if (String(tried).length < length && tried === right % 10 ** (length - 1)) {
    return 'Il manque le dernier chiffre.\nÀ la fin, écris le nombre entier.';
  }
  const rank = Array.from({ length }, (_, r) => r).find((r) => digit(tried, r) !== digit(right, r));
  if (rank === undefined || rank >= RANKS.length) return null;
  const carry = carries[rank] ?? 0;
  if (carry > 0 && digit(tried, rank) === (digit(right, rank) - carry + 10) % 10) {
    return `Aux ${RANKS[rank]}, tu as oublié la retenue.\n${carried}`;
  }
  const again = `Recalcule la colonne des ${RANKS[rank]}.`;
  if (rank === 0) return again;
  return `${rank === 1 ? 'Les unités sont bonnes' : 'Les colonnes de droite sont bonnes'}.\n${again}`;
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
