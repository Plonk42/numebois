import type { Rng } from '../../core/rng';
import type { ColumnMode, ColumnSetup, Exercise } from '../../core/types';
import { formatNumber } from '../numbers/words';
import { addColumns, carryCount, multiplyColumns, rankCount } from './columns';

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

/** The operation to set out, in line, as on a school sheet. */
const SETUP_INSTRUCTIONS: Record<ColumnMode, (statement: string) => string> = {
  guided: (statement) => `Pose ${statement} avec Plume, puis calcule.`,
  accompanied: (statement) => `Pose ${statement}, puis calcule colonne par colonne.`,
  alone: (statement) => `Pose ${statement}, puis calcule.`,
};

/** Share of the operations written box by box, the others set out with a touch (#158). */
export const WRITTEN_SHARE: Record<ColumnMode, number> = {
  guided: 0,
  accompanied: 1 / 2,
  alone: 2 / 3,
};

/** Drawn apart, so that the numbers stay those of the seed. */
const drawSetup = (rng: Rng, mode: ColumnMode): ColumnSetup =>
  rng.fork('setup').chance(WRITTEN_SHARE[mode]) ? 'write' : 'tap';

export const addStatement = (rows: readonly number[]) => rows.map(formatNumber).join(`${SPACE}+ `);

export function addition(
  rows: readonly number[],
  level: number,
  setup?: ColumnSetup,
): AdditionExercise {
  const { mode } = ADD_BY_LEVEL[level];
  const columns = addColumns(rows);
  const statement = addStatement(rows);
  return {
    skill: ADD,
    level,
    instruction: setup ? SETUP_INSTRUCTIONS[mode](statement) : INSTRUCTIONS[mode],
    statement,
    input: { kind: 'column', operator: '+', rows, columns, mode, ...(setup && { setup }) },
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
    if (fitsAddLevel(rows, level)) {
      return addition(rows, level, drawSetup(rng, ADD_BY_LEVEL[level].mode));
    }
  }
}

export const MULTIPLY = 'column-arithmetic.multiply';

/** `a × b`, `b` of one digit; the rows are the two numbers. */
export interface MultiplicationExercise extends Exercise {
  a: number;
  b: number;
}

interface MultiplyLevel {
  mode: ColumnMode;
  /** Ranks of `a`, drawn between the two. */
  ranks: readonly [number, number];
  /** The multiplier, drawn between the two. */
  factor: readonly [number, number];
  /** At least this many carries. */
  carries: number;
  /** A zero among the digits of `a` (1 205 × 7). */
  zero?: boolean;
}

/**
 * Levels of « poser une multiplication », by a number of one digit, results up to 9 999:
 * 0. guided, 2 digits by 2 to 5, a carry: 23 × 4;
 * 1. guided, 3 digits by 2 to 9, two carries or more: 347 × 6;
 * 2. accompanied, 2 digits by 6 to 9, a carry or more;
 * 3. accompanied, 3 digits by 2 to 9, two carries or more;
 * 4. alone, 3 digits by 6 to 9, two carries or more;
 * 5. alone, 4 digits with a zero, by 2 to 9, a carry or more.
 */
const MULTIPLY_BY_LEVEL: readonly MultiplyLevel[] = [
  { mode: 'guided', ranks: [2, 2], factor: [2, 5], carries: 1 },
  { mode: 'guided', ranks: [3, 3], factor: [2, 9], carries: 2 },
  { mode: 'accompanied', ranks: [2, 2], factor: [6, 9], carries: 1 },
  { mode: 'accompanied', ranks: [3, 3], factor: [2, 9], carries: 2 },
  { mode: 'alone', ranks: [3, 3], factor: [6, 9], carries: 2 },
  { mode: 'alone', ranks: [4, 4], factor: [2, 9], carries: 1, zero: true },
];

export const MULTIPLY_LEVELS = MULTIPLY_BY_LEVEL.length;

const MULTIPLY_INSTRUCTIONS: Record<ColumnMode, string> = {
  ...INSTRUCTIONS,
  alone: 'Calcule la multiplication posée.',
};

export const multiplyStatement = (a: number, b: number) =>
  `${formatNumber(a)}${SPACE}×${SPACE}${b}`;

export function multiplication(
  a: number,
  b: number,
  level: number,
  setup?: ColumnSetup,
): MultiplicationExercise {
  const { mode } = MULTIPLY_BY_LEVEL[level];
  const statement = multiplyStatement(a, b);
  return {
    skill: MULTIPLY,
    level,
    instruction: setup ? SETUP_INSTRUCTIONS[mode](statement) : MULTIPLY_INSTRUCTIONS[mode],
    statement,
    input: {
      kind: 'column',
      operator: '×',
      rows: [a, b],
      columns: multiplyColumns(a, b),
      mode,
      ...(setup && { setup }),
    },
    answer: String(a * b),
    a,
    b,
  };
}

/** Whether `a × b` fits a level: its ranks and multiplier, a result up to 9 999, the carries. */
export function fitsMultiplyLevel(a: number, b: number, level: number): boolean {
  const { ranks, factor, carries, zero } = MULTIPLY_BY_LEVEL[level];
  return (
    rankCount(a) >= ranks[0] &&
    rankCount(a) <= ranks[1] &&
    b >= factor[0] &&
    b <= factor[1] &&
    a * b <= MAX_RESULT &&
    (!zero || String(a).slice(1).includes('0')) &&
    carryCount(multiplyColumns(a, b)) >= carries
  );
}

export function generateMultiplication(rng: Rng, level: number): MultiplicationExercise {
  if (level < 0 || level >= MULTIPLY_LEVELS) throw new RangeError(`niveau ${level}`);
  const { ranks, factor } = MULTIPLY_BY_LEVEL[level];
  for (;;) {
    const rank = rng.int(ranks[0], ranks[1]);
    const a = rng.int(10 ** (rank - 1), 10 ** rank - 1);
    const b = rng.int(factor[0], factor[1]);
    if (fitsMultiplyLevel(a, b, level)) {
      return multiplication(a, b, level, drawSetup(rng, MULTIPLY_BY_LEVEL[level].mode));
    }
  }
}
