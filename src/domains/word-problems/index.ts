import { defineDomain } from '../../core/registry';
import { addSubtract, fractions, multiply } from './skills';

export const wordProblems = defineDomain({
  id: 'word-problems',
  name: 'Les problèmes',
  skills: [addSubtract, multiply, fractions],
});
