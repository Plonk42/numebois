import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { productFact, productFacts } from './facts';
import {
  MAX_FACTOR,
  MIN_FACTOR,
  TABLES_BY_LEVEL,
  TABLES_LEVELS,
  generateMissingFactor,
  generateProduct,
  type MissingFactorExercise,
  type ProductExercise,
} from './generators';
import { missingFactorHint, productHint } from './hints';
import { missingFactorLures, productLures } from './lures';

const SEEDS = 1000;
const inRange = (n: number) => Number.isInteger(n) && n >= MIN_FACTOR && n <= MAX_FACTOR;
const levels = Array.from({ length: TABLES_LEVELS }, (_, level) => level);

describe('les tables', () => {
  it.each(levels)('level %i: 1 000 seeds on the tables of the level, in both orders', (level) => {
    const tables = TABLES_BY_LEVEL[level];
    const statements = new Set<string>();
    let largerFirst = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateProduct(new Rng(seed), level);
      const { a, b } = exercise;
      expect(inRange(a) && inRange(b), exercise.statement).toBe(true);
      expect(tables.includes(a) || tables.includes(b), exercise.statement).toBe(true);
      expect(exercise.answer).toBe(String(a * b));
      expect(exercise.statement).toBe(`${a}\u00a0×\u00a0${b}`);
      expect(productFacts.all).toContain(productFacts.of(exercise));
      if (a > b) largerFirst++;
      statements.add(exercise.statement);
    }
    expect(statements.size).toBeGreaterThan(8);
    expect(largerFirst).toBeGreaterThan(SEEDS / 4);
    expect(largerFirst).toBeLessThan(SEEDS / 2);
  });

  it('refuses an unknown level and is reproducible', () => {
    expect(() => generateProduct(new Rng(1), TABLES_LEVELS)).toThrow(RangeError);
    expect(generateProduct(new Rng(42), 4)).toEqual(generateProduct(new Rng(42), 4));
  });

  it('declares one fact per product, 3 × 7 and 7 × 3 alike, all of them drawn', () => {
    expect(productFacts.all).toHaveLength(45);
    expect(productFact(7, 3)).toBe('times-tables.products:3x7');
    expect(productFact(3, 7)).toBe(productFact(7, 3));
    const drawn = new Set<string | null>();
    for (const level of levels) {
      for (let seed = 0; seed < SEEDS; seed++) {
        drawn.add(productFacts.of(generateProduct(new Rng(seed), level)));
      }
    }
    expect([...drawn].sort()).toEqual([...productFacts.all].sort());
  });
});

describe('le nombre qui manque', () => {
  it.each(levels)('level %i: 1 000 seeds, the table shown and the other factor asked', (level) => {
    const tables = TABLES_BY_LEVEL[level];
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateMissingFactor(new Rng(seed), level);
      const { a, b, hidden } = exercise;
      const shown = hidden === 'a' ? b : a;
      expect(inRange(a) && inRange(b), exercise.statement).toBe(true);
      expect(tables.includes(shown), exercise.statement).toBe(true);
      expect(exercise.answer).toBe(String(hidden === 'a' ? a : b));
      expect(exercise.statement.split('\u00a0')).toEqual(
        hidden === 'a'
          ? ['?', '×', String(b), '=', String(a * b)]
          : [String(a), '×', '?', '=', String(a * b)],
      );
    }
  });
});

