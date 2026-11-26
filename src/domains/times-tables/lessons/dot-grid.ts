import { defineLesson } from '../../../core/registry';
import { levelOfProduct, product, PRODUCTS } from '../generators';

/** 3 × 5 shown as dots to count, its answer above the keypad. */
const rowsOfDots = (a: number, b: number) => ({
  ...product(a, b, levelOfProduct(a, b)),
  figure: { kind: 'dots', rows: a, columns: b } as const,
  input: { kind: 'keypad', maxDigits: 3 } as const,
});

/** A product is rows of dots: count them by rows, turn the grid (#52). */
export const DOT_GRID = defineLesson({
  id: `${PRODUCTS}/quadrillage`,
  skill: PRODUCTS,
  title: 'Le quadrillage de points',
  steps: [
    {
      kind: 'explain',
      text: '3 × 4, ce sont 3 rangées de 4 points.',
      figure: { kind: 'dots', rows: 3, columns: 4 },
    },
    {
      kind: 'explain',
      text: 'Compte rangée par rangée : 4, 8, 12.\nDonc 3 × 4 = 12.',
      figure: { kind: 'dots', rows: 3, columns: 4 },
    },
    {
      kind: 'explain',
      text: 'Tourne le quadrillage : 4 rangées de 3.\nToujours 12 points : 4 × 3 = 12.',
      figure: { kind: 'dots', rows: 4, columns: 3 },
    },
    {
      kind: 'guidedExample',
      text: 'Compte les rangées de 5 points.',
      exercise: rowsOfDots(3, 5),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
