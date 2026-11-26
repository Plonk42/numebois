import { defineLesson } from '../../../core/registry';
import { ADD, addition } from '../generators';

/**
 * Plume sets out an addition column by column, then the child does one with her (#53). The text
 * of a demo or of a guided example comes once the operation is done: Plume's bubble talks before.
 */
export const COLUMN_ADDITION = defineLesson({
  id: `${ADD}/poser`,
  skill: ADD,
  title: 'Poser une addition',
  steps: [
    {
      kind: 'explain',
      text: 'On pose les nombres en colonnes :\nles unités sous les unités,\nles dizaines sous les dizaines.',
    },
    {
      kind: 'explain',
      text: '47 + 38 = 85.\nOn commence toujours par les unités, à droite.',
      demo: addition([47, 38], 0),
    },
    {
      kind: 'explain',
      text: 'Une colonne dépasse 9 ?\nSa retenue monte en haut de la colonne suivante.',
      demo: addition([256, 178], 1),
    },
    {
      kind: 'guidedExample',
      text: 'Tu as posé 36 + 29, colonne par colonne.',
      exercise: addition([36, 29], 0),
    },
    { kind: 'check', count: 2, level: 2 },
  ],
});
