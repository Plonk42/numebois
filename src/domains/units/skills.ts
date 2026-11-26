import { defineSkill } from '../../core/registry';
import type { Exercise } from '../../core/types';
import { validateChoice, validateNumber } from '../../core/validate';
import { MEASURE } from '../measures/generators';
import { WRITE_DIGITS } from '../numbers/generators';
import {
  MAGNITUDE,
  MAGNITUDE_LEVELS,
  MONEY,
  MONEY_LEVELS,
  generateMagnitude,
  generateMoney,
  type MagnitudeExercise,
  type MoneyExercise,
} from './everyday';
import { relationFacts } from './facts';
import {
  CONVERT,
  CONVERT_LEVELS,
  RELATIONS_LEVELS,
  RELATIONS_SKILL,
  convertLures,
  generateConvert,
  generateRelation,
  type ConvertExercise,
  type RelationExercise,
} from './generators';
import { convertHint, magnitudeHint, moneyHint, relationHint } from './hints';

/** A number on the keypad, or one of the choices. */
const validateAny = (exercise: Exercise, answer: string) =>
  exercise.input.kind === 'choice'
    ? validateChoice(exercise, answer)
    : validateNumber(exercise, answer);

export const relations = defineSkill<RelationExercise>({
  id: RELATIONS_SKILL,
  name: 'Les relations entre unités',
  prerequisites: [MEASURE],
  levels: RELATIONS_LEVELS,
  generate: generateRelation,
  validate: validateNumber,
  hint: relationHint,
  facts: relationFacts,
});

export const convert = defineSkill<ConvertExercise>({
  id: CONVERT,
  name: 'Convertir',
  prerequisites: [RELATIONS_SKILL],
  levels: CONVERT_LEVELS,
  generate: generateConvert,
  validate: validateNumber,
  hint: convertHint,
  lures: convertLures,
});

export const money = defineSkill<MoneyExercise>({
  id: MONEY,
  name: 'La monnaie',
  prerequisites: [WRITE_DIGITS],
  levels: MONEY_LEVELS,
  generate: generateMoney,
  validate: validateAny,
  hint: moneyHint,
});

export const magnitude = defineSkill<MagnitudeExercise>({
  id: MAGNITUDE,
  name: 'Les ordres de grandeur',
  prerequisites: [RELATIONS_SKILL],
  levels: MAGNITUDE_LEVELS,
  generate: generateMagnitude,
  validate: validateChoice,
  hint: magnitudeHint,
});
