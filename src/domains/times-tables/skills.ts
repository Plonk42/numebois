import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { DOUBLES_HALVES } from '../mental-math/generators';
import { missingFactorFacts, productFacts } from './facts';
import {
  MISSING_FACTOR,
  PRODUCTS,
  TABLES_LEVELS,
  generateMissingFactor,
  generateProduct,
  type MissingFactorExercise,
  type ProductExercise,
} from './generators';
import { missingFactorHint, productHint } from './hints';
import { missingFactorLures, productLures } from './lures';

export const products = defineSkill<ProductExercise>({
  id: PRODUCTS,
  name: 'Les tables de multiplication',
  prerequisites: [DOUBLES_HALVES],
  levels: TABLES_LEVELS,
  generate: generateProduct,
  validate: validateNumber,
  hint: productHint,
  lures: productLures,
  challenge: true,
  facts: productFacts,
});

export const missingFactor = defineSkill<MissingFactorExercise>({
  id: MISSING_FACTOR,
  name: 'Le nombre qui manque dans une table',
  prerequisites: [PRODUCTS],
  levels: TABLES_LEVELS,
  generate: generateMissingFactor,
  validate: validateNumber,
  hint: missingFactorHint,
  lures: missingFactorLures,
  challenge: true,
  facts: missingFactorFacts,
});
