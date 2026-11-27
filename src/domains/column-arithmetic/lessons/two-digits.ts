import { defineLesson } from '../../../core/registry';
import { MULTIPLY, multiplication } from '../generators';

/**
 * Multiplying by a number of two digits (#176), as in class: a line for the units, a line for
 * the tens that starts with a 0, then their sum. For the levels by two digits: offered when they
 * resist, and in the Carnet once seen.
 */
export const TWO_DIGITS = defineLesson({
  id: `${MULTIPLY}/deux-chiffres`,
  skill: MULTIPLY,
  title: 'Multiplier par deux chiffres',
  fromLevel: 6,
  steps: [
    {
      kind: 'explain',
      text: 'Pour 32 × 14, deux lignes :\nd’abord × 4 unités, puis × 1 dizaine.\nPuis on les additionne.',
    },
    {
      kind: 'explain',
      text: 'La 2e ligne multiplie par les dizaines :\nelle commence par un 0 dans les unités.',
    },
    {
      kind: 'explain',
      text: '32 × 14 = 448.\n128 + 320 = 448.',
      demo: multiplication(32, 14, 6),
    },
    {
      kind: 'guidedExample',
      text: 'Tu as posé 23 × 13, ligne par ligne.',
      exercise: multiplication(23, 13, 6),
    },
    { kind: 'check', count: 2, level: 7 },
  ],
});
