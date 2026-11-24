import type {
  ComplementExercise,
  DoubleHalfExercise,
  OperationExercise,
  TimesTenExercise,
} from './generators';

const tens = (n: number) => Math.floor(n / 10);

/** One off, or the ten forgotten past 10. */
export function sumLures({ a, b }: OperationExercise): number[] {
  const result = a + b;
  return result > 10 ? [result - 10, result - 1, result + 1] : [result - 1, result + 1];
}

/** A carry forgotten or added; in a subtraction, the smaller units taken from the larger. */
export function addSubtractLures({ a, op, b }: OperationExercise): number[] {
  const result = op === '+' ? a + b : a - b;
  if (op === '+') return [result - 10, result + 10];
  const upside = (tens(a) - tens(b)) * 10 + Math.abs((a % 10) - (b % 10));
  return [upside, result + 10, result - 10];
}

/** 9 taken for 11 (and back), or 10 without its correction. */
export function nineElevenLures({ a, op, b }: OperationExercise): number[] {
  const other = b === 9 ? 11 : 9;
  return op === '+' ? [a + other, a + 10] : [a - other, a - 10];
}

/** One ten too many or too few; up to 10, one too many or too few. */
export function complementLures({ given, target }: ComplementExercise): number[] {
  const missing = target - given;
  return target === 10 ? [missing + 1, missing - 1] : [missing + 10, missing - 10];
}

/** One ten off, or the number itself; for a half, the double. */
export function doubleHalfLures({ kind, value }: DoubleHalfExercise): number[] {
  if (kind === 'double') return [2 * value + 10, 2 * value - 10, value];
  return [value / 2 + 5, value / 2 - 5, 2 * value];
}

/** One zero too many or too few, or the factor added. */
export function timesTenLures({ value, factor }: TimesTenExercise): number[] {
  return [value * (factor === 10 ? 100 : 10), value * factor * 10, value + factor];
}
