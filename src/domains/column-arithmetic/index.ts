import { defineDomain } from '../../core/registry';
import { COLUMN_ADDITION } from './lessons/column-addition';
import { COLUMN_MULTIPLICATION } from './lessons/column-multiplication';
import { addition, multiplication, subtraction } from './skills';

export const columnArithmetic = defineDomain({
  id: 'column-arithmetic',
  name: 'Les opérations posées',
  skills: [addition, subtraction, multiplication],
  lessons: [COLUMN_ADDITION, COLUMN_MULTIPLICATION],
});
