import { formatNumber } from '../numbers/words';
import { addStatement, type AdditionExercise } from './generators';

/** 1: the method, column by column; 2: the result, the carries shown in the grid. */
export function additionHint({ rows }: AdditionExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    return 'Calcule chaque colonne, de droite à gauche.\nLa retenue va en haut de la colonne suivante.';
  }
  const sum = rows.reduce((total, n) => total + n, 0);
  return `${addStatement(rows)} = ${formatNumber(sum)}.\nRegarde les retenues en haut des colonnes.`;
}
