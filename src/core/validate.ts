import type { Exercise } from './types';

/** A whole number typed on the keypad; leading zeros do not matter. */
export function validateNumber(exercise: Exercise, answer: string): boolean {
  return /^\d{1,6}$/.test(answer) && Number(answer) === Number(exercise.answer);
}

/** One of the offered choices. */
export function validateChoice(exercise: Exercise, answer: string): boolean {
  return answer === exercise.answer;
}
