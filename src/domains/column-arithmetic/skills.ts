import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { ADD as MENTAL_ADD } from '../mental-math/generators';
import { PRODUCTS } from '../times-tables/generators';
import {
  ADD,
  ADD_LEVELS,
  generateAddition,
  generateMultiplication,
  MULTIPLY,
  MULTIPLY_LEVELS,
  type AdditionExercise,
  type MultiplicationExercise,
} from './generators';
import { additionHint, multiplicationHint } from './hints';

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

export const multiplication = defineSkill<MultiplicationExercise>({
  id: MULTIPLY,
  name: 'Poser une multiplication',
  prerequisites: [ADD, PRODUCTS],
  levels: MULTIPLY_LEVELS,
  // Setting out, then a fact of the table, its carry and two digits written: 7 to 10 s a column.
  questionSeconds: [25, 35, 35, 45, 50, 60],
  generate: generateMultiplication,
  validate: validateNumber,
  hint: multiplicationHint,
});
