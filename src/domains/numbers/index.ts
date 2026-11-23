import { defineDomain } from '../../core/registry';
import { writeDigits } from './skills';

export const numbers = defineDomain({
  id: 'numbers',
  name: 'Les nombres',
  skills: [writeDigits],
});
