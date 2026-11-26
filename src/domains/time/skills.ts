import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { WRITE_DIGITS } from '../numbers/generators';
import { CALENDAR, CALENDAR_LEVELS, generateCalendar, type CalendarExercise } from './calendar';
import { DURATIONS, DURATIONS_LEVELS, generateDuration, type DurationExercise } from './durations';
import { unitFacts } from './facts';
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
import { calendarHint, durationHint, readClockHint, setClockHint, unitsHint } from './hints';
import { UNITS, UNITS_LEVELS, generateUnits, unitsLures, type UnitsExercise } from './units';
import { validateAny, validateReading, validateSetting } from './validate';

export const readClock = defineSkill<ReadClockExercise>({
  id: READ_CLOCK,
  name: 'Lire l’heure',
  prerequisites: [WRITE_DIGITS],
  levels: READ_LEVELS,
  // The minutes counted 5 by 5 around the dial, then written in their boxes.
  questionSeconds: [10, 12, 15, 20, 25, 25, 30],
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
  // Both hands dragged, the minute one by 5 then to the minute.
  questionSeconds: [12, 15, 18, 22, 28, 25],
  generate: generateSetClock,
  validate: validateSetting,
  hint: setClockHint,
});

export const units = defineSkill<UnitsExercise>({
  id: UNITS,
  name: 'Heures, minutes et secondes',
  prerequisites: [READ_CLOCK],
  levels: UNITS_LEVELS,
  questionSeconds: [12, 15, 20, 20],
  generate: generateUnits,
  validate: validateNumber,
  hint: unitsHint,
  lures: unitsLures,
  facts: unitFacts,
});

export const durations = defineSkill<DurationExercise>({
  id: DURATIONS,
  name: 'Calculer une durée',
  prerequisites: [UNITS],
  levels: DURATIONS_LEVELS,
  // Two times read, the jumps of the timeline added, hours and minutes written.
  questionSeconds: [20, 15, 25, 30, 25],
  generate: generateDuration,
  validate: validateAny,
  hint: durationHint,
});

export const calendar = defineSkill<CalendarExercise>({
  id: CALENDAR,
  name: 'Lire le calendrier',
  prerequisites: [READ_CLOCK],
  levels: CALENDAR_LEVELS,
  questionSeconds: [12, 15, 18, 25],
  generate: generateCalendar,
  validate: validateAny,
  hint: calendarHint,
});
