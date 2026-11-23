import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { WRITE_DIGITS } from '../numbers/generators';
import { complementFacts, doubleHalfFacts } from './facts';
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
  TIMES_TEN,
  TIMES_TEN_LEVELS,
  generateAdd,
  generateComplement,
  generateDoubleHalf,
  generateNineEleven,
  generateSubtract,
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
  timesTenHint,
} from './hints';

export const add = defineSkill<OperationExercise>({
  id: ADD,
  name: 'Additionner de tête',
  prerequisites: [],
  levels: ADD_LEVELS,
  generate: generateAdd,
  validate: validateNumber,
  hint: addSubtractHint,
  drill: true,
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
  drill: true,
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
  drill: true,
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
  drill: true,
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
  drill: true,
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
  drill: true,
  challenge: true,
});
