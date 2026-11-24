import type { MissingFactorExercise, ProductExercise } from './generators';

/** A neighbouring product of either table, or the sum instead of the product. */
export function productLures({ a, b }: ProductExercise): number[] {
  return [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b];
}

/** A neighbouring factor, or the factor shown. */
export function missingFactorLures({ a, b, hidden }: MissingFactorExercise): number[] {
  const [missing, shown] = hidden === 'a' ? [a, b] : [b, a];
  return [missing + 1, missing - 1, shown];
}
