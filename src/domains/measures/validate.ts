import type { Exercise } from '../../core/types';
import { validateNumber } from '../../core/validate';
import type { DrawExercise } from './generators';

/** The segment drawn to the millimetre, or one off: a pencil line is that wide. */
export function validateDrawing(exercise: DrawExercise, answer: string): boolean {
  return /^\d{1,3}$/.test(answer) && Math.abs(Number(answer) - exercise.length) <= 1;
}

export const validateMeasure = (exercise: Exercise, answer: string) =>
  validateNumber(exercise, answer);
