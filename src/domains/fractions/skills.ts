import { defineSkill } from '../../core/registry';
import type { Exercise } from '../../core/types';
import { validateChoice, validateFraction, validateNumber } from '../../core/validate';
import { WRITE_DIGITS } from '../numbers/generators';
import { READ, READ_LEVELS, generateRead, type ReadExercise } from './generators';
import { readHint } from './hints';

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
