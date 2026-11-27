import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { parseFraction } from '../../core/validate';
import {
  ADD_LEVELS,
  addFractionsHint,
  generateAddFractions,
  type AddFractionsExercise,
} from './add';
import {
  COMPARE_LEVELS,
  compareFractionsHint,
  generateCompareFractions,
  type CompareFractionsExercise,
} from './compare';
import {
  EQUAL,
  EQUAL_LEVELS,
  equalHint,
  equalLuresOf,
  generateEqual,
  type EqualExercise,
} from './equal';
import { READ, READ_LEVELS, generateRead, type ReadExercise } from './generators';
import { readHint } from './hints';
import { add, read } from './skills';
import { fractionWords } from './words';

const SEEDS = 1000;
const tried = (answer: string) => ({ answer });

describe('lire, écrire et colorier des fractions (#61)', () => {
  it('reads fractions as at school', () => {
    expect(fractionWords(6, 9)).toBe('six neuvièmes');
    expect(fractionWords(1, 2)).toBe('un demi');
    expect(fractionWords(2, 3)).toBe('deux tiers');
    expect(fractionWords(1, 4)).toBe('un quart');
    expect(fractionWords(5, 12)).toBe('cinq douzièmes');
  });

  it('keeps each level within its fractions, up to twelfths and never above 1', () => {
    for (let level = 0; level < READ_LEVELS; level++) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const e = generateRead(new Rng(seed), level);
        const { numerator: n, denominator: d } = e;
        expect(e.skill).toBe(READ);
        expect(d).toBeGreaterThanOrEqual(2);
        expect(d).toBeLessThanOrEqual(12);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(d);
        if (level === 0) expect([n, d <= 4]).toEqual([1, true]);
        if (level === 1) expect(n >= 2 && n < d && d <= 6).toBe(true);
        if (level === 2) expect(d >= 5 && n < d).toBe(true);
        if (level < 3) expect(n).toBeLessThan(d);
        if (e.form === 'write') {
          expect(e.input.kind).toBe('fraction');
          expect(parseFraction(e.answer)).toEqual([n, d]);
          expect(e.figure).toEqual({
            kind: 'fraction',
            wholes: [expect.objectContaining({ parts: d, coloured: n })],
          });
        }
        if (e.form === 'colour') {
          expect(e.input).toEqual(expect.objectContaining({ kind: 'parts', parts: d }));
          expect(e.answer).toBe(String(n));
        }
        if (e.form === 'words') {
          expect(e.answer).toBe(fractionWords(n, d));
          if (e.input.kind !== 'choice') throw new Error('choix attendu');
          expect(new Set(e.input.options).size).toBe(4);
        }
      }
    }
  });

  it('the last level shows the whole now and then: 5/5', () => {
    const wholes = Array.from({ length: SEEDS }, (_, seed) =>
      generateRead(new Rng(seed), 3),
    ).filter((e) => e.numerator === e.denominator);
    expect(wholes.length).toBeGreaterThan(SEEDS / 10);
  });

  it('accepts the fraction written, not an equal one', () => {
    const e = {
      ...generateRead(new Rng(1), 2),
      answer: '6/9',
      input: { kind: 'fraction' },
    } as const;
    expect(read.validate(e, '6/9')).toBe(true);
    expect(read.validate(e, '06/09')).toBe(true);
    expect(read.validate(e, '2/3')).toBe(false);
    expect(read.validate(e, '9/6')).toBe(false);
  });

  const write = (n: number, d: number): ReadExercise => ({
    ...generateRead(new Rng(1), 2),
    form: 'write',
    numerator: n,
    denominator: d,
    input: { kind: 'fraction' },
    answer: `${n}/${d}`,
  });

  it('names the numbers the other way round and the parts counted wrong', () => {
    const e = write(6, 9);
    expect(readHint(e, 1, tried('9/6'))).toBe(
      'Le nombre du haut compte les parts coloriées.\nCelui du bas compte toutes les parts.',
    );
    expect(readHint(e, 1, tried('6/3'))).toBe(
      'En bas, compte toutes les parts.\nAussi celles qui ne sont pas coloriées.',
    );
    expect(readHint(e, 1, tried('3/9'))).toBe(
      'Tu as compté les parts qui ne sont pas coloriées.\nEn haut, compte les parts coloriées.',
    );
    expect(readHint(e, 1, tried('5/9'))).toBe(readHint(e, 1));
    expect(readHint(e, 2)).toBe('6 parts coloriées sur 9 en tout :\nc’est 6/9.');
  });

  it('names the parts coloured, and the words read the other way round', () => {
    const colour: ReadExercise = {
      ...write(3, 4),
      form: 'colour',
      input: { kind: 'parts', shape: 'disc', parts: 4 },
      answer: '3',
    };
    expect(readHint(colour, 1, tried('1'))).toBe(
      'Tu as colorié 1 part : c’est 1/4.\nLe nombre du haut dit combien en colorier.',
    );
    const words: ReadExercise = {
      ...write(6, 9),
      form: 'words',
      input: { kind: 'choice', options: [] },
      answer: 'six neuvièmes',
    };
    expect(readHint(words, 1, tried('neuf sixièmes'))).toBe(
      'Tu as lu le nombre du bas en premier.\nOn lit d’abord le nombre du haut.',
    );
    expect(readHint(words, 1, tried('six huitièmes'))).toBe(
      'En bas, il y a 9 : ce sont des neuvièmes.',
    );
    expect(readHint(words, 2)).toBe('6/9 se lit «\u00a0six neuvièmes\u00a0».');
  });
});

