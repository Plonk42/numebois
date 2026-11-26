import { formatNumber } from '../numbers/words';
import {
  addStatement,
  multiplyStatement,
  type AdditionExercise,
  type MultiplicationExercise,
} from './generators';

/** 1: the method, column by column; 2: the result, the carries shown in the grid. */
export function additionHint({ rows }: AdditionExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    return 'Calcule chaque colonne, de droite à gauche.\nLa retenue va en haut de la colonne suivante.';
  }
  const sum = rows.reduce((total, n) => total + n, 0);
  return `${addStatement(rows)} = ${formatNumber(sum)}.\nRegarde les retenues en haut des colonnes.`;
}

/** 1: the multiplier times each digit, the bag added, the last number whole; 2: the result. */
export function multiplicationHint({ a, b }: MultiplicationExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    return `Calcule ${b} × chaque chiffre, de droite à gauche.\nAjoute le sac. À la fin, écris le nombre entier.`;
  }
  return `${multiplyStatement(a, b)} = ${formatNumber(a * b)}.\nLe sac garde la retenue pour la colonne suivante.`;
}
