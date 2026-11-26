import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { ADD, SUBTRACT } from '../mental-math/generators';
import { PRODUCTS } from '../times-tables/generators';
import { problemHint } from './hints';
import {
  ADD_SUBTRACT,
  ADD_SUBTRACT_TEMPLATES,
  MULTIPLY,
  MULTIPLY_TEMPLATES,
  generateAddSubtract,
  generateMultiply,
  type ProblemExercise,
} from './problems';

export const addSubtract = defineSkill<ProblemExercise>({
  id: ADD_SUBTRACT,
  name: 'Problèmes : ajouter ou enlever',
  prerequisites: [ADD, SUBTRACT],
  levels: ADD_SUBTRACT_TEMPLATES.length,
  // A statement of up to 25 words read at about 70 words a minute, then the operation.
  questionSeconds: [25, 25, 30, 40],
  generate: generateAddSubtract,
  validate: validateNumber,
  hint: problemHint,
});

export const multiply = defineSkill<ProblemExercise>({
  id: MULTIPLY,
  name: 'Problèmes de multiplication',
  prerequisites: [PRODUCTS, ADD_SUBTRACT],
  levels: MULTIPLY_TEMPLATES.length,
  questionSeconds: [25, 35],
  generate: generateMultiply,
  validate: validateNumber,
  hint: problemHint,
});
