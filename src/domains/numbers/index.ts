import { defineDomain } from '../../core/registry';
import { compare, decompose, order, read, writeDigits } from './skills';

export const numbers = defineDomain({
  id: 'numbers',
  name: 'Les nombres',
  skills: [writeDigits, read, decompose, compare, order],
});
