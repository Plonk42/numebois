import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import {
  WRITE_DIGITS,
  WRITE_DIGITS_LEVELS,
  generateWriteDigits,
  type WriteDigitsExercise,
} from './generators';
import { writeDigitsHint } from './hints';

export const writeDigits = defineSkill<WriteDigitsExercise>({
  id: WRITE_DIGITS,
  name: 'Écrire un nombre en chiffres',
  prerequisites: [],
  levels: WRITE_DIGITS_LEVELS,
  generate: generateWriteDigits,
  validate: validateNumber,
  hint: writeDigitsHint,
});
