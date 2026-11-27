import { defineDomain } from '../../core/registry';
import { COLUMN_ADDITION } from './lessons/column-addition';
import { COLUMN_MULTIPLICATION } from './lessons/column-multiplication';
import { COLUMN_SUBTRACTION } from './lessons/column-subtraction';
import { addition, multiplication, prices, subtraction } from './skills';

export const columnArithmetic = defineDomain({
  id: 'column-arithmetic',
  name: 'Les opérations posées',
  skills: [addition, subtraction, multiplication, prices],
  lessons: [COLUMN_ADDITION, COLUMN_SUBTRACTION, COLUMN_MULTIPLICATION],
});
