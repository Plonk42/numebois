import { defineLesson } from '../../../core/registry';
import { sum } from '../../mental-math/generators';
import { ADD, addition } from '../generators';

/**
 * An astuce to try the player and to write the others (#50): every kind of step, outside the
 * registry, never offered to the child. `?sandbox&lesson=column-arithmetic.add/essai`.
 */
export const TRY_LESSON = defineLesson({
  id: `${ADD}/essai`,
  skill: ADD,
  title: 'Essai d’astuce',
  steps: [
    { kind: 'explain', text: 'Plume te montre une astuce.\nRegarde bien, puis essaie.' },
    {
      kind: 'explain',
      text: 'Chaque chiffre a sa colonne.',
      figure: { kind: 'place-value', digits: [3, 4, 7] },
    },
    { kind: 'explain', text: 'Le pavé écrit tout seul.', demo: sum(8, 5, 1) },
    { kind: 'explain', text: 'Plume pose 37 + 48.', demo: addition([37, 48], 0) },
    { kind: 'guidedExample', text: 'À toi, avec Plume !', exercise: addition([56, 27], 0) },
    { kind: 'check', count: 2, level: 4 },
  ],
});
