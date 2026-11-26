import { defineLesson } from '../../../core/registry';
import { CONVERT, convertExercise, type Pair } from '../generators';

const METRES: Pair = { family: 'length', big: 'm', small: 'cm' };
const LENGTHS = ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm'];

/** The conversion table: a digit per column, a 0 for each empty one (#60). */
export const CONVERSION_TABLE = defineLesson({
  id: `${CONVERT}/le-tableau`,
  skill: CONVERT,
  title: 'Le tableau de conversion',
  steps: [
    {
      kind: 'explain',
      text: 'Chaque unité a sa colonne.\nUne colonne à droite, c’est 10 fois plus petit.',
      figure: { kind: 'conversion', units: LENGTHS, digits: LENGTHS.map(() => null), marks: [] },
    },
    {
      kind: 'explain',
      text: '3 m : le 3 dans la colonne des m.\nUn 0 par colonne jusqu’aux cm : 300 cm.',
      figure: {
        kind: 'conversion',
        units: LENGTHS,
        digits: [null, null, null, 3, 0, 0, null],
        marks: [5],
      },
    },
    {
      kind: 'explain',
      text: '3 m 25 cm = 325 cm.',
      demo: convertExercise(METRES, 3, 25, 1, 1),
    },
    {
      kind: 'guidedExample',
      text: 'Lis les chiffres jusqu’à la colonne des cm.',
      exercise: convertExercise(METRES, 2, 40, 1, 1),
    },
    { kind: 'check', count: 2, level: 1 },
  ],
});
