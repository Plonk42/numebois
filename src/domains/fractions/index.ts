import { defineDomain } from '../../core/registry';
import { THE_PARTS } from './lessons/the-parts';
import { read } from './skills';

export const fractions = defineDomain({
  id: 'fractions',
  name: 'Les fractions',
  skills: [read],
  lessons: [THE_PARTS],
});
