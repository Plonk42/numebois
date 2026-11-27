import type { Exercise, Tried } from './types';

/** A whole number typed on the keypad; leading zeros do not matter. */
export function validateNumber(exercise: Exercise, answer: string): boolean {
  return /^\d{1,6}$/.test(answer) && Number(answer) === Number(exercise.answer);
}

/** The whole number tried on the keypad, or null: what a hint can read of a mistake. */
export function triedNumber(tried?: Tried): number | null {
  return tried && /^\d{1,6}$/.test(tried.answer) ? Number(tried.answer) : null;
}

/** One of the offered choices. */
export function validateChoice(exercise: Exercise, answer: string): boolean {
  return answer === exercise.answer;
}
