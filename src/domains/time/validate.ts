import { parseTime } from '../../core/time';
import type { Exercise } from '../../core/types';
import { validateChoice, validateNumber } from '../../core/validate';
import type { ReadClockExercise, SetClockExercise } from './generators';

/** A number on the keypad, a choice, or a time in its boxes: the same hours and minutes. */
export function validateAny(exercise: Exercise, answer: string): boolean {
  if (exercise.input.kind === 'keypad') return validateNumber(exercise, answer);
  if (exercise.input.kind !== 'time') return validateChoice(exercise, answer);
  const time = parseTime(answer);
  const expected = parseTime(exercise.answer)!;
  return (
    time !== null &&
    time.hours === expected.hours &&
    time.minutes === expected.minutes &&
    time.seconds === expected.seconds
  );
}

/**
 * The time read on the clock: without a period said, 3h45 or 15h45 alike; with one, the
 * hours of the day (14h10 in the afternoon).
 */
export function validateReading(exercise: ReadClockExercise, answer: string): boolean {
  const time = parseTime(answer);
  if (!time || time.minutes !== exercise.minutes || time.seconds !== exercise.seconds) {
    return false;
  }
  if (exercise.period) return time.hours === exercise.hours;
  return time.hours <= 23 && time.hours % 12 === exercise.hours % 12;
}

/** The hands on the written time: 14h10 is 2h10 on the clock. */
export function validateSetting(exercise: SetClockExercise, answer: string): boolean {
  const time = parseTime(answer);
  return (
    time !== null &&
    time.seconds === undefined &&
    time.hours >= 1 &&
    time.hours <= 12 &&
    time.hours % 12 === exercise.hours % 12 &&
    time.minutes === exercise.minutes
  );
}
