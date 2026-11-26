import { defineDomain } from '../../core/registry';
import { BY_TEN } from './lessons/by-ten';
import { add, complements, doublesHalves, nineEleven, subtract, sums, timesTen } from './skills';

export const mentalMath = defineDomain({
  id: 'mental-math',
  name: 'Le calcul mental',
  skills: [sums, add, subtract, complements, nineEleven, doublesHalves, timesTen],
  lessons: [BY_TEN],
});
