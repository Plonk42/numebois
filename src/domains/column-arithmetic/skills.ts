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
  generate: generateAddition,
  validate: validateNumber,
  hint: additionHint,
});

export const multiplication = defineSkill<MultiplicationExercise>({
  id: MULTIPLY,
  name: 'Poser une multiplication',
  prerequisites: [ADD, PRODUCTS],
  levels: MULTIPLY_LEVELS,
  generate: generateMultiplication,
  validate: validateNumber,
  hint: multiplicationHint,
});
