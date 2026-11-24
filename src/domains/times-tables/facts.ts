import type { SkillFacts } from '../../core/types';
import {
  MAX_FACTOR,
  MIN_FACTOR,
  PRODUCTS,
  levelOfProduct,
  product,
  type ProductExercise,
} from './generators';

/** One fact per product, whatever the order: 3 × 7 and 7 × 3 are `times-tables.products:3x7`. */
export function productFact(a: number, b: number): string {
  return `${PRODUCTS}:${Math.min(a, b)}x${Math.max(a, b)}`;
}

const FACTORS = Array.from({ length: MAX_FACTOR - MIN_FACTOR + 1 }, (_, i) => MIN_FACTOR + i);
const PAIRS = new Map(
  FACTORS.flatMap((a) => FACTORS.filter((b) => b >= a).map((b) => [productFact(a, b), [a, b]])),
);

/** The 45 products from 2 × 2 to 10 × 10, and one group per table. */
export const productFacts: SkillFacts<ProductExercise> = {
  all: [...PAIRS.keys()],
  of: ({ a, b }) => productFact(a, b),
  exercise: (fact, rng) => {
    const [a, b] = PAIRS.get(fact)!;
    const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
    return product(left, right, levelOfProduct(a, b));
  },
  seconds: 5,
  groups: FACTORS.map((table) => ({
    id: `table-${table}`,
    name: `La table de ${table}`,
    facts: FACTORS.map((other) => productFact(table, other)),
  })),
};
