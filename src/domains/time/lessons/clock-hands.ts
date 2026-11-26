import { defineLesson } from '../../../core/registry';
import { READ_CLOCK, readClock } from '../generators';

/** The hour hand gives the hour, the minute hand counts 5 minutes per number (#60). */
export const CLOCK_HANDS = defineLesson({
  id: `${READ_CLOCK}/les-aiguilles`,
  skill: READ_CLOCK,
  title: 'Les deux aiguilles',
  steps: [
    {
      kind: 'explain',
      text: 'La petite aiguille montre l’heure.\nLa grande est sur 12 : il est 3h00.',
      figure: { kind: 'clock', hours: 3, minutes: 0 },
    },
    {
      kind: 'explain',
      text: 'La grande aiguille compte les minutes.\n5 minutes par chiffre : sur 6, 30 minutes.',
      figure: { kind: 'clock', hours: 3, minutes: 30 },
    },
    {
      kind: 'explain',
      text: 'Sur 9 : 9 × 5 = 45 minutes.\nLa petite approche du 4 : 3h45.',
      figure: { kind: 'clock', hours: 3, minutes: 45 },
    },
    {
      kind: 'explain',
      text: '7h20 : la grande sur 4, et 4 × 5 = 20.',
      demo: readClock({ hours: 7, minutes: 20 }, 3),
    },
    {
      kind: 'guidedExample',
      text: 'Lis la petite aiguille, puis la grande.',
      exercise: readClock({ hours: 2, minutes: 15 }, 2),
    },
    { kind: 'check', count: 2, level: 2 },
  ],
});
