import { defineDomain } from '../../core/registry';
import { THE_PARTS } from './lessons/the-parts';
import { add, compare, equal, measure, read } from './skills';

export const fractions = defineDomain({
  id: 'fractions',
  name: 'Les fractions',
  skills: [read, equal, compare, add, measure],
  lessons: [THE_PARTS],
});
