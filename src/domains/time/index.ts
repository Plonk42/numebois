import { defineDomain } from '../../core/registry';
import { calendar, durations, readClock, setClock, units } from './skills';

export const time = defineDomain({
  id: 'time',
  name: 'L’heure et les durées',
  skills: [readClock, setClock, units, durations, calendar],
});
