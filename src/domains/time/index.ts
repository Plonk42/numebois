import { defineDomain } from '../../core/registry';
import { BY_JUMPS } from './lessons/by-jumps';
import { CLOCK_HANDS } from './lessons/clock-hands';
import { calendar, durations, readClock, setClock, units } from './skills';

export const time = defineDomain({
  id: 'time',
  name: 'L’heure et les durées',
  skills: [readClock, setClock, units, durations, calendar],
  lessons: [CLOCK_HANDS, BY_JUMPS],
});
