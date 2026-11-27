import { defineDomain } from '../../core/registry';
import { PLACE_VALUE } from './lessons/place-value';
import {
  compare,
  decompose,
  linePlace,
  lineRead,
  operationWords,
  order,
  read,
  writeDigits,
} from './skills';

export const numbers = defineDomain({
  id: 'numbers',
  name: 'Les nombres',
  skills: [writeDigits, read, decompose, compare, order, lineRead, linePlace, operationWords],
  lessons: [PLACE_VALUE],
});
