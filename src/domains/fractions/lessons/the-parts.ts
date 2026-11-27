import { defineLesson } from '../../../core/registry';
import { Rng } from '../../../core/rng';
import type { Figure } from '../../../core/types';
import { READ, readExercise } from '../generators';

/** A galette shared in 9 equal parts, `coloured` of them coloured: the example of the class. */
const galette = (coloured: number): Figure => ({
  kind: 'fraction',
  wholes: [{ shape: 'disc', parts: 9, coloured }],
});

/** What a fraction is, in the words of the class (fiche du 26/11, #63). */
export const THE_PARTS = defineLesson({
  id: `${READ}/les-parts`,
  skill: READ,
  title: 'Les fractions',
  steps: [
    {
      kind: 'explain',
      text: 'Une fraction mesure une partie d’un tout.\nLa galette est partagée en 9 parts égales.',
      figure: galette(0),
    },
    {
      kind: 'explain',
      text: 'Dans 6/9, le dénominateur est en bas.\nIl compte les parts égales\u00a0: 9.',
      figure: galette(6),
    },
    {
      kind: 'explain',
      text: 'Dans 6/9, le numérateur est en haut.\nIl compte les parts prises\u00a0: 6 coloriées.',
      figure: galette(6),
    },
    {
      kind: 'explain',
      text: '6/9 se lit «\u00a0six neuvièmes\u00a0».',
      figure: galette(6),
    },
    {
      kind: 'manipulate',
      text: 'À toi : 4 parts égales, colorie-en 3.',
      exercise: readExercise(new Rng(1), 1, 'colour', 3, 4, 'disc'),
    },
    { kind: 'check', count: 2, level: 1 },
  ],
});
