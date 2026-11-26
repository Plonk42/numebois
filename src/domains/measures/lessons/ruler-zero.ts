import { defineLesson } from '../../../core/registry';
import { MEASURE, measureExercise } from '../generators';

/** A flat segment from (x, 20), `length` millimetres long. */
const flat = (x: number, length: number) => [{ from: { x, y: 20 }, to: { x: x + length, y: 20 } }];

/** The 0 of the ruler on one end, never its edge; the millimetres between the numbers (#60). */
export const RULER_ZERO = defineLesson({
  id: `${MEASURE}/le-zero`,
  skill: MEASURE,
  title: 'Le 0 de la règle',
  steps: [
    {
      kind: 'explain',
      text: 'Pose le 0 de la règle sur un bout du segment.\nLe 0, pas le bord de la règle !',
    },
    {
      kind: 'manipulate',
      text: 'Glisse la règle : son 0 sur le point de gauche.',
      exercise: measureExercise(flat(30, 60), [60], 'cm', 0),
    },
    {
      kind: 'explain',
      text: 'Entre deux nombres, 10 petits traits.\nChaque petit trait, c’est 1 mm.',
    },
    {
      kind: 'guidedExample',
      text: 'Le 0 sur un bout, puis compte les petits traits.',
      exercise: measureExercise(flat(24, 45), [45], 'mm', 1),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
