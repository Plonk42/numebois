import { defineSkill } from '../../core/registry';
import { validateNumber } from '../../core/validate';
import { PRODUCTS } from '../times-tables/generators';
import {
  DIVIDE,
  DIVIDE_LEVELS,
  SHARE,
  SHARE_LEVELS,
  generateDivide,
  generateShare,
  type DivideExercise,
  type ShareExercise,
} from './generators';
import { divideHint, divideLures, shareHint, shareLures } from './hints';

export const share = defineSkill<ShareExercise>({
  id: SHARE,
  name: 'Partager et grouper',
  prerequisites: [PRODUCTS],
  levels: SHARE_LEVELS,
  // A statement to read, then things to share out in the head.
  questionSeconds: [15, 15, 18, 18],
  generate: generateShare,
  validate: validateNumber,
  hint: shareHint,
  lures: shareLures,
});

export const divide = defineSkill<DivideExercise>({
  id: DIVIDE,
  name: 'Diviser',
  prerequisites: [SHARE],
  levels: DIVIDE_LEVELS,
  generate: generateDivide,
  validate: validateNumber,
  hint: divideHint,
  lures: divideLures,
  challenge: true,
});
