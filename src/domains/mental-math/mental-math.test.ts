import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';
import {
  ADD_LEVELS,
  COMPLEMENTS_LEVELS,
  DOUBLES_HALVES_LEVELS,
  NINE_ELEVEN_LEVELS,
  SUBTRACT_LEVELS,
  SUMS_LEVELS,
  TIMES_TEN_LEVELS,
  generateAdd,
  generateComplement,
  generateDoubleHalf,
  generateNineEleven,
  generateSubtract,
  generateSum,
  generateTimesTen,
  type ComplementExercise,
  type DoubleHalfExercise,
  type OperationExercise,
  type TimesTenExercise,
} from './generators';
import {
  addSubtractHint,
  complementHint,
  doubleHalfHint,
  nineElevenHint,
  sumHint,
  timesTenHint,
} from './hints';

const tens = (n: number) => Math.floor(n / 10);
const units = (n: number) => n % 10;
const twoDigits = (n: number) => n >= 10 && n <= 99;

/** One rule per level, checked on 1 000 seeds. */
function checkLevels<E extends Exercise>(
  name: string,
  generate: (rng: Rng, level: number) => E,
  levels: number,
  rules: ((exercise: E) => boolean)[],
) {
  describe(name, () => {
    it('declares one rule per level and refuses an unknown level', () => {
      expect(rules).toHaveLength(levels);
      expect(() => generate(new Rng(1), levels)).toThrow(RangeError);
    });
    rules.forEach((rule, level) => {
      it(`level ${level}: 1 000 seeds within the constraints`, () => {
        const statements = new Set<string>();
        for (let seed = 0; seed < 1000; seed++) {
          const exercise = generate(new Rng(seed), level);
          expect(rule(exercise), exercise.statement).toBe(true);
          expect(Number(exercise.answer)).toBeGreaterThan(0);
          statements.add(exercise.statement);
        }
        expect(statements.size).toBeGreaterThan(8);
      });
    });
    it('is reproducible from its seed', () => {
      expect(generate(new Rng(42), levels - 1)).toEqual(generate(new Rng(42), levels - 1));
    });
  });
}

checkLevels<OperationExercise>('les additions simples', generateSum, SUMS_LEVELS, [
  ({ a, b }) => a >= 1 && b >= 1 && a + b <= 10,
  ({ a, b }) => a <= 9 && b <= 9 && a + b > 10,
  ({ a, b }) => a >= 1 && b >= 1 && a <= 9 && b <= 9,
]);

checkLevels<OperationExercise>('additionner de tête', generateAdd, ADD_LEVELS, [
  ({ a, b }) => twoDigits(a) && b <= 9 && units(a) + b <= 9,
  ({ a, b }) => twoDigits(a) && b <= 9 && units(a) + b >= 10 && a + b <= 99,
  ({ a, b }) => twoDigits(a) && units(a) > 0 && b % 10 === 0 && a + b <= 99,
  ({ a, b }) => twoDigits(a) && twoDigits(b) && units(b) > 0 && units(a) + units(b) <= 9,
  ({ a, b }) => twoDigits(a) && twoDigits(b) && units(a) + units(b) >= 10 && a + b <= 99,
]);

checkLevels<OperationExercise>('soustraire de tête', generateSubtract, SUBTRACT_LEVELS, [
  ({ a, b }) => twoDigits(a) && b >= 1 && b <= units(a),
  ({ a, b }) => twoDigits(a) && b <= 9 && b > units(a),
  ({ a, b }) => twoDigits(a) && units(a) > 0 && b % 10 === 0 && b < a && twoDigits(a - b),
  ({ a, b }) => twoDigits(b) && units(b) > 0 && units(b) <= units(a) && twoDigits(a - b),
  ({ a, b }) => twoDigits(b) && units(b) > units(a) && a - b >= 10,
]);

