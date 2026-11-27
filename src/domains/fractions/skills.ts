import { defineSkill } from '../../core/registry';
import type { Exercise } from '../../core/types';
import {
  validateChoice,
  validateEqualFraction,
  validateFraction,
  validateNumber,
} from '../../core/validate';
import { WRITE_DIGITS } from '../numbers/generators';
import {
  ADD,
  ADD_LEVELS,
  addFractionsHint,
  generateAddFractions,
  type AddFractionsExercise,
} from './add';
import {
  COMPARE,
  COMPARE_LEVELS,
  compareFractionsHint,
  generateCompareFractions,
  type CompareFractionsExercise,
} from './compare';
import {
  EQUAL,
  EQUAL_LEVELS,
  equalHint,
  equalLuresOf,
  generateEqual,
  type EqualExercise,
} from './equal';
import { READ, READ_LEVELS, generateRead, type ReadExercise } from './generators';
import { readHint } from './hints';

/** A number on the keypad, or one of the choices. */
const validateAny = (exercise: Exercise, answer: string) =>
  exercise.input.kind === 'choice'
    ? validateChoice(exercise, answer)
    : validateNumber(exercise, answer);

/** The fraction written in its boxes, the parts coloured, or one of the choices. */
function validateRead(exercise: Exercise, answer: string): boolean {
  if (exercise.input.kind === 'fraction') return validateFraction(exercise, answer);
  if (exercise.input.kind === 'parts') return validateNumber(exercise, answer);
  return validateChoice(exercise, answer);
}

export const read = defineSkill<ReadExercise>({
  id: READ,
  name: 'Lire, écrire et colorier des fractions',
  prerequisites: [WRITE_DIGITS],
  levels: READ_LEVELS,
  generate: generateRead,
  validate: validateRead,
  hint: readHint,
});

export const equal = defineSkill<EqualExercise>({
  id: EQUAL,
  name: 'Les fractions égales',
  prerequisites: [READ],
  levels: EQUAL_LEVELS,
  generate: generateEqual,
  validate: validateAny,
  hint: equalHint,
  lures: equalLuresOf,
});

export const compare = defineSkill<CompareFractionsExercise>({
  id: COMPARE,
  name: 'Comparer des fractions',
  prerequisites: [EQUAL],
  levels: COMPARE_LEVELS,
  generate: generateCompareFractions,
  validate: validateChoice,
  hint: compareFractionsHint,
});

export const add = defineSkill<AddFractionsExercise>({
  id: ADD,
  name: 'Additionner et soustraire des fractions',
  prerequisites: [EQUAL],
  levels: ADD_LEVELS,
  generate: generateAddFractions,
  validate: validateEqualFraction,
  hint: addFractionsHint,
});
