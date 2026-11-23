import { defineSkill } from '../../core/registry';
import { validateChoice, validateNumber } from '../../core/validate';
import {
  COMPARE,
  COMPARE_LEVELS,
  DECOMPOSE,
  DECOMPOSE_LEVELS,
  ORDER,
  ORDER_LEVELS,
  READ,
  READ_LEVELS,
  WRITE_DIGITS,
  WRITE_DIGITS_LEVELS,
  generateCompare,
  generateDecompose,
  generateOrder,
  generateRead,
  generateWriteDigits,
  type CompareExercise,
  type DecomposeExercise,
  type OrderExercise,
  type ReadExercise,
  type WriteDigitsExercise,
} from './generators';
import { compareHint, decomposeHint, orderHint, readHint, writeDigitsHint } from './hints';

export const writeDigits = defineSkill<WriteDigitsExercise>({
  id: WRITE_DIGITS,
  name: 'Écrire un nombre en chiffres',
  prerequisites: [],
  levels: WRITE_DIGITS_LEVELS,
  generate: generateWriteDigits,
  validate: validateNumber,
  hint: writeDigitsHint,
  drill: true,
});

export const read = defineSkill<ReadExercise>({
  id: READ,
  name: 'Lire un nombre',
  prerequisites: [],
  levels: READ_LEVELS,
  generate: generateRead,
  validate: validateChoice,
  hint: readHint,
  drill: true,
});

export const decompose = defineSkill<DecomposeExercise>({
  id: DECOMPOSE,
  name: 'Décomposer un nombre',
  prerequisites: [WRITE_DIGITS],
  levels: DECOMPOSE_LEVELS,
  generate: generateDecompose,
  validate: validateNumber,
  hint: decomposeHint,
  drill: true,
});

export const compare = defineSkill<CompareExercise>({
  id: COMPARE,
  name: 'Comparer deux nombres',
  prerequisites: [WRITE_DIGITS],
  levels: COMPARE_LEVELS,
  generate: generateCompare,
  validate: validateChoice,
  hint: compareHint,
  drill: true,
});

export const order = defineSkill<OrderExercise>({
  id: ORDER,
  name: 'Ranger des nombres',
  prerequisites: [COMPARE],
  levels: ORDER_LEVELS,
  generate: generateOrder,
  validate: validateChoice,
  hint: orderHint,
  drill: true,
});
