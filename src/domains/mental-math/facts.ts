import type { SkillFacts } from '../../core/types';
import {
  COMPLEMENTS,
  DOUBLES_HALVES,
  complement,
  doubleHalf,
  type ComplementExercise,
  type DoubleHalfExercise,
} from './generators';

const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Time to answer an elementary fact by heart. */
const SECONDS = 4;

const complementFact = (given: number) => `${COMPLEMENTS}:${given}+${10 - given}`;
const doubleFact = (value: number) => `${DOUBLES_HALVES}:double-${value}`;
const halfFact = (value: number) => `${DOUBLES_HALVES}:half-${value}`;

/** The complements to 10: `mental-math.complements:3+7`. */
export const complementFacts: SkillFacts<ComplementExercise> = {
  all: ONE_TO_NINE.map(complementFact),
  of: ({ given, target }) => (target === 10 ? complementFact(given) : null),
  exercise: (fact) =>
    complement(
      ONE_TO_NINE.find((n) => complementFact(n) === fact)!,
      10,
      0,
    ),
  seconds: SECONDS,
};

const DOUBLED = [...ONE_TO_NINE, 10];

/** Doubles up to 10 and halves up to 20: `mental-math.doubles-halves:double-7`, `…:half-18`. */
export const doubleHalfFacts: SkillFacts<DoubleHalfExercise> = {
  all: DOUBLED.flatMap((n) => [doubleFact(n), halfFact(2 * n)]),
  of: ({ kind, value }) => {
    if (kind === 'double' && value <= 10) return doubleFact(value);
    if (kind === 'half' && value <= 20) return halfFact(value);
    return null;
  },
  exercise: (fact) => {
    const double = DOUBLED.find((n) => doubleFact(n) === fact);
    if (double !== undefined) return doubleHalf('double', double, 0);
    return doubleHalf('half', 2 * DOUBLED.find((n) => halfFact(2 * n) === fact)!, 1);
  },
  seconds: SECONDS,
};
