import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';
import {
  ADD,
  ADD_LEVELS,
  COMPLEMENTS,
  COMPLEMENTS_LEVELS,
  DOUBLES_HALVES,
  DOUBLES_HALVES_LEVELS,
  NINE_ELEVEN,
  NINE_ELEVEN_LEVELS,
  SUBTRACT,
  SUBTRACT_LEVELS,
  SUMS,
  SUMS_LEVELS,
  TIMES_TEN,
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
import { mentalMath } from './index';

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

describe('indices après une erreur (#168)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });
  const operation = (a: number, op: '+' | '−', b: number) =>
    ({ ...generateAdd(new Rng(1), 0), a, op, b }) as OperationExercise;

  it('simple additions: one off, or the ten forgotten', () => {
    const sum = operation(8, '+', 5);
    expect(sumHint(sum, 1, tried(12))).toBe(
      'Tu es à 1 du bon nombre.\nPars de 8, va jusqu’à 10, puis ajoute le reste.',
    );
    expect(sumHint(sum, 1, tried(3))).toBe(
      'Tu as écrit les unités, pas la dizaine.\n8 + 5, c’est plus que 10.',
    );
    expect(sumHint(sum, 2, tried(3))).toBe(sumHint(sum, 2));
  });

  it('add and subtract: the units right, the tens not', () => {
    expect(addSubtractHint(operation(38, '+', 27), 1, tried(55))).toBe(
      'Les unités sont bonnes.\n8 + 7 = 15 : garde la dizaine en plus !',
    );
    expect(addSubtractHint(operation(52, '−', 27), 1, tried(35))).toBe(
      'Les unités sont bonnes.\nTu as défait une dizaine : il en reste une de moins.',
    );
    expect(addSubtractHint(operation(34, '+', 25), 1, tried(69))).toBe(
      'Les unités sont bonnes.\nRecompte les dizaines.',
    );
  });

  it('subtract: the units upside down', () => {
    expect(addSubtractHint(operation(52, '−', 24), 1, tried(32))).toBe(
      'Tu as fait 4 − 2, à l’envers.\nEnlève d’abord 20, puis encore 4.',
    );
    expect(addSubtractHint(operation(32, '−', 5), 1, tried(33))).toBe(
      'Tu as fait 5 − 2, à l’envers.\nDescends d’abord jusqu’à 30, puis enlève le reste.',
    );
  });

  it('9 and 11: the correction forgotten, or 9 and 11 swapped', () => {
    expect(nineElevenHint(operation(34, '+', 9), 1, tried(44))).toBe(
      'Tu as ajouté 10, c’est 1 de trop.\nEnlève encore 1.',
    );
    expect(nineElevenHint(operation(34, '+', 11), 1, tried(44))).toBe(
      'Tu as ajouté 10.\nAjoute encore 1.',
    );
    expect(nineElevenHint(operation(34, '−', 9), 1, tried(24))).toBe(
      'Tu as enlevé 10, c’est 1 de trop.\nRemets 1.',
    );
    expect(nineElevenHint(operation(34, '−', 11), 1, tried(24))).toBe(
      'Tu as enlevé 10.\nEnlève encore 1.',
    );
    expect(nineElevenHint(operation(34, '+', 9), 1, tried(45))).toBe(
      'Ça, c’est 34 + 11.\nAjouter 9, c’est ajouter 10 puis enlever 1.',
    );
  });

  it('complements: one or one ten off, checked', () => {
    const complement = (level: number, given: number) => ({
      ...generateComplement(new Rng(1), level),
      given,
    });
    expect(complementHint(complement(0, 3), 1, tried(6))).toBe(
      '3 + 6 = 9, pas 10.\nCompte de 3 jusqu’à 10.',
    );
    expect(complementHint(complement(2, 37), 1, tried(73))).toBe(
      '37 + 73 = 110, pas 100.\nVa d’abord jusqu’à 40, puis jusqu’à 100.',
    );
  });

  it('doubles and halves: copied, the ten forgotten, the tens, the double, checked', () => {
    const doubleHalf = (kind: 'double' | 'half', value: number) =>
      ({ ...generateDoubleHalf(new Rng(1), 0), kind, value }) as DoubleHalfExercise;
    expect(doubleHalfHint(doubleHalf('double', 7), 1, tried(7))).toBe(
      'Tu as recopié 7.\nLe double, c’est 7 + 7.',
    );
    expect(doubleHalfHint(doubleHalf('double', 7), 1, tried(4))).toBe(
      'Tu as écrit les unités, pas la dizaine.\n7 + 7, c’est plus que 10.',
    );
    expect(doubleHalfHint(doubleHalf('double', 23), 1, tried(56))).toBe(
      'Les unités sont bonnes.\nRecompte le double de 20.',
    );
    expect(doubleHalfHint(doubleHalf('half', 14), 1, tried(28))).toBe(
      'Ça, c’est le double de 14.\nLa moitié est plus petite que 14.',
    );
    expect(doubleHalfHint(doubleHalf('half', 46), 1, tried(28))).toBe(
      '28 + 28 = 56, pas 46.\nPartage les dizaines, puis les unités.',
    );
  });

  it('times 10 and 100: the other rank, a thousand, or a sum', () => {
    const exercise = (factor: 10 | 100, factorFirst = false) => ({
      ...generateTimesTen(new Rng(1), 1),
      value: 34,
      factor,
      factorFirst,
    });
    expect(timesTenHint(exercise(10), 1, tried(3400))).toBe(
      'Ça, c’est 34 × 100 : 34 centaines.\n× 10 : chaque unité devient une dizaine.',
    );
    expect(timesTenHint(exercise(100, true), 1, tried(340))).toBe(
      'Ça, c’est 10 × 34 : 34 dizaines.\n× 100 : chaque unité devient une centaine.',
    );
    expect(timesTenHint(exercise(100), 1, tried(34000))).toBe(
      'Ça, c’est 34 × 1\u202f000.\n× 100 : chaque unité devient une centaine.',
    );
    expect(timesTenHint(exercise(10), 1, tried(44))).toBe(
      '34 + 10 = 44 : c’est une addition.\n× 10 : chaque unité devient une dizaine.',
    );
  });

  it('keeps the method hint for a mistake it does not know', () => {
    const sum = operation(8, '+', 5);
    expect(sumHint(sum, 1, tried(17))).toBe(sumHint(sum, 1));
    expect(sumHint(sum, 1, { answer: '' })).toBe(sumHint(sum, 1));
    expect(addSubtractHint(operation(38, '+', 27), 1, tried(61))).toBe(
      addSubtractHint(operation(38, '+', 27), 1),
    );
  });

  const notions: [string, (rng: Rng, level: number) => Exercise, number][] = [
    [SUMS, generateSum, SUMS_LEVELS],
    [ADD, generateAdd, ADD_LEVELS],
    [SUBTRACT, generateSubtract, SUBTRACT_LEVELS],
    [NINE_ELEVEN, generateNineEleven, NINE_ELEVEN_LEVELS],
    [COMPLEMENTS, generateComplement, COMPLEMENTS_LEVELS],
    [DOUBLES_HALVES, generateDoubleHalf, DOUBLES_HALVES_LEVELS],
    [TIMES_TEN, generateTimesTen, TIMES_TEN_LEVELS],
  ];
  it.each(notions)(
    '%s: every lure is a recognised mistake, on 1 000 seeds',
    (id, generate, levels) => {
      const skill = mentalMath.skills.find((s) => s.id === id)!;
      for (let level = 0; level < levels; level++) {
        for (let seed = 0; seed < 1000; seed++) {
          const exercise = generate(new Rng(seed), level);
          for (const lure of skill.lures!(exercise)) {
            if (lure < 0 || String(lure) === exercise.answer) continue;
            // 7 + 7 = 14 typed 24: no text for the units right below 10.
            const { kind, value } = exercise as DoubleHalfExercise;
            if (kind === 'double' && value <= 10 && lure !== value && lure !== 2 * value - 10)
              continue;
            if (kind === 'double' && value <= 5 && lure === 2 * value - 10) continue;
            const hint = skill.hint(exercise, 1, tried(lure));
            expect(hint, `${exercise.statement} → ${lure}`).not.toBe(skill.hint(exercise, 1));
          }
        }
      }
    },
  );
});
