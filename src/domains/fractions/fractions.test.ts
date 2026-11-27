import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { parseFraction } from '../../core/validate';
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
import { read } from './skills';
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
