import { defineLesson } from '../../../core/registry';
import { DURATIONS, durationExercise } from '../durations';

const at = (hours: number, minutes: number) => 60 * hours + minutes;

/** A duration on the timeline: a jump to the whole hour, then on to the end (#60). */
export const BY_JUMPS = defineLesson({
  id: `${DURATIONS}/par-bonds`,
  skill: DURATIONS,
  title: 'Les bonds sur la frise',
  steps: [
    {
      kind: 'explain',
      text: 'De 14h10 à 15h30 ?\nUn bond jusqu’à 15h00, puis un autre.',
      figure: { kind: 'timeline', start: at(14, 10), end: at(15, 30), asked: 'duration' },
    },
    {
      kind: 'explain',
      text: '14h10 → 15h00 : 50 min.\n15h00 → 15h30 : 30 min.',
      figure: { kind: 'timeline', start: at(14, 10), end: at(15, 30), asked: 'duration' },
    },
    {
      kind: 'explain',
      text: '50 min + 30 min = 80 min.\n80 min, c’est 1 h 20 min.',
      figure: { kind: 'timeline', start: at(14, 10), end: at(15, 30), asked: 'duration' },
    },
    {
      kind: 'guidedExample',
      text: 'Un bond jusqu’à 10h00, puis compte la suite.',
      exercise: durationExercise(at(9, 40), at(10, 15), 2),
    },
    { kind: 'check', count: 2, level: 2 },
  ],
});
