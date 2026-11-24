import type { SkillFacts } from '../../core/types';
import {
  COMPLEMENTS,
  DOUBLES_HALVES,
  SUMS,
  complement,
  doubleHalf,
  sum,
  sumLevel,
  type ComplementExercise,
  type DoubleHalfExercise,
  type OperationExercise,
} from './generators';

const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Time to answer an elementary fact by heart. */
const SECONDS = 4;

const sumFact = (a: number, b: number) => `${SUMS}:${Math.min(a, b)}+${Math.max(a, b)}`;
const SUM_PAIRS = new Map(
  ONE_TO_NINE.flatMap((a) => ONE_TO_NINE.filter((b) => b >= a).map((b) => [sumFact(a, b), [a, b]])),
);
const sumsWhere = (level: number) =>
  [...SUM_PAIRS].filter(([, [a, b]]) => sumLevel(a, b) === level).map(([fact]) => fact);

/** The 45 sums of two numbers from 1 to 9, whatever the order: `mental-math.sums:5+8`. */
export const sumFacts: SkillFacts<OperationExercise> = {
  all: [...SUM_PAIRS.keys()],
  of: ({ a, b }) => sumFact(a, b),
  exercise: (fact, rng) => {
    const [a, b] = SUM_PAIRS.get(fact)!;
    const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
    return sum(left, right, sumLevel(a, b));
  },
  seconds: SECONDS,
  groups: [
    { id: 'to-10', name: 'Jusqu’à 10', facts: sumsWhere(0) },
    { id: 'past-10', name: 'Au-delà de 10', facts: sumsWhere(1) },
  ],
};

const complementFact = (given: number) => `${COMPLEMENTS}:${given}+${10 - given}`;
const hundredFact = (given: number) => `${COMPLEMENTS}:${given}+${100 - given}`;
const TENS = ONE_TO_NINE.map((n) => n * 10);
const doubleFact = (value: number) => `${DOUBLES_HALVES}:double-${value}`;
const halfFact = (value: number) => `${DOUBLES_HALVES}:half-${value}`;

/** The complements to 10 and, by tens, to 100: `mental-math.complements:3+7`, `…:30+70`. */
export const complementFacts: SkillFacts<ComplementExercise> = {
  all: [...ONE_TO_NINE.map(complementFact), ...TENS.map(hundredFact)],
  of: ({ given, target }) => {
    if (target === 10) return complementFact(given);
    return given % 10 === 0 ? hundredFact(given) : null;
  },
  exercise: (fact) => {
    const unit = ONE_TO_NINE.find((n) => complementFact(n) === fact);
    if (unit !== undefined) return complement(unit, 10, 0);
    return complement(
      TENS.find((n) => hundredFact(n) === fact)!,
      100,
      1,
    );
  },
  seconds: SECONDS,
  groups: [
    { id: 'to-10', name: 'Pour faire 10', facts: ONE_TO_NINE.map(complementFact) },
    { id: 'to-100', name: 'Pour faire 100', facts: TENS.map(hundredFact) },
  ],
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
  groups: [
    { id: 'doubles', name: 'Les doubles', facts: DOUBLED.map(doubleFact) },
    { id: 'halves', name: 'Les moitiés', facts: DOUBLED.map((n) => halfFact(2 * n)) },
  ],
};