describe('les fractions égales (#169)', () => {
  const value = ([n, d]: readonly [number, number]) => n / d;

  it('keeps each level exact, up to twelfths, the strips drawn first', () => {
    for (let level = 0; level < EQUAL_LEVELS; level++) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const e = generateEqual(new Rng(seed), level);
        const { given, asked, factor } = e;
        expect(e.skill).toBe(EQUAL);
        expect(given[0] * asked[1]).toBe(asked[0] * given[1]);
        for (const [n, d] of [given, asked]) {
          expect(n >= 1 && n < d && d <= 12).toBe(true);
        }
        expect(Math.max(given[1], asked[1])).toBe(Math.min(given[1], asked[1]) * factor);
        if (level === 0) expect(factor).toBe(2);
        if (level < 3) {
          expect(e.statement).toBe(`${given[0]}/${given[1]} = ?/${asked[1]}`);
          expect(e.answer).toBe(String(asked[0]));
          expect(e.figure !== undefined).toBe(level < 2);
        } else {
          if (e.input.kind !== 'choice') throw new Error('choix attendu');
          const equalOnes = e.input.options.filter((option) => {
            const [n, d] = option.split('/').map(Number);
            return n * given[1] === given[0] * d;
          });
          expect(equalOnes).toEqual([e.answer]);
          expect(new Set(e.input.options).size).toBe(4);
          expect(value(given)).toBe(value(asked));
        }
      }
    }
  });

  const missing = (given: [number, number], asked: [number, number]): EqualExercise => ({
    ...generateEqual(new Rng(1), 1),
    form: 'missing',
    given,
    asked,
    factor: Math.max(given[1], asked[1]) / Math.min(given[1], asked[1]),
    statement: `${given[0]}/${given[1]} = ?/${asked[1]}`,
    input: { kind: 'keypad', maxDigits: 2, inline: true },
    answer: String(asked[0]),
  });

  it('names the same number added or taken on top and below, and the numerator kept', () => {
    const up = missing([1, 2], [4, 8]);
    expect(equalHint(up, 1)).toBe(
      'Des parts quatre fois plus petites : quatre fois plus de parts.',
    );
    expect(equalHint(up, 1, tried('7'))).toBe(
      'Ajouter 6 en haut et en bas change la fraction.\nDes parts quatre fois plus petites : quatre fois plus de parts.',
    );
    expect(equalHint(up, 1, tried('1'))).toContain(
      'Les parts changent de taille : le haut change aussi.',
    );
    expect(equalHint(up, 2)).toBe('1 × 4 = 4 et 2 × 4 = 8.\nDonc 1/2 = 4/8.');
    const down = missing([6, 8], [3, 4]);
    expect(equalHint(down, 1, tried('2'))).toBe(
      'Enlever 4 en haut et en bas change la fraction.\nDes parts deux fois plus grandes : deux fois moins de parts.',
    );
    expect(equalHint(down, 2)).toBe('3 × 2 = 6 et 4 × 2 = 8.\nDonc 6/8 = 3/4.');
    expect(equalLuresOf(down)).toContain(2);
  });
});

