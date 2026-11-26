import type { SkillFacts } from '../../core/types';
import {
  RELATIONS_SKILL,
  UNIT_RELATIONS,
  unitRelation,
  type RelationExercise,
  type UnitRelation,
} from './generators';

const relationFact = ({ big, small }: UnitRelation) => `${RELATIONS_SKILL}:${big}-${small}`;
const factsWhere = (units: readonly string[]) =>
  UNIT_RELATIONS.filter((r) => units.includes(r.big)).map(relationFact);

/** The relations by heart, both ways alike: `units.relations:m-cm`. */
export const relationFacts: SkillFacts<RelationExercise> = {
  all: UNIT_RELATIONS.map(relationFact),
  of: ({ relation }) => relationFact(relation),
  exercise: (fact, rng) => {
    const relation = UNIT_RELATIONS.find((r) => relationFact(r) === fact)!;
    const back = rng.chance(0.3);
    return unitRelation(relation, back, back ? 1 : 0);
  },
  seconds: 4,
  groups: [
    { id: 'lengths', name: 'Les longueurs', facts: factsWhere(['km', 'm', 'dm', 'cm']) },
    { id: 'masses-volumes', name: 'Masses et contenances', facts: factsWhere(['kg', 'L', 'dL']) },
    { id: 'money', name: 'Les euros', facts: factsWhere(['€']) },
  ],
};
