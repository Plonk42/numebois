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

/** The numerator and denominator of « a/b », or null. */
export function parseFraction(text: string): [number, number] | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (!match || Number(match[2]) === 0) return null;
  return [Number(match[1]), Number(match[2])];
}

/** The fraction written in its boxes: the same numerator and denominator. */
export function validateFraction(exercise: Exercise, answer: string): boolean {
  const [tried, expected] = [parseFraction(answer), parseFraction(exercise.answer)];
  return (
    tried !== null && expected !== null && tried[0] === expected[0] && tried[1] === expected[1]
  );
}

/** A fraction equal to the expected one: 6/8 for 3/4. */
export function validateEqualFraction(exercise: Exercise, answer: string): boolean {
  const [tried, expected] = [parseFraction(answer), parseFraction(exercise.answer)];
  return tried !== null && expected !== null && tried[0] * expected[1] === expected[0] * tried[1];
}

/** The fraction tried in its boxes, or null. */
export function triedFraction(tried?: Tried): [number, number] | null {
  return tried ? parseFraction(tried.answer) : null;
}