describe('indices', () => {
  const product = (a: number, b: number) =>
    ({ ...generateProduct(new Rng(1), 0), a, b }) as ProductExercise;
  const hints = (a: number, b: number) => [
    productHint(product(a, b), 1),
    productHint(product(a, b), 2),
  ];

  it('start from the easiest table, in the order of the statement', () => {
    expect(hints(7, 10)).toEqual([
      '7 × 10 : chaque unité devient une dizaine.',
      '7 × 10 = 70 : 7 dizaines.',
    ]);
    expect(hints(2, 8)).toEqual(['2 × 8, c’est le double de 8.', '8 + 8 = 16.']);
    expect(hints(5, 7)).toEqual([
      '5 × 7, c’est la moitié de 10 × 7.',
      '10 × 7 = 70, et la moitié de 70 est 35.',
    ]);
    expect(hints(9, 4)).toEqual([
      '9 × 4, c’est 10 × 4, moins 4.',
      '10 × 4 = 40, puis 40 − 4 = 36.',
    ]);
    expect(hints(6, 4)).toEqual([
      '6 × 4, c’est le double du double de 6.',
      '6 + 6 = 12, puis 12 + 12 = 24.',
    ]);
    expect(hints(7, 3)).toEqual([
      '7 × 3, c’est le double de 7, plus 7.',
      '7 + 7 = 14, puis 14 + 7 = 21.',
    ]);
    expect(hints(7, 6)).toEqual(['7 × 6, c’est 7 × 5, plus 7.', '7 × 5 = 35, puis 35 + 7 = 42.']);
    expect(hints(8, 7)).toEqual([
      '8 × 7, c’est le double de 4 × 7.',
      '4 × 7 = 28, puis 28 + 28 = 56.',
    ]);
    expect(hints(7, 7)).toEqual([
      '7 × 7, c’est 5 × 7, plus 2 × 7.',
      '5 × 7 = 35 et 2 × 7 = 14.\n35 + 14 = 49.',
    ]);
  });

  it('missing factor: recite the shown table', () => {
    const exercise = {
      ...generateMissingFactor(new Rng(1), 3),
      a: 8,
      b: 7,
      hidden: 'b',
    } as MissingFactorExercise;
    expect(missingFactorHint(exercise, 1)).toBe('Récite la table de 8 jusqu’à 56.');
    expect(missingFactorHint(exercise, 2)).toBe('8 × 7 = 56, donc il manque 7.');
  });
});

describe('indices après une erreur (#168)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });
  const product = (a: number, b: number) =>
    ({ ...generateProduct(new Rng(1), 0), a, b }) as ProductExercise;
  const missing = (a: number, b: number, hidden: 'a' | 'b') =>
    ({ ...generateMissingFactor(new Rng(1), 3), a, b, hidden }) as MissingFactorExercise;

  it('a neighbouring product, in the same table first', () => {
    expect(productHint(product(7, 8), 1, tried(48))).toBe(
      '48, c’est 6 × 8, juste à côté.\n7 × 8, c’est le double de 7 × 4.',
    );
    expect(productHint(product(7, 8), 1, tried(63))).toBe(
      '63, c’est 7 × 9, juste à côté.\n7 × 8, c’est le double de 7 × 4.',
    );
  });

  it('a sum instead of the product', () => {
    expect(productHint(product(7, 8), 1, tried(15))).toBe(
      '7 + 8 = 15 : c’est une addition.\n7 × 8, c’est le double de 7 × 4.',
    );
  });

  it('missing factor: a neighbour checked, the shown factor copied', () => {
    expect(missingFactorHint(missing(7, 8, 'b'), 1, tried(9))).toBe(
      '7 × 9 = 63, pas 56.\nRécite la table de 7 jusqu’à 56.',
    );
    expect(missingFactorHint(missing(8, 7, 'a'), 1, tried(7))).toBe(
      '7 × 7 = 49, pas 56.\nRécite la table de 7 jusqu’à 56.',
    );
    expect(missingFactorHint(missing(6, 9, 'b'), 1, tried(6))).toBe(
      'Tu as recopié le 6.\nRécite la table de 6 jusqu’à 54.',
    );
  });

  it('keeps the method hint for a mistake it does not know', () => {
    expect(productHint(product(7, 8), 1, tried(54))).toBe(productHint(product(7, 8), 1));
    expect(missingFactorHint(missing(7, 8, 'b'), 1, tried(4))).toBe(
      missingFactorHint(missing(7, 8, 'b'), 1),
    );
  });

  it.each(levels)('level %i: every lure is a recognised mistake, on 1 000 seeds', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateProduct(new Rng(seed), level);
      for (const lure of productLures(exercise)) {
        if (String(lure) === exercise.answer) continue;
        expect(productHint(exercise, 1, tried(lure)), `${exercise.statement} → ${lure}`).not.toBe(
          productHint(exercise, 1),
        );
      }
      const asked = generateMissingFactor(new Rng(seed), level);
      for (const lure of missingFactorLures(asked)) {
        if (String(lure) === asked.answer) continue;
        expect(missingFactorHint(asked, 1, tried(lure)), `${asked.statement} → ${lure}`).not.toBe(
          missingFactorHint(asked, 1),
        );
      }
    }
  });
});
