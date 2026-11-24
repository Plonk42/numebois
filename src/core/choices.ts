import type { Rng } from './rng';
import type { Exercise, Skill } from './types';

/** About one question of the trail typed on the keypad is offered among choices instead. */
export const CHOICE_SHARE = 1 / 3;
/** The answer and three lures. */
export const OFFERED_CHOICES = 4;

/**
 * Common slips around a number, with as many digits: one, ten or a hundred off, two
 * neighbour digits swapped; then a rank too far.
 */
export function nearNumbers(value: number): number[] {
  const digits = [...String(value)];
  const swaps = digits.slice(1).map((digit, i) => {
    const swapped = [...digits];
    [swapped[i], swapped[i + 1]] = [digit, digits[i]];
    return Number(swapped.join(''));
  });
  const slips = [value + 1, value - 1, value + 10, value - 10, value + 100, value - 100, ...swaps];
  return [...slips.filter((n) => String(n).length === digits.length), value * 10, value / 10];
}

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The same question with the answer to choose among `OFFERED_CHOICES` instead of typing it:
 * the typical mistakes of the notion first (`Skill.lures`), then the common slips. Only for a
 * keypad question; any other one is returned as it is.
 */
export function offerChoices<E extends Exercise>(skill: Skill<E>, exercise: E, rng: Rng): E {
  const { input } = exercise;
  if (input.kind !== 'keypad') return exercise;
  const answer = Number(exercise.answer);
  const fits = (n: number) =>
    Number.isInteger(n) && n >= 0 && n !== answer && String(n).length <= input.maxDigits;
  const lures = new Set<number>();
  const typical = shuffled(rng, skill.lures?.(exercise) ?? []);
  for (const n of [...typical, ...shuffled(rng, nearNumbers(answer))]) {
    if (lures.size < OFFERED_CHOICES - 1 && fits(n)) lures.add(n);
  }
  for (let n = answer + 2; lures.size < OFFERED_CHOICES - 1; n++) if (fits(n)) lures.add(n);
  const options = shuffled(rng, [answer, ...lures]).map(String);
  return { ...exercise, answer: String(answer), input: { kind: 'choice', options } };
}
