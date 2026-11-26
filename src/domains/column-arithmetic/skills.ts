import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { ADD as MENTAL_ADD } from '../mental-math/generators';
import { ADD, ADD_LEVELS, generateAddition, type AdditionExercise } from './generators';
import { additionHint } from './hints';

export const addition = defineSkill<AdditionExercise>({
  id: ADD,
  name: 'Poser une addition',
  prerequisites: [MENTAL_ADD],
  levels: ADD_LEVELS,
  generate: generateAddition,
  validate: validateNumber,
  hint: additionHint,
});
