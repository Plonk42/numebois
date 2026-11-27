import { defineDomain } from '../../core/registry';
import { divide, share } from './skills';

export const division = defineDomain({
  id: 'division',
  name: 'La division',
  skills: [share, divide],
});
