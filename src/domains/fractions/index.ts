import { defineDomain } from '../../core/registry';
import { THE_PARTS } from './lessons/the-parts';
import { equal, read } from './skills';

export const fractions = defineDomain({
  id: 'fractions',
  name: 'Les fractions',
  skills: [read, equal],
  lessons: [THE_PARTS],
});
