import { defineLesson } from '../../../core/registry';
import { MULTIPLY, multiplication } from '../generators';

/**
 * Plume sets out a multiplication, its carry in the bag, then the child does one with her (#53).
 * The text of a demo or of a guided example comes once the operation is done.
 */
export const COLUMN_MULTIPLICATION = defineLesson({
  id: `${MULTIPLY}/poser`,
  skill: MULTIPLY,
  title: 'Poser une multiplication',
  steps: [
    {
      kind: 'explain',
      text: 'Pour 47 × 3, on multiplie chaque chiffre par 3.\nOn commence par les unités, à droite.',
    },
    {
      kind: 'explain',
      text: '47 × 3 = 141.\nLe sac a gardé la retenue pour la colonne suivante.',
      demo: multiplication(47, 3, 0),
    },
    {
      kind: 'explain',
      text: 'Avec 3 chiffres, c’est pareil :\nle sac garde chaque retenue, une colonne après l’autre.',
      demo: multiplication(258, 4, 1),
    },
    {
      kind: 'explain',
      text: 'Besoin d’un résultat de la table ?\nAppuie sur « Voir la table », puis reviens à l’opération.',
    },
    {
      kind: 'guidedExample',
      text: 'Tu as posé 26 × 4, colonne par colonne.',
      exercise: multiplication(26, 4, 0),
    },
    { kind: 'check', count: 2, level: 2 },
  ],
});
