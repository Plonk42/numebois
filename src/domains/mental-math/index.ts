import { defineDomain } from '../../core/registry';
import { add, complements, doublesHalves, nineEleven, subtract, timesTen } from './skills';

export const mentalMath = defineDomain({
  id: 'mental-math',
  name: 'Le calcul mental',
  skills: [add, subtract, complements, nineEleven, doublesHalves, timesTen],
});
