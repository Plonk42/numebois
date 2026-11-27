import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { ADD as MENTAL_ADD, SUBTRACT as MENTAL_SUBTRACT } from '../mental-math/generators';
import { PRODUCTS } from '../times-tables/generators';
import {
  ADD,
  ADD_LEVELS,
  generateAddition,
  generateMultiplication,
  generateSubtraction,
  MULTIPLY,
  MULTIPLY_LEVELS,
  SUBTRACT,
  SUBTRACT_LEVELS,
  type AdditionExercise,
  type MultiplicationExercise,
  type SubtractionExercise,
} from './generators';
import { MONEY } from '../units/everyday';
import { generatePrices, PRICE_LEVELS, PRICES, priceHint, type PriceExercise } from './prices';
import { additionHint, multiplicationHint, subtractionHint, subtractionLures } from './hints';

export const addition = defineSkill<AdditionExercise>({
  id: ADD,
  name: 'Poser une addition',
  prerequisites: [MENTAL_ADD],
  levels: ADD_LEVELS,
  // Setting out (5 s with a touch, 2 s a digit written), then 6 s a column with Plume, 8
  // accompanied, 9 alone, 2 more with three numbers.
  questionSeconds: [25, 30, 40, 40, 55, 70],
  generate: generateAddition,
  validate: validateNumber,
  hint: additionHint,
});

export const subtraction = defineSkill<SubtractionExercise>({
  id: SUBTRACT,
  name: 'Poser une soustraction',
  prerequisites: [ADD, MENTAL_SUBTRACT],
  levels: SUBTRACT_LEVELS,
  // As the addition, a little more a column: the carry added at the bottom, 10 more at the top.
  questionSeconds: [25, 30, 40, 45, 55, 65],
  generate: generateSubtraction,
  validate: validateNumber,
  hint: subtractionHint,
  lures: subtractionLures,
});

export const multiplication = defineSkill<MultiplicationExercise>({
  id: MULTIPLY,
  name: 'Poser une multiplication',
  prerequisites: [ADD, PRODUCTS],
  levels: MULTIPLY_LEVELS,
  // Setting out, then a fact of the table, its carry and two digits written: 7 to 10 s a column;
  // by two digits (#176), two lines and their sum.
  questionSeconds: [25, 35, 35, 45, 50, 60, 65, 80, 80],
  generate: generateMultiplication,
  validate: validateNumber,
  hint: multiplicationHint,
});

export const prices = defineSkill<PriceExercise>({
  id: PRICES,
  name: 'Poser des prix',
  prerequisites: [SUBTRACT, MONEY],
  levels: PRICE_LEVELS,
  // As the addition and the subtraction, a column more, the comma to set out.
  questionSeconds: [30, 40, 35, 50, 60, 70],
  generate: generatePrices,
  validate: validateNumber,
  hint: priceHint,
});
