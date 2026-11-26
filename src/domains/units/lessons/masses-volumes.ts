import { defineLesson } from '../../../core/registry';
import { RELATIONS_SKILL, UNIT_RELATIONS, unitRelation } from '../generators';

const KILOGRAM = UNIT_RELATIONS.find((r) => r.big === 'kg')!;
const LITRE = UNIT_RELATIONS.find((r) => r.big === 'L' && r.small === 'cL')!;

/** Grams and kilograms on the scale, centilitres and litres in the jug (#60). */
export const MASSES_VOLUMES = defineLesson({
  id: `${RELATIONS_SKILL}/masses-contenances`,
  skill: RELATIONS_SKILL,
  title: 'Masses et contenances',
  steps: [
    {
      kind: 'explain',
      text: 'Un paquet de farine pèse 1 kg.\n1 kg = 1 000 g.',
      figure: {
        kind: 'gauge',
        instrument: 'scale',
        max: 1000,
        step: 100,
        label: 200,
        value: 1000,
        unit: 'g',
      },
    },
    {
      kind: 'explain',
      text: 'Un verre contient environ 20 cL.\n1 L = 100 cL.',
      figure: {
        kind: 'gauge',
        instrument: 'jug',
        max: 50,
        step: 10,
        label: 10,
        value: 20,
        unit: 'cL',
      },
    },
    {
      kind: 'explain',
      text: '1 L = 10 dL, et 1 dL = 10 cL.',
    },
    {
      kind: 'explain',
      text: '1 kg = 1 000 g.',
      demo: unitRelation(KILOGRAM, false, 0),
    },
    {
      kind: 'guidedExample',
      text: 'Pense au verre doseur.',
      exercise: unitRelation(LITRE, false, 0),
    },
    { kind: 'check', count: 2, level: 0 },
  ],
});
