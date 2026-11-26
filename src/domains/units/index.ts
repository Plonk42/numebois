import { defineDomain } from '../../core/registry';
import { convert, magnitude, money, relations } from './skills';

export const units = defineDomain({
  id: 'units',
  name: 'Les unités et la monnaie',
  skills: [relations, money, convert, magnitude],
});
