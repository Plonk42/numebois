import { defineDomain } from '../../core/registry';
import { readClock, setClock } from './skills';

export const time = defineDomain({
  id: 'time',
  name: 'L’heure et les durées',
  skills: [readClock, setClock],
});