checkLevels<OperationExercise>(
  'ajouter ou enlever 9 et 11',
  generateNineEleven,
  NINE_ELEVEN_LEVELS,
  [
    ({ a, op, b }) => op === '+' && (b === 9 || b === 11) && twoDigits(a) && a + b <= 99,
    ({ a, op, b }) => op === '−' && (b === 9 || b === 11) && twoDigits(a) && a - b >= 10,
  ],
);

checkLevels<ComplementExercise>('compléments', generateComplement, COMPLEMENTS_LEVELS, [
  ({ given, target }) => target === 10 && given >= 1 && given <= 9,
  ({ given, target }) => target === 100 && given % 10 === 0 && given >= 10 && given <= 90,
  ({ given, target }) => target === 100 && units(given) > 0 && given >= 11 && given <= 89,
]);

checkLevels<DoubleHalfExercise>('doubles et moitiés', generateDoubleHalf, DOUBLES_HALVES_LEVELS, [
  ({ kind, value }) => kind === 'double' && value >= 1 && value <= 10,
  ({ kind, value }) => kind === 'half' && value % 2 === 0 && value >= 2 && value <= 20,
  ({ kind, value }) => kind === 'double' && value >= 11 && value <= 44 && units(value) <= 4,
  ({ kind, value }) =>
    kind === 'half' && twoDigits(value) && tens(value) % 2 === 0 && units(value) % 2 === 0,
]);

checkLevels<TimesTenExercise>('multiplier par 10 et par 100', generateTimesTen, TIMES_TEN_LEVELS, [
  ({ value, factorFirst, statement }) =>
    value >= 2 && value <= 99 && !factorFirst && statement.startsWith(String(value)),
  ({ value, factor, factorFirst, statement }) =>
    value >= 2 && value <= 99 && statement.startsWith(String(factorFirst ? factor : value)),
]);

describe('multiplier par 10 et par 100 : les cas mélangés', () => {
  it.each([
    [0, ['10:false', '100:false']],
    [1, ['10:false', '100:false', '10:true', '100:true']],
  ])('level %i mixes both factors (and both orders at level 1)', (level, cases) => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const exercise = generateTimesTen(new Rng(seed), level);
      expect(Number(exercise.answer)).toBe(exercise.value * exercise.factor);
      seen.add(`${exercise.factor}:${exercise.factorFirst}`);
    }
    expect([...seen].sort()).toEqual([...cases].sort());
  });
});

