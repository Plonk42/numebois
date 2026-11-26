import type { Domain } from '../core/types';
import { columnArithmetic } from './column-arithmetic';
import { mentalMath } from './mental-math';
import { numbers } from './numbers';
import { timesTables } from './times-tables';
import { wordProblems } from './word-problems';

/** The registry: one line per domain. */
export const DOMAINS: readonly Domain[] = [
  numbers,
  mentalMath,
  timesTables,
  wordProblems,
  columnArithmetic,
];