describe('comparer des fractions (#62)', () => {
  it('keeps each level to its kind, under 1, the sign exact', () => {
    for (let level = 0; level < COMPARE_LEVELS; level++) {
      const equals = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        const e = generateCompareFractions(new Rng(seed), level);
        const { kind, left, right } = e;
        for (const [n, d] of [left, right]) expect(n >= 1 && n < d && d <= 12).toBe(true);
        const [x, y] = [left[0] * right[1], right[0] * left[1]];
        expect(e.answer).toBe(x < y ? '<' : x > y ? '>' : '=');
        if (e.answer === '=') equals.push(seed);
        if (level < 3) expect(kind).toBe(['denominator', 'numerator', 'multiple'][level]);
        if (kind === 'denominator') expect(left[1] === right[1] && left[0] !== right[0]).toBe(true);
        if (kind === 'numerator') expect(left[0] === right[0] && left[1] !== right[1]).toBe(true);
        if (kind === 'multiple') {
          const [small, big] = [Math.min(left[1], right[1]), Math.max(left[1], right[1])];
          expect(big % small === 0 && big > small).toBe(true);
        }
        expect(e.figure !== undefined).toBe(level < 3);
      }
      if (level === 2) expect(equals.length).toBeGreaterThan(SEEDS / 10);
    }
  });

  const compare = (
    kind: CompareFractionsExercise['kind'],
    left: [number, number],
    right: [number, number],
    answer: string,
  ): CompareFractionsExercise => ({
    ...generateCompareFractions(new Rng(1), 0),
    kind,
    left,
    right,
    answer,
  });

  it('names the denominators compared as numbers, the numerators alone, the sign reversed', () => {
    const thirds = compare('numerator', [1, 6], [1, 3], '<');
    expect(compareFractionsHint(thirds, 1, tried('>'))).toBe(
      '6 est plus grand que 3,\nmais les sixièmes sont plus petits.',
    );
    expect(compareFractionsHint(thirds, 2)).toBe(
      'Un tiers est plus grand qu’un sixième.\nDonc 1/6 < 1/3.',
    );
    const twelfths = compare('multiple', [7, 12], [5, 6], '<');
    expect(compareFractionsHint(twelfths, 1, tried('>'))).toBe(
      'Les parts n’ont pas la même taille.\nÉcris d’abord 5/6 en douzièmes.',
    );
    expect(compareFractionsHint(twelfths, 2)).toBe('5/6 = 10/12.\nDonc 7/12 < 5/6.');
    const same = compare('denominator', [5, 12], [7, 12], '<');
    expect(compareFractionsHint(same, 1, tried('>'))).toBe(
      'Le signe est à l’envers.\nLa pointe montre la plus petite fraction.',
    );
    expect(compareFractionsHint(same, 1, tried('='))).toBe(compareFractionsHint(same, 1));
  });
});

describe('additionner et soustraire des fractions (#170)', () => {
  it('keeps every result exact, up to 1, the parts drawn before the last level', () => {
    for (let level = 0; level < ADD_LEVELS; level++) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const e = generateAddFractions(new Rng(seed), level);
        const { kind, operator, first, second, result } = e;
        const big = Math.max(first[1], second[1]);
        const sign = operator === '+' ? 1 : -1;
        expect(result[1]).toBe(big);
        expect(result[0]).toBe((first[0] * big) / first[1] + (sign * second[0] * big) / second[1]);
        expect(result[0] >= 1 && result[0] <= result[1] && result[1] <= 12).toBe(true);
        for (const [n, d] of [first, second]) expect(n >= 1 && n <= d).toBe(true);
        if (kind !== 'multiple') expect(first[1]).toBe(second[1]);
        else expect(big % Math.min(first[1], second[1])).toBe(0);
        if (kind === 'complete') {
          expect(result).toEqual([big, big]);
          expect(e.answer).toBe(`${second[0]}/${second[1]}`);
        } else expect(e.answer).toBe(`${result[0]}/${result[1]}`);
        if (level === 0) expect(kind).toBe('add');
        if (level === 3) expect(e.figure).toBeUndefined();
        if (level === 0) expect(e.figure).toBeDefined();
      }
    }
  });

  const exercise = (
    kind: AddFractionsExercise['kind'],
    operator: '+' | '−',
    first: [number, number],
    second: [number, number],
    result: [number, number],
  ): AddFractionsExercise => ({
    ...generateAddFractions(new Rng(1), 0),
    kind,
    operator,
    first,
    second,
    result,
    statement: `${first.join('/')} ${operator} ${second.join('/')} = ?`,
    answer: result.join('/'),
  });

  it('accepts an equal fraction, says the calculation in words', () => {
    const e = exercise('add', '+', [1, 4], [1, 4], [2, 4]);
    expect(add.validate(e, '2/4')).toBe(true);
    expect(add.validate(e, '1/2')).toBe(true);
    expect(add.validate(e, '2/8')).toBe(false);
    const fifths = exercise('add', '+', [1, 5], [2, 5], [3, 5]);
    expect(addFractionsHint(fifths, 2)).toBe(
      'Un cinquième plus deux cinquièmes,\ncela fait trois cinquièmes.',
    );
  });

  it('names the denominators added and the parts not alike', () => {
    const fifths = exercise('add', '+', [2, 5], [1, 5], [3, 5]);
    expect(addFractionsHint(fifths, 1, tried('3/10'))).toBe(
      'Le nombre du bas ne change pas :\nles parts gardent leur taille.',
    );
    const quarters = exercise('multiple', '+', [1, 2], [1, 4], [3, 4]);
    expect(addFractionsHint(quarters, 1, tried('2/4'))).toBe(
      'Les parts n’ont pas la même taille.\nÉcris d’abord 1/2 en quarts.',
    );
    expect(addFractionsHint(quarters, 2)).toBe('1/2 = 2/4.\nDonc 1/2 + 1/4 = 3/4.');
  });
});
