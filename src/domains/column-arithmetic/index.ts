import { defineDomain } from '../../core/registry';
import { addition } from './skills';

export const columnArithmetic = defineDomain({
  id: 'column-arithmetic',
  name: 'Les opérations posées',
  skills: [addition],
});
