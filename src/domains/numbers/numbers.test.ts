import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import {
  WRITE_DIGITS_LEVELS,
  generateWriteDigits,
  hasEmptyRank,
  type WriteDigitsExercise,
} from './generators';
import { writeDigitsHint } from './hints';
import { validateNumber } from '../../core/validate';
import { formatNumber, numberWords } from './words';

describe('numberWords', () => {
  it.each([
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt-et-un'],
    [22, 'vingt-deux'],
    [60, 'soixante'],
    [70, 'soixante-dix'],
    [71, 'soixante-et-onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [90, 'quatre-vingt-dix'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [101, 'cent-un'],
    [200, 'deux-cents'],
    [201, 'deux-cent-un'],
    [280, 'deux-cent-quatre-vingts'],
    [1000, 'mille'],
    [1001, 'mille-un'],
    [1200, 'mille-deux-cents'],
    [2000, 'deux-mille'],
    [3240, 'trois-mille-deux-cent-quarante'],
    [7080, 'sept-mille-quatre-vingts'],
    [9999, 'neuf-mille-neuf-cent-quatre-vingt-dix-neuf'],
    [10_000, 'dix-mille'],
  ])('%i → %s', (n, words) => {
    expect(numberWords(n)).toBe(words);
  });

  it('gives a different spelling to each number up to 10 000, with school words only', () => {
    const seen = new Set<string>();
    const vocabulary = new Set<string>();
    for (let n = 1; n <= 10_000; n++) {
      const words = numberWords(n);
      seen.add(words);
      for (const word of words.split('-')) vocabulary.add(word);
    }
    expect(seen.size).toBe(10_000);
    expect([...vocabulary].sort()).toEqual(
      [
        ...['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
        ...['onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'],
        ...['vingt', 'vingts', 'trente', 'quarante', 'cinquante', 'soixante'],
        ...['cent', 'cents', 'mille', 'et'],
      ].sort(),
    );
  });

  it('refuses numbers outside 1 to 10 000', () => {
    expect(() => numberWords(0)).toThrow(RangeError);
    expect(() => numberWords(10_001)).toThrow(RangeError);
    expect(() => numberWords(2.5)).toThrow(RangeError);
  });

  it('groups the digits as at school', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(3240)).toBe('3\u202f240');
    expect(formatNumber(10_000)).toBe('10\u202f000');
  });
});

describe('écrire en chiffres', () => {
  const RULES: ((value: number) => boolean)[] = [
    (v) => v >= 100 && v <= 999,
    (v) => v >= 1000 && v <= 9999 && !String(v).includes('0'),
    (v) => v >= 1000 && v <= 9999 && hasEmptyRank(v),
    (v) => v === 10_000 || (v >= 1000 && v <= 9999 && v % 100 >= 70),
  ];

  it('declares one rule per level', () => {
    expect(RULES).toHaveLength(WRITE_DIGITS_LEVELS);
  });

  for (let level = 0; level < WRITE_DIGITS_LEVELS; level++) {
    it(`level ${level}: 1 000 seeds within the constraints`, () => {
      const values = new Set<number>();
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateWriteDigits(new Rng(seed), level);
        expect(RULES[level](exercise.value), `${exercise.value}`).toBe(true);
        expect(exercise.answer).toBe(String(exercise.value));
        expect(exercise.statement).toBe(numberWords(exercise.value));
        expect(validateNumber(exercise, exercise.answer)).toBe(true);
        values.add(exercise.value);
      }
      expect(values.size).toBeGreaterThan(500);
    });
  }

  it('is reproducible from its seed', () => {
    expect(generateWriteDigits(new Rng(42), 2)).toEqual(generateWriteDigits(new Rng(42), 2));
  });

  it('refuses an unknown level', () => {
    expect(() => generateWriteDigits(new Rng(1), WRITE_DIGITS_LEVELS)).toThrow(RangeError);
  });

  it('validates the number, not its writing', () => {
    const exercise = generateWriteDigits(new Rng(3), 1);
    expect(validateNumber(exercise, `0${exercise.answer}`)).toBe(true);
    expect(validateNumber(exercise, String(exercise.value + 1))).toBe(false);
    expect(validateNumber(exercise, '')).toBe(false);
    expect(validateNumber(exercise, `${exercise.answer}.0`)).toBe(false);
  });

  it('hints at the method first, then shows the answer with its method', () => {
    const at = (value: number): WriteDigitsExercise => ({
      ...generateWriteDigits(new Rng(1), 1),
      value,
      answer: String(value),
    });
    expect(writeDigitsHint(at(3240), 1)).toBe(
      'trois-mille · deux-cent · quarante\nUn chiffre par rang. Un rang vide, c’est 0.',
    );
    expect(writeDigitsHint(at(3247), 1)).toBe(
      'trois-mille · deux-cent · quarante-sept\n' +
        'Un chiffre par rang : milliers, centaines, dizaines, unités.',
    );
    expect(writeDigitsHint(at(3240), 2)).toBe(
      'trois-mille · deux-cent · quarante\n' +
        '3 milliers, 2 centaines, 4 dizaines, 0 unité : 3\u202f240.',
    );
    expect(writeDigitsHint(at(512), 2)).toBe(
      'cinq-cent · douze\n5 centaines, 1 dizaine, 2 unités : 512.',
    );
  });
});
