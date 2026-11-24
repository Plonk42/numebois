import { defineSkill } from '../../core/registry';
import { validateChoice, validateNumber } from '../../core/validate';
import {
  COMPARE,
  COMPARE_LEVELS,
  DECOMPOSE,
  DECOMPOSE_LEVELS,
  LINE_PLACE,
  LINE_READ,
  NUMBER_LINE_LEVELS,
  ORDER,
  ORDER_LEVELS,
  READ,
  READ_LEVELS,
  WRITE_DIGITS,
  WRITE_DIGITS_LEVELS,
  generateCompare,
  generateDecompose,
  generateLinePlace,
  generateLineRead,
  generateOrder,
  generateRead,
  generateWriteDigits,
  type CompareExercise,
  type DecomposeExercise,
  type NumberLineExercise,
  type OrderExercise,
  type ReadExercise,
  type WriteDigitsExercise,
} from './generators';
import {
  compareHint,
  decomposeHint,
  numberLineHint,
  orderHint,
  readHint,
  writeDigitsHint,
} from './hints';
import { decomposeLures, numberLineLures, writeDigitsLures } from './lures';

export const writeDigits = defineSkill<WriteDigitsExercise>({
  id: WRITE_DIGITS,
  name: 'Écrire un nombre en chiffres',
  prerequisites: [],
  levels: WRITE_DIGITS_LEVELS,
  generate: generateWriteDigits,
  validate: validateNumber,
  hint: writeDigitsHint,
  lures: writeDigitsLures,
});

export const read = defineSkill<ReadExercise>({
  id: READ,
  name: 'Lire un nombre',
  prerequisites: [],
  levels: READ_LEVELS,
  generate: generateRead,
  validate: validateChoice,
  hint: readHint,
});

export const decompose = defineSkill<DecomposeExercise>({
  id: DECOMPOSE,
  name: 'Décomposer un nombre',
  prerequisites: [WRITE_DIGITS],
  levels: DECOMPOSE_LEVELS,
  generate: generateDecompose,
  validate: validateNumber,
  hint: decomposeHint,
  lures: decomposeLures,
});

export const compare = defineSkill<CompareExercise>({
  id: COMPARE,
  name: 'Comparer deux nombres',
  prerequisites: [WRITE_DIGITS],
  levels: COMPARE_LEVELS,
  generate: generateCompare,
  validate: validateChoice,
  hint: compareHint,
});

export const order = defineSkill<OrderExercise>({
  id: ORDER,
  name: 'Ranger des nombres',
  prerequisites: [COMPARE],
  levels: ORDER_LEVELS,
  generate: generateOrder,
  validate: validateChoice,
  hint: orderHint,
});

export const lineRead = defineSkill<NumberLineExercise>({
  id: LINE_READ,
  name: 'Lire une droite graduée',
  prerequisites: [WRITE_DIGITS],
  levels: NUMBER_LINE_LEVELS,
  generate: generateLineRead,
  validate: validateNumber,
  hint: numberLineHint,
  lures: numberLineLures,
});

export const linePlace = defineSkill<NumberLineExercise>({
  id: LINE_PLACE,
  name: 'Placer un nombre sur une droite graduée',
  prerequisites: [LINE_READ],
  levels: NUMBER_LINE_LEVELS,
  generate: generateLinePlace,
  validate: validateNumber,
  hint: numberLineHint,
});
