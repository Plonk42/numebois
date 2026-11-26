import { defineSkill } from '../../core/registry';
import { WRITE_DIGITS } from '../numbers/generators';
import {
  READ_CLOCK,
  READ_LEVELS,
  SET_CLOCK,
  SET_LEVELS,
  generateReadClock,
  generateSetClock,
  type ReadClockExercise,
  type SetClockExercise,
} from './generators';
import { readClockHint, setClockHint } from './hints';
import { validateReading, validateSetting } from './validate';

export const readClock = defineSkill<ReadClockExercise>({
  id: READ_CLOCK,
  name: 'Lire l’heure',
  prerequisites: [WRITE_DIGITS],
  levels: READ_LEVELS,
  generate: generateReadClock,
  validate: validateReading,
  hint: readClockHint,
  challenge: true,
});

export const setClock = defineSkill<SetClockExercise>({
  id: SET_CLOCK,
  name: 'Placer les aiguilles',
  prerequisites: [READ_CLOCK],
  levels: SET_LEVELS,
  generate: generateSetClock,
  validate: validateSetting,
  hint: setClockHint,
});
