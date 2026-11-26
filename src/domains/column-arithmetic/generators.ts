import type { Rng } from '../../core/rng';
import type { ColumnMode, Exercise } from '../../core/types';
import { formatNumber } from '../numbers/words';
import { addColumns, carryCount, rankCount } from './columns';

export const ADD = 'column-arithmetic.add';

/** Keeps an operation on one line. */
const SPACE = '\u00a0';
/** The numbers of the curriculum of CE2 stop at 9 999. */
const MAX_RESULT = 9999;

export interface AdditionExercise extends Exercise {
  rows: readonly number[];
}

interface AddLevel {
  mode: ColumnMode;
  /** Ranks of each number, drawn between the two. */
  ranks: readonly (readonly [number, number])[];
  /** At least this many carries. */
  carries: number;
}

/**
 * Levels of « poser une addition », results up to 9 999:
 * 0. guided, two numbers of 2 digits, a carry: 37 + 48;
 * 1. guided, two numbers of 3 digits, two carries or more: 468 + 275;
 * 2. accompanied, two numbers of 3 digits, a carry or more;
 * 3. accompanied, three numbers of 2 digits, a carry or more;
 * 4. alone, two numbers of 3 or 4 digits, two carries or more;
 * 5. alone, three numbers of 2 to 4 digits, two carries or more.
 */
const ADD_BY_LEVEL: readonly AddLevel[] = [
  {
    mode: 'guided',
    ranks: [
      [2, 2],
      [2, 2],
    ],
    carries: 1,
  },
  {
    mode: 'guided',
    ranks: [
      [3, 3],
      [3, 3],
    ],
    carries: 2,
  },
  {
    mode: 'accompanied',
    ranks: [
      [3, 3],
      [3, 3],
    ],
    carries: 1,
  },
  {
    mode: 'accompanied',
    ranks: [
      [2, 2],
      [2, 2],
      [2, 2],
    ],
    carries: 1,
  },
  {
    mode: 'alone',
    ranks: [
      [3, 4],
      [3, 4],
    ],
    carries: 2,
  },
  {
    mode: 'alone',
    ranks: [
      [2, 4],
      [2, 4],
      [2, 4],
    ],
    carries: 2,
  },
];

export const ADD_LEVELS = ADD_BY_LEVEL.length;

const INSTRUCTIONS: Record<ColumnMode, string> = {
  guided: 'Calcule avec Plume, colonne par colonne.',
  accompanied: 'Calcule colonne par colonne.',
  alone: 'Calcule l’addition posée.',
};

export const addStatement = (rows: readonly number[]) => rows.map(formatNumber).join(`${SPACE}+ `);

export function addition(rows: readonly number[], level: number): AdditionExercise {
  const { mode } = ADD_BY_LEVEL[level];
  const columns = addColumns(rows);
  return {
    skill: ADD,
    level,
    instruction: INSTRUCTIONS[mode],
    statement: addStatement(rows),
    input: { kind: 'column', operator: '+', rows, columns, mode },
    answer: String(rows.reduce((sum, n) => sum + n, 0)),
    rows,
  };
}

/** Whether `rows` fit a level: their ranks, a result up to 9 999, enough carries. */
export function fitsAddLevel(rows: readonly number[], level: number): boolean {
  const { ranks, carries } = ADD_BY_LEVEL[level];
  const sum = rows.reduce((total, n) => total + n, 0);
  return (
    rows.length === ranks.length &&
    rows.every((n, i) => rankCount(n) >= ranks[i][0] && rankCount(n) <= ranks[i][1]) &&
    sum <= MAX_RESULT &&
    carryCount(addColumns(rows)) >= carries
  );
}

export function generateAddition(rng: Rng, level: number): AdditionExercise {
  if (level < 0 || level >= ADD_LEVELS) throw new RangeError(`niveau ${level}`);
  const { ranks } = ADD_BY_LEVEL[level];
  for (;;) {
    const rows = ranks.map(([low, high]) => {
      const rank = rng.int(low, high);
      return rng.int(10 ** (rank - 1), 10 ** rank - 1);
    });
    if (fitsAddLevel(rows, level)) return addition(rows, level);
  }
}
