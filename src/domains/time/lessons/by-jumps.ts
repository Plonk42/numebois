import { defineLesson } from '../../../core/registry';
import { DURATIONS, durationExercise, timelineOf } from '../durations';

const at = (hours: number, minutes: number) => 60 * hours + minutes;

/** A duration on the timeline: a jump of an hour, then the minutes (#60, #166). */
export const BY_JUMPS = defineLesson({
  id: `${DURATIONS}/par-bonds`,
  skill: DURATIONS,
  title: 'Les bonds sur la frise',
  steps: [
    {
      kind: 'explain',
      text: 'De 14h10 à 15h30 ?\nUn bond d’une heure, puis les minutes.',
      figure: timelineOf(at(14, 10), at(15, 30), 'duration'),
    },
    {
      kind: 'explain',
      text: '14h10 → 15h10 : 1 h.\n15h10 → 15h30 : 20 min.',
      figure: timelineOf(at(14, 10), at(15, 30), 'duration'),
    },
    {
      kind: 'explain',
      text: 'En tout : 1 h et 20 min.',
      figure: timelineOf(at(14, 10), at(15, 30), 'duration'),
    },
    {
      kind: 'guidedExample',
      text: 'Un bond d’une heure jusqu’à 10h40,\npuis compte les minutes.',
      exercise: durationExercise(at(9, 40), at(11, 5), 3),
    },
    { kind: 'check', count: 2, level: 3 },
  ],
});
