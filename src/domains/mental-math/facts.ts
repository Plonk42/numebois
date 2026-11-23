import type { SkillFacts } from '../../core/types';
import {
  COMPLEMENTS,
  DOUBLES_HALVES,
  type ComplementExercise,
  type DoubleHalfExercise,
} from './generators';

const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Time to answer an elementary fact by heart. */
const SECONDS = 4;

/** The complements to 10: `mental-math.complements:3+7`. */
export const complementFacts: SkillFacts<ComplementExercise> = {
  all: ONE_TO_NINE.map((n) => `${COMPLEMENTS}:${n}+${10 - n}`),
  of: ({ given, target }) => (target === 10 ? `${COMPLEMENTS}:${given}+${10 - given}` : null),
  seconds: SECONDS,
};

/** Doubles up to 10 and halves up to 20: `mental-math.doubles-halves:double-7`, `…:half-18`. */
export const doubleHalfFacts: SkillFacts<DoubleHalfExercise> = {
  all: [...ONE_TO_NINE, 10].flatMap((n) => [
    `${DOUBLES_HALVES}:double-${n}`,
    `${DOUBLES_HALVES}:half-${2 * n}`,
  ]),
  of: ({ kind, value }) => {
    if (kind === 'double' && value <= 10) return `${DOUBLES_HALVES}:double-${value}`;
    if (kind === 'half' && value <= 20) return `${DOUBLES_HALVES}:half-${value}`;
    return null;
  },
  seconds: SECONDS,
};
