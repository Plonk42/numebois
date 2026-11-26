import { defineDomain } from '../../core/registry';
import { DOT_GRID } from './lessons/dot-grid';
import { missingFactor, products } from './skills';

export const timesTables = defineDomain({
  id: 'times-tables',
  name: 'Les tables de multiplication',
  skills: [products, missingFactor],
  lessons: [DOT_GRID],
});
