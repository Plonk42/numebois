import type { SkillFacts } from '../../core/types';
import { RELATIONS, UNITS, relation, type UnitsExercise } from './units';

const unitFact = (key: string) => `${UNITS}:${key}`;
const factsOf = (keys: readonly string[]) => keys.map(unitFact);

/** The relations by heart, `time.units:hour-minutes`…; their multiples are worked out. */
export const unitFacts: SkillFacts<UnitsExercise> = {
  all: RELATIONS.map((r) => unitFact(r.key)),
  of: (exercise) => (exercise.level === 0 ? unitFact(exercise.relation.key) : null),
  exercise: (fact) => relation(RELATIONS.find((r) => unitFact(r.key) === fact)!),
  seconds: 4,
  groups: [
    {
      id: 'clock',
      name: 'Heures, minutes, secondes',
      facts: factsOf(['hour-minutes', 'minute-seconds', 'half-hour', 'quarter-hour']),
    },
    {
      id: 'calendar',
      name: 'Jours, semaines, mois',
      facts: factsOf(['day-hours', 'week-days', 'year-months']),
    },
  ],
};
