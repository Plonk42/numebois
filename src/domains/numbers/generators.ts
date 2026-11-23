import type { Exercise } from '../../core/types';
import type { Rng } from '../../core/rng';
import { numberWords } from './words';

export const WRITE_DIGITS = 'numbers.write-digits';

export interface WriteDigitsExercise extends Exercise {
  value: number;
}

/**
 * Levels of « écrire en chiffres »:
 * 0. three digits;
 * 1. four digits, no zero;
 * 2. four digits with an empty rank (zero among the hundreds, tens or units);
 * 3. four digits ending in 70 to 99 (« soixante-dix », « quatre-vingt… »), or 10 000.
 */
export const WRITE_DIGITS_LEVELS = 4;

function drawValue(rng: Rng, level: number): number {
  switch (level) {
    case 0:
      return rng.int(100, 999);
    case 1:
      return rng.int(1, 9) * 1000 + rng.int(1, 9) * 100 + rng.int(1, 9) * 10 + rng.int(1, 9);
    case 2:
      for (;;) {
        const value = rng.int(1000, 9999);
        if (hasEmptyRank(value)) return value;
      }
    case 3:
      if (rng.chance(0.1)) return 10_000;
      return rng.int(1, 9) * 1000 + rng.int(0, 9) * 100 + rng.int(70, 99);
    default:
      throw new RangeError(`niveau ${level}`);
  }
}

/** A zero among the hundreds, tens or units. */
export function hasEmptyRank(value: number): boolean {
  return String(value).slice(1).includes('0');
}

export function generateWriteDigits(rng: Rng, level: number): WriteDigitsExercise {
  const value = drawValue(rng, level);
  return {
    skill: WRITE_DIGITS,
    level,
    instruction: 'Écris ce nombre en chiffres.',
    statement: numberWords(value),
    input: { kind: 'keypad', maxDigits: 5 },
    answer: String(value),
    value,
  };
}
