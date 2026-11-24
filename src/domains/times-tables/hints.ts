import type { MissingFactorExercise, ProductExercise } from './generators';

/** The factor whose method is the easiest, first: 10, 2, 5, 9, 4, 3, then 6, 8 and 7. */
const EASIEST = [10, 2, 5, 9, 4, 3, 6, 8, 7];

/** The method and the worked answer from the table, `times(k)` being the product with k. */
type Method = (n: number, times: (k: number) => string, p: number) => [string, string];

const METHODS: Record<number, Method> = {
  10: (n, times, p) => [
    `${times(10)} : chaque unité devient une dizaine.`,
    `${times(10)} = ${p} : ${n} dizaines.`,
  ],
  2: (n, times, p) => [`${times(2)}, c’est le double de ${n}.`, `${n} + ${n} = ${p}.`],
  5: (n, times, p) => [
    `${times(5)}, c’est la moitié de ${times(10)}.`,
    `${times(10)} = ${10 * n}, et la moitié de ${10 * n} est ${p}.`,
  ],
  9: (n, times, p) => [
    `${times(9)}, c’est ${times(10)}, moins ${n}.`,
    `${times(10)} = ${10 * n}, puis ${10 * n} − ${n} = ${p}.`,
  ],
  4: (n, times, p) => [
    `${times(4)}, c’est le double du double de ${n}.`,
    `${n} + ${n} = ${2 * n}, puis ${2 * n} + ${2 * n} = ${p}.`,
  ],
  3: (n, times, p) => [
    `${times(3)}, c’est le double de ${n}, plus ${n}.`,
    `${n} + ${n} = ${2 * n}, puis ${2 * n} + ${n} = ${p}.`,
  ],
  6: (n, times, p) => [
    `${times(6)}, c’est ${times(5)}, plus ${n}.`,
    `${times(5)} = ${5 * n}, puis ${5 * n} + ${n} = ${p}.`,
  ],
  8: (n, times, p) => [
    `${times(8)}, c’est le double de ${times(4)}.`,
    `${times(4)} = ${4 * n}, puis ${4 * n} + ${4 * n} = ${p}.`,
  ],
  7: (n, times, p) => [
    `${times(7)}, c’est ${times(5)}, plus ${times(2)}.`,
    `${times(5)} = ${5 * n} et ${times(2)} = ${2 * n}.\n${5 * n} + ${2 * n} = ${p}.`,
  ],
};

/**
 * From a known table: × 5 is half of × 10, × 9 is × 10 minus once, × 6 is × 5 plus once…
 * Written in the order of the statement, so the child recognises it.
 */
export function productHint({ a, b }: ProductExercise, attempt: 1 | 2): string {
  const table = EASIEST.find((t) => t === a || t === b)!;
  const n = table === a ? b : a;
  const times = (k: number) => (table === a ? `${k} × ${n}` : `${n} × ${k}`);
  return METHODS[table](n, times, table * n)[attempt - 1];
}

/** Reciting the shown table up to the product. */
export function missingFactorHint({ a, b, hidden }: MissingFactorExercise, attempt: 1 | 2): string {
  const shown = hidden === 'a' ? b : a;
  const missing = hidden === 'a' ? a : b;
  if (attempt === 1) return `Récite la table de ${shown} jusqu’à ${a * b}.`;
  return `${a} × ${b} = ${a * b}, donc il manque ${missing}.`;
}
