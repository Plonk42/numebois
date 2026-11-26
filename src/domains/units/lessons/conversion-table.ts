import { defineLesson } from '../../../core/registry';
import { CLASS_LENGTHS, CONVERT, convertExercise, type Pair } from '../generators';

const METRES: Pair = { family: 'length', big: 'm', small: 'cm' };
const units = CLASS_LENGTHS;

/**
 * The conversion table of the class (#60, #161): the unit given, its units digit in its column,
 * a 0 for each empty one, then read in the unit asked; towards the left, larger units.
 */
export const CONVERSION_TABLE = defineLesson({
  id: `${CONVERT}/le-tableau`,
  skill: CONVERT,
  title: 'Le tableau de conversion',
  steps: [
    {
      kind: 'explain',
      text: 'Chaque unité a sa colonne.\nVers la droite, × 10 ; vers la gauche, ÷ 10.',
      figure: { kind: 'conversion', units, digits: units.map(() => null), marks: [] },
    },
    {
      kind: 'explain',
      text: '3 m en cm : le 3 dans la colonne des m.\nUn 0 par colonne jusqu’aux cm : 300 cm.',
      figure: { kind: 'conversion', units, digits: [3, 0, 0, null], marks: [2] },
    },
    {
      kind: 'explain',
      text: '230 cm en dm : le 0 des unités dans les cm.\nLis jusqu’aux dm : 23 dm.',
      figure: { kind: 'conversion', units, digits: [2, 3, 0, null], marks: [1] },
    },
    {
      kind: 'explain',
      text: '3 m 25 cm = 325 cm.',
      demo: convertExercise(METRES, 3, 25, 'total', 1),
    },
    {
      kind: 'guidedExample',
      text: 'Lis les chiffres jusqu’à la colonne des cm.',
      exercise: convertExercise(METRES, 2, 40, 'total', 1),
    },
    { kind: 'check', count: 2, level: 1 },
  ],
});
