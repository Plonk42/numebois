import type { Domain } from '../core/types';
import { columnArithmetic } from './column-arithmetic';
import { measures } from './measures';
import { mentalMath } from './mental-math';
import { numbers } from './numbers';
import { time } from './time';
import { timesTables } from './times-tables';
import { wordProblems } from './word-problems';

/** The registry: one line per domain. */
export const DOMAINS: readonly Domain[] = [
  numbers,
  mentalMath,
  timesTables,
  wordProblems,
  columnArithmetic,
  time,
  measures,
];
