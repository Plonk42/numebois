import type { Domain } from '../core/types';
import { mentalMath } from './mental-math';
import { numbers } from './numbers';
import { timesTables } from './times-tables';

/** The registry: one line per domain. */
export const DOMAINS: readonly Domain[] = [numbers, mentalMath, timesTables];
