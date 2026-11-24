import { defineDomain } from '../../core/registry';
import { missingFactor, products } from './skills';

export const timesTables = defineDomain({
  id: 'times-tables',
  name: 'Les tables de multiplication',
  skills: [products, missingFactor],
});
