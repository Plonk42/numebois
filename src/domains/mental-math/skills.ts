import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { WRITE_DIGITS } from '../numbers/generators';
import { complementFacts, doubleHalfFacts, sumFacts } from './facts';
import {
  ADD,
  ADD_LEVELS,
  COMPLEMENTS,
  COMPLEMENTS_LEVELS,
  DOUBLES_HALVES,
  DOUBLES_HALVES_LEVELS,
  NINE_ELEVEN,
  NINE_ELEVEN_LEVELS,
  SUBTRACT,
  SUBTRACT_LEVELS,
  SUMS,
  SUMS_LEVELS,
  TIMES_TEN,
  TIMES_TEN_LEVELS,
  generateAdd,
  generateComplement,
  generateDoubleHalf,
  generateNineEleven,
  generateSubtract,
  generateSum,
  generateTimesTen,
  type ComplementExercise,
  type DoubleHalfExercise,
  type OperationExercise,
  type TimesTenExercise,
} from './generators';
import {
  addSubtractHint,
  complementHint,
  doubleHalfHint,
  nineElevenHint,
  sumHint,
  timesTenHint,
} from './hints';
import {
  addSubtractLures,
  complementLures,
  doubleHalfLures,
  nineElevenLures,
  sumLures,
  timesTenLures,
} from './lures';

export const sums = defineSkill<OperationExercise>({
  id: SUMS,
  name: 'Les additions simples',
  prerequisites: [],
  levels: SUMS_LEVELS,
  generate: generateSum,
  validate: validateNumber,
  hint: sumHint,
  lures: sumLures,
  challenge: true,
  facts: sumFacts,
});

export const add = defineSkill<OperationExercise>({
  id: ADD,
  name: 'Additionner de tête',
  prerequisites: [SUMS],
  levels: ADD_LEVELS,
  generate: generateAdd,
  validate: validateNumber,
  hint: addSubtractHint,
  lures: addSubtractLures,
  challenge: true,
});

export const subtract = defineSkill<OperationExercise>({
  id: SUBTRACT,
  name: 'Soustraire de tête',
  prerequisites: [],
  levels: SUBTRACT_LEVELS,
  generate: generateSubtract,
  validate: validateNumber,
  hint: addSubtractHint,
  lures: addSubtractLures,
  challenge: true,
});

export const complements = defineSkill<ComplementExercise>({
  id: COMPLEMENTS,
  name: 'Compléments à 10 et à 100',
  prerequisites: [],
  levels: COMPLEMENTS_LEVELS,
  generate: generateComplement,
  validate: validateNumber,
  hint: complementHint,
  lures: complementLures,
  challenge: true,
  facts: complementFacts,
});

export const nineEleven = defineSkill<OperationExercise>({
  id: NINE_ELEVEN,
  name: 'Ajouter ou enlever 9 et 11',
  prerequisites: [ADD, SUBTRACT],
  levels: NINE_ELEVEN_LEVELS,
  generate: generateNineEleven,
  validate: validateNumber,
  hint: nineElevenHint,
  lures: nineElevenLures,
  challenge: true,
});

export const doublesHalves = defineSkill<DoubleHalfExercise>({
  id: DOUBLES_HALVES,
  name: 'Doubles et moitiés',
  prerequisites: [],
  levels: DOUBLES_HALVES_LEVELS,
  generate: generateDoubleHalf,
  validate: validateNumber,
  hint: doubleHalfHint,
  lures: doubleHalfLures,
  challenge: true,
  facts: doubleHalfFacts,
});

export const timesTen = defineSkill<TimesTenExercise>({
  id: TIMES_TEN,
  name: 'Multiplier par 10 et par 100',
  prerequisites: [WRITE_DIGITS],
  levels: TIMES_TEN_LEVELS,
  generate: generateTimesTen,
  validate: validateNumber,
  hint: timesTenHint,
  lures: timesTenLures,
  challenge: true,
});
