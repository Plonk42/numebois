import { defineLesson } from '../../../core/registry';
import { SUBTRACT, subtraction } from '../generators';

/**
 * Plume sets out a subtraction by compensation, as in class (#174): 10 more at the top, the
 * carry down at the bottom; then the child does one with her. The text of a demo or of a guided
 * example comes once the operation is done: Plume's bubble talks before.
 */
export const COLUMN_SUBTRACTION = defineLesson({
  id: `${SUBTRACT}/poser`,
  skill: SUBTRACT,
  title: 'Poser une soustraction',
  steps: [
    {
      kind: 'explain',
      text: 'Le grand nombre en haut, le petit en bas :\nles unités sous les unités.',
    },
    {
      kind: 'explain',
      text: '586 − 243 = 343.\nOn commence toujours par les unités, à droite.',
      demo: subtraction(586, 243, 0),
    },
    {
      kind: 'explain',
      text: 'En haut, le chiffre est trop petit ?\nJ’ajoute 10 en haut,\net je retiens 1 en bas.',
    },
    {
      kind: 'explain',
      text: '523 − 178 = 345.\nLa retenue s’ajoute au chiffre du bas.',
      demo: subtraction(523, 178, 1),
    },
    {
      kind: 'guidedExample',
      text: 'Tu as posé 463 − 128, colonne par colonne.',
      exercise: subtraction(463, 128, 1),
    },
    { kind: 'check', count: 2, level: 2 },
  ],
});
