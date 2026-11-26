import { defineLesson } from '../../../core/registry';
import { NINE_ELEVEN, nineElevenOperation } from '../generators';

/** Adding 9 or 11 goes through 10 (#52). */
export const BY_TEN = defineLesson({
  id: `${NINE_ELEVEN}/par-dix`,
  skill: NINE_ELEVEN,
  title: 'Ajouter 9 ou 11',
  steps: [
    { kind: 'explain', text: 'Ajouter 10, c’est facile.\nAlors pour ajouter 9, passe par 10 !' },
    {
      kind: 'explain',
      text: '34 + 10 = 44, puis 44 − 1 = 43.',
      demo: nineElevenOperation(34, '+', 9, 0),
    },
    {
      kind: 'explain',
      text: 'Pour 11 : 52 + 10 = 62, puis 62 + 1 = 63.',
      demo: nineElevenOperation(52, '+', 11, 0),
    },
    {
      kind: 'guidedExample',
      text: 'À toi : ajoute 10, puis enlève 1.',
      exercise: nineElevenOperation(27, '+', 9, 0),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
