import { defineDomain } from '../../core/registry';
import { CONVERSION_TABLE } from './lessons/conversion-table';
import { COUNT_MONEY } from './lessons/count-money';
import { MASSES_VOLUMES } from './lessons/masses-volumes';
import { convert, magnitude, money, relations } from './skills';

export const units = defineDomain({
  id: 'units',
  name: 'Les unités et la monnaie',
  skills: [relations, money, convert, magnitude],
  lessons: [CONVERSION_TABLE, MASSES_VOLUMES, COUNT_MONEY],
});
