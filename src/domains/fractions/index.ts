import { defineDomain } from '../../core/registry';
import { THE_PARTS } from './lessons/the-parts';
import { compare, equal, read } from './skills';

export const fractions = defineDomain({
  id: 'fractions',
  name: 'Les fractions',
  skills: [read, equal, compare],
  lessons: [THE_PARTS],
});
