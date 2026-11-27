import { defineDomain } from '../../core/registry';
import { read } from './skills';

export const fractions = defineDomain({
  id: 'fractions',
  name: 'Les fractions',
  skills: [read],
});
