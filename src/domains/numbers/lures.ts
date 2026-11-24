import type { DecomposeExercise, NumberLineExercise, WriteDigitsExercise } from './generators';

/** The zeros of the empty ranks left out: 3 042 written 342. */
function withoutZeros(value: number): number {
  return Number(String(value).replaceAll('0', '')) || value;
}

/** The empty rank forgotten. */
export function writeDigitsLures({ value }: WriteDigitsExercise): number[] {
  return [withoutZeros(value)];
}

/**
 * The empty rank forgotten; the digit of another column; the digit alone, the whole number
 * or a neighbouring rank instead of the count.
 */
export function decomposeLures({ value, ask, rank }: DecomposeExercise): number[] {
  if (ask === 'compose') return [withoutZeros(value)];
  if (ask === 'digit') return [...String(value)].map(Number);
  return [
    Math.floor(value / 10 ** rank) % 10,
    value,
    Math.floor(value / 10 ** (rank + 1)),
    Math.floor(value / 10 ** (rank - 1)),
  ];
}

/** A tick or two away from the arrow. */
export function numberLineLures({ line, value }: NumberLineExercise): number[] {
  return [-2, -1, 1, 2]
    .map((ticks) => value + ticks * line.step)
    .filter((tick) => tick >= line.from && tick <= line.to);
}
