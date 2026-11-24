import type { SkillFacts } from '../../core/types';
import { MAX_FACTOR, MIN_FACTOR, PRODUCTS, type ProductExercise } from './generators';

/** One fact per product, whatever the order: 3 × 7 and 7 × 3 are `times-tables.products:3x7`. */
export function productFact(a: number, b: number): string {
  return `${PRODUCTS}:${Math.min(a, b)}x${Math.max(a, b)}`;
}

const FACTORS = Array.from({ length: MAX_FACTOR - MIN_FACTOR + 1 }, (_, i) => MIN_FACTOR + i);

/** The 45 products from 2 × 2 to 10 × 10. */
export const productFacts: SkillFacts<ProductExercise> = {
  all: FACTORS.flatMap((a) => FACTORS.filter((b) => b >= a).map((b) => productFact(a, b))),
  of: ({ a, b }) => productFact(a, b),
  seconds: 5,
};
