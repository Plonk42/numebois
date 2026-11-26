import { defineLesson } from '../../../core/registry';
import { countMoney, MONEY } from '../everyday';

/** The notes first, then the coins, the euros before the cents (#60). */
export const COUNT_MONEY = defineLesson({
  id: `${MONEY}/compter`,
  skill: MONEY,
  title: 'Compter l’argent',
  steps: [
    {
      kind: 'explain',
      text: 'Commence par les billets :\n10 € + 5 € = 15 €.',
      figure: { kind: 'money', cents: [1000, 500, 200, 50, 20] },
    },
    {
      kind: 'explain',
      text: 'Puis la pièce de 2 € : 17 €.\nEnfin les centimes : 70 c.',
      figure: { kind: 'money', cents: [1000, 500, 200, 50, 20] },
    },
    {
      kind: 'explain',
      text: 'En tout : 17 € 70 c.\n100 centimes font 1 €.',
    },
    {
      kind: 'guidedExample',
      text: 'Les billets d’abord, puis les pièces.',
      exercise: countMoney([2000, 500, 200, 100], 0),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
