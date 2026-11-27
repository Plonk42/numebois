import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { BIOMES } from '../../scene/biomes';
import { BIOME_IDS, type BiomeId } from '../../scene/description';
import { FRACTION_TEMPLATES, fractionProblemHint, generateFractionProblem } from './fractions';
import { problemHint } from './hints';
import {
  ADD_SUBTRACT_TEMPLATES,
  MULTIPLY_TEMPLATES,
  apply,
  generateAddSubtract,
  generateMultiply,
  type ProblemExercise,
} from './problems';

const SEEDS = 1000;
const NOTIONS = [
  {
    name: 'ajouter ou enlever',
    generate: generateAddSubtract,
    levels: ADD_SUBTRACT_TEMPLATES,
    operations: [['+'], ['−'], ['+', '−'], ['+−', '−+']],
  },
  {
    name: 'multiplier',
    generate: generateMultiply,
    levels: MULTIPLY_TEMPLATES,
    operations: [['×'], ['×+', '×−']],
  },
];

/** Numbers of a statement, read as the child reads them. */
const numbersOf = (statement: string) => (statement.match(/\d+/g) ?? []).map(Number);

for (const { name, generate, levels, operations } of NOTIONS) {
  describe(name, () => {
    for (const biome of BIOME_IDS) {
      it.each(levels.map((templates, level) => [level, templates.length] as const))(
        `${biome}, level %i: %i models, exact, whole and positive answers on 1 000 seeds`,
        (level, models) => {
          const methods = new Set<string>();
          for (let seed = 0; seed < SEEDS; seed++) {
            const e: ProblemExercise = generate(new Rng(seed), level, {
              vocabulary: BIOMES[biome].vocabulary,
            });
            const shown = numbersOf(e.statement);
            let result = e.steps[0][0];
            for (const step of e.steps) {
              expect(step[0], e.statement).toBe(result);
              result = apply(step);
              expect(Number.isInteger(result) && result > 0, e.statement).toBe(true);
            }
            expect(e.answer).toBe(String(result));
            expect(result).toBeLessThanOrEqual(119);
            // Every number of the calculation is given by the statement, in the same order.
            const given = [e.steps[0][0], ...e.steps.map((step) => step[2])];
            expect(shown, e.statement).toEqual(given);
            expect(operations[level]).toContain(e.steps.map((step) => step[1]).join(''));
            methods.add(e.method.replace(/\d+/g, 'n'));
          }
          expect(methods.size).toBeGreaterThanOrEqual(Math.min(models, 2));
        },
      );
    }
    it('refuses an unknown level', () => {
      expect(() => generate(new Rng(1), levels.length, BIOMES.clearing)).toThrow(RangeError);
    });
  });
}

it('tells of the decor of the painting', () => {
  const statements = (biome: BiomeId) =>
    Array.from(
      { length: 200 },
      (_, seed) => generateAddSubtract(new Rng(seed), 0, BIOMES[biome]).statement,
    ).join(' ');
  expect(statements('clearing')).toMatch(/gland/);
  expect(statements('clearing')).not.toMatch(/pomme|meunier/);
  expect(statements('orchard')).toMatch(/pomme/);
  expect(statements('orchard')).not.toMatch(/gland|écureuil/);
});

it('hints: how to start, then the calculation', () => {
  const e = {
    ...generateMultiply(new Rng(1), 1, BIOMES.orchard),
    steps: [
      [6, '×', 8],
      [48, '+', 7],
    ],
    method: 'D’abord, combien de pommes dans les cageots ?',
  } as ProblemExercise;
  expect(problemHint(e, 1)).toBe('D’abord, combien de pommes dans les cageots ?');
  expect(problemHint(e, 2)).toBe('6 × 8 = 48, puis 48 + 7 = 55.');
  expect(problemHint({ ...e, steps: [[45, '−', 12]] }, 2)).toBe('45 − 12 = 33.');
});

describe('problèmes de fractions (#170)', () => {
  for (const biome of BIOME_IDS) {
    it(`${biome}: a fraction of a whole, up to 1, never nothing left`, () => {
      for (let level = 0; level < FRACTION_TEMPLATES.length; level++) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const e = generateFractionProblem(new Rng(seed), level, {
            vocabulary: BIOMES[biome].vocabulary,
          });
          const [n, d] = e.result;
          expect(n >= 1 && n <= d && d <= 12, e.statement).toBe(true);
          expect(e.answer).toBe(`${n}/${d}`);
          // The denominator of the answer is in the statement.
          expect(e.statement).toContain(String(d));
        }
      }
    });
  }

  it('names what is eaten for what is left, and the denominators added', () => {
    const e = generateFractionProblem(new Rng(1), 0, { vocabulary: BIOMES.clearing.vocabulary });
    const left = { ...e, result: [5, 8], eaten: [3, 8] } as const;
    expect(fractionProblemHint(left, 1, { answer: '3/8' })).toBe(
      'Ça, c’est ce qui est mangé.\nOn cherche ce qui reste.',
    );
    const eaten = { ...e, result: [5, 8], eaten: undefined } as const;
    expect(fractionProblemHint(eaten, 1, { answer: '5/16' })).toBe(
      'Le nombre du bas ne change pas :\nles parts gardent leur taille.',
    );
    expect(fractionProblemHint(eaten, 1, { answer: '4/8' })).toBe(eaten.method);
  });
});
