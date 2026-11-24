import type { Rng } from '../../core/rng';
import type { Exercise, SkillFacts } from '../../core/types';
import {
  MAX_FACTOR,
  MIN_FACTOR,
  MISSING_FACTOR,
  PRODUCTS,
  levelOfProduct,
  missingFactor,
  product,
  type MissingFactorExercise,
  type ProductExercise,
} from './generators';

const pairFact = (skill: string, a: number, b: number) =>
  `${skill}:${Math.min(a, b)}x${Math.max(a, b)}`;

/** One fact per product, whatever the order: 3 × 7 and 7 × 3 are `times-tables.products:3x7`. */
export function productFact(a: number, b: number): string {
  return pairFact(PRODUCTS, a, b);
}

const FACTORS = Array.from({ length: MAX_FACTOR - MIN_FACTOR + 1 }, (_, i) => MIN_FACTOR + i);

/** The 45 pairs from 2 × 2 to 10 × 10 of a notion of the tables, and one group per table. */
function tableFacts<E extends Exercise & { a: number; b: number }>(
  skill: string,
  build: (a: number, b: number, level: number, rng: Rng) => E,
): SkillFacts<E> {
  const pairs = new Map(
    FACTORS.flatMap((a) =>
      FACTORS.filter((b) => b >= a).map((b) => [pairFact(skill, a, b), [a, b]]),
    ),
  );
  return {
    all: [...pairs.keys()],
    of: ({ a, b }) => pairFact(skill, a, b),
    exercise: (fact, rng) => {
      const [a, b] = pairs.get(fact)!;
      const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
      return build(left, right, levelOfProduct(a, b), rng);
    },
    seconds: 5,
    groups: FACTORS.map((table) => ({
      id: `table-${table}`,
      name: `La table de ${table}`,
      facts: FACTORS.map((other) => pairFact(skill, table, other)),
    })),
  };
}

export const productFacts = tableFacts<ProductExercise>(PRODUCTS, (a, b, level) =>
  product(a, b, level),
);

/** `7 × ? = 56` and `? × 8 = 56` are `times-tables.missing-factor:7x8`. */
export const missingFactorFacts = tableFacts<MissingFactorExercise>(
  MISSING_FACTOR,
  (a, b, level, rng) => missingFactor(rng, a, b, level),
);