describe('indices', () => {
  const sum = (a: number, b: number) =>
    ({ ...generateSum(new Rng(1), 0), a, b }) as OperationExercise;

  it('simple additions: from the larger number, through 10, or a double', () => {
    expect(sumHint(sum(3, 5), 1)).toBe('Pars de 5 et avance de 3.');
    expect(sumHint(sum(3, 5), 2)).toBe('5 + 3 = 8.');
    expect(sumHint(sum(5, 8), 1)).toBe('Pars de 8, va jusqu’à 10, puis ajoute le reste.');
    expect(sumHint(sum(5, 8), 2)).toBe('8 + 2 = 10, puis 10 + 3 = 13.');
    expect(sumHint(sum(7, 7), 2)).toBe('Le double de 7, c’est 14.');
  });

  const operation = (a: number, op: '+' | '−', b: number) =>
    ({ ...generateAdd(new Rng(1), 0), a, op, b }) as OperationExercise;

  it('add and subtract: units, by the ten, tens, then tens and units', () => {
    expect(addSubtractHint(operation(34, '+', 5), 1)).toBe('Calcule les unités : 4 + 5.');
    expect(addSubtractHint(operation(34, '+', 5), 2)).toBe('4 + 5 = 9, donc 34 + 5 = 39.');
    expect(addSubtractHint(operation(38, '+', 5), 1)).toBe(
      'Va d’abord jusqu’à 40, puis ajoute le reste.',
    );
    expect(addSubtractHint(operation(38, '+', 5), 2)).toBe('38 + 2 = 40, puis 40 + 3 = 43.');
    expect(addSubtractHint(operation(32, '−', 5), 1)).toBe(
      'Descends d’abord jusqu’à 30, puis enlève le reste.',
    );
    expect(addSubtractHint(operation(32, '−', 5), 2)).toBe('32 − 2 = 30, puis 30 − 3 = 27.');
    expect(addSubtractHint(operation(57, '−', 20), 1)).toBe('Compte en dizaines : 5 − 2 dizaines.');
    expect(addSubtractHint(operation(57, '−', 20), 2)).toBe('50 − 20 = 30, donc 57 − 20 = 37.');
    expect(addSubtractHint(operation(38, '+', 27), 2)).toBe('38 + 20 = 58, puis 58 + 7 = 65.');
    expect(addSubtractHint(operation(52, '−', 27), 2)).toBe('52 − 20 = 32, puis 32 − 7 = 25.');
  });

  it('9 and 11: through 10', () => {
    expect(nineElevenHint(operation(34, '+', 9), 1)).toBe(
      'Ajouter 9, c’est ajouter 10 puis enlever 1.',
    );
    expect(nineElevenHint(operation(34, '+', 9), 2)).toBe('34 + 10 = 44, puis 44 − 1 = 43.');
    expect(nineElevenHint(operation(34, '−', 9), 2)).toBe('34 − 10 = 24, puis 24 + 1 = 25.');
    expect(nineElevenHint(operation(34, '−', 11), 2)).toBe('34 − 10 = 24, puis 24 − 1 = 23.');
  });

  it('complements: to 10, by tens, then by the next ten', () => {
    const complement = (level: number, given: number) => ({
      ...generateComplement(new Rng(1), level),
      given,
    });
    expect(complementHint(complement(0, 3), 2)).toBe('3 + 7 = 10.');
    expect(complementHint(complement(1, 30), 2)).toBe('3 + 7 = 10, donc 30 + 70 = 100.');
    expect(complementHint(complement(2, 37), 1)).toBe('Va d’abord jusqu’à 40, puis jusqu’à 100.');
    expect(complementHint(complement(2, 37), 2)).toBe(
      '37 + 3 = 40, puis 40 + 60 = 100.\n3 + 60 = 63.',
    );
  });

  it('doubles and halves: as a sum, or tens and units apart', () => {
    const doubleHalf = (kind: 'double' | 'half', value: number) =>
      ({ ...generateDoubleHalf(new Rng(1), 0), kind, value }) as DoubleHalfExercise;
    expect(doubleHalfHint(doubleHalf('double', 7), 2)).toBe('7 + 7 = 14.');
    expect(doubleHalfHint(doubleHalf('double', 23), 2)).toBe(
      'Double de 20 : 40. Double de 3 : 6.\n40 + 6 = 46.',
    );
    expect(doubleHalfHint(doubleHalf('half', 18), 2)).toBe(
      '9 + 9 = 18, donc la moitié de 18 est 9.',
    );
    expect(doubleHalfHint(doubleHalf('half', 86), 2)).toBe(
      'Moitié de 80 : 40. Moitié de 6 : 3.\n40 + 3 = 43.',
    );
  });

  it('times 10 and 100: units become tens or hundreds', () => {
    const exercise = (factor: 10 | 100, factorFirst: boolean) => ({
      ...generateTimesTen(new Rng(1), 1),
      value: 34,
      factor,
      factorFirst,
    });
    expect(timesTenHint(exercise(100, false), 1)).toBe(
      '× 100 : chaque unité devient une centaine.',
    );
    expect(timesTenHint(exercise(100, false), 2)).toBe('34 × 100 = 3\u202f400 : 34 centaines.');
    expect(timesTenHint(exercise(10, true), 1)).toBe(
      '10 × 34, c’est 34 × 10.\n× 10 : chaque unité devient une dizaine.',
    );
    expect(timesTenHint(exercise(10, true), 2)).toBe('10 × 34 = 340 : 34 dizaines.');
  });
});
