import type { Domain } from '../core/types';
import { columnArithmetic } from './column-arithmetic';
import { division } from './division';
import { fractions } from './fractions';
import { measures } from './measures';
import { mentalMath } from './mental-math';
import { numbers } from './numbers';
import { time } from './time';
import { timesTables } from './times-tables';
import { units } from './units';
import { wordProblems } from './word-problems';

export { ORDER } from './order';

/** The registry: one line per domain. */
export const DOMAINS: readonly Domain[] = [
  numbers,
  mentalMath,
  timesTables,
  wordProblems,
  columnArithmetic,
  division,
  time,
  measures,
  units,
  fractions,
];
