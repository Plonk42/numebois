import { defineLesson } from '../../../core/registry';
import { composeExercise, DECOMPOSE } from '../generators';

/** Each digit is worth its rank: the place-value table, the blocks, then the sum (#52). */
export const PLACE_VALUE = defineLesson({
  id: `${DECOMPOSE}/valeur-des-chiffres`,
  skill: DECOMPOSE,
  title: 'La valeur des chiffres',
  steps: [
    {
      kind: 'explain',
      text: 'Dans 347, chaque chiffre a sa colonne.',
      figure: { kind: 'place-value', digits: [3, 4, 7] },
    },
    {
      kind: 'explain',
      text: 'Le 3 vaut 3 centaines : 300.\nLe 4 vaut 4 dizaines : 40.\nLe 7 vaut 7 unités.',
      figure: { kind: 'blocks', hundreds: 3, tens: 4, units: 7 },
    },
    {
      kind: 'explain',
      text: 'Alors 300 + 40 + 7, c’est 347.',
      demo: composeExercise(347, 'sum', 0),
    },
    {
      kind: 'guidedExample',
      text: 'Compte les plaques, les barres, puis les cubes.',
      exercise: composeExercise(526, 'blocks', 0),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
