import type { Rng } from '../../core/rng';
import type { ColumnMode, ColumnSetup, Exercise } from '../../core/types';
import { formatNumber } from '../numbers/words';
import { addColumns, carryCount, multiplyColumns, rankCount, subtractColumns } from './columns';

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

export const SUBTRACT = 'column-arithmetic.subtract';

/** `top − bottom`, the rows set out one over the other. */
export interface SubtractionExercise extends Exercise {
  top: number;
  bottom: number;
}

interface SubtractLevel {
  mode: ColumnMode;
  /** Ranks of the top number, and of the bottom one, drawn between the two. */
  top: number;
  bottom: readonly [number, number];
  /** Carries, between the two. */
  carries: readonly [number, number];
  /** A zero in the middle of the top number, that a carry crosses: 403 − 178. */
  zero?: boolean;
}

/**
 * Levels of « poser une soustraction » (#173), by compensation, results with as many digits as
 * the top number:
 * 0. guided, 3 digits, no carry: 587 − 243;
 * 1. guided, 3 digits minus 2 or 3, one carry: 463 − 128;
 * 2. accompanied, 3 digits minus 2 or 3, one carry;
 * 3. accompanied, 3 digits, two carries;
 * 4. alone, a zero in the middle of the top number: 403 − 178;
 * 5. alone, 4 digits minus 3 or 4, two carries or more.
 */
const SUBTRACT_BY_LEVEL: readonly SubtractLevel[] = [
  { mode: 'guided', top: 3, bottom: [3, 3], carries: [0, 0] },
  { mode: 'guided', top: 3, bottom: [2, 3], carries: [1, 1] },
  { mode: 'accompanied', top: 3, bottom: [2, 3], carries: [1, 1] },
  { mode: 'accompanied', top: 3, bottom: [3, 3], carries: [2, 2] },
  { mode: 'alone', top: 3, bottom: [2, 3], carries: [1, 2], zero: true },
  { mode: 'alone', top: 4, bottom: [3, 4], carries: [2, 3] },
];

export const SUBTRACT_LEVELS = SUBTRACT_BY_LEVEL.length;

const SUBTRACT_INSTRUCTIONS: Record<ColumnMode, string> = {
  ...INSTRUCTIONS,
  alone: 'Calcule la soustraction posée.',
};

export const subtractStatement = (top: number, bottom: number) =>
  `${formatNumber(top)}${SPACE}−${SPACE}${formatNumber(bottom)}`;

export function subtraction(
  top: number,
  bottom: number,
  level: number,
  setup?: ColumnSetup,
): SubtractionExercise {
  const { mode } = SUBTRACT_BY_LEVEL[level];
  const statement = subtractStatement(top, bottom);
  return {
    skill: SUBTRACT,
    level,
    instruction: setup ? SETUP_INSTRUCTIONS[mode](statement) : SUBTRACT_INSTRUCTIONS[mode],
    statement,
    input: {
      kind: 'column',
      operator: '−',
      rows: [top, bottom],
      columns: subtractColumns(top, bottom),
      mode,
      ...(setup && { setup }),
    },
    answer: String(top - bottom),
    top,
    bottom,
  };
}

/**
 * Whether `top − bottom` fits a level: the ranks, a result with as many digits as `top` (no 0 to
 * write on the left), the carries, the zero in the middle crossed by a carry.
 */
export function fitsSubtractLevel(top: number, bottom: number, level: number): boolean {
  const settings = SUBTRACT_BY_LEVEL[level];
  const columns = subtractColumns(top, bottom);
  const carries = carryCount(columns);
  const middle = String(top).slice(1, -1);
  return (
    bottom < top &&
    rankCount(top) === settings.top &&
    rankCount(bottom) >= settings.bottom[0] &&
    rankCount(bottom) <= settings.bottom[1] &&
    rankCount(top - bottom) === settings.top &&
    carries >= settings.carries[0] &&
    carries <= settings.carries[1] &&
    (!settings.zero ||
      (middle.includes('0') &&
        columns.some((column, rank) => column.carry > 0 && String(top).at(-2 - rank) === '0')))
  );
}

export function generateSubtraction(rng: Rng, level: number): SubtractionExercise {
  const settings = SUBTRACT_BY_LEVEL[level];
  if (!settings) throw new RangeError(`niveau ${level}`);
  for (;;) {
    let top = rng.int(10 ** (settings.top - 1), 10 ** settings.top - 1);
    if (settings.zero) top -= (Math.floor(top / 10) % 10) * 10;
    const rank = rng.int(...settings.bottom);
    const bottom = rng.int(10 ** (rank - 1), 10 ** rank - 1);
    if (fitsSubtractLevel(top, bottom, level)) {
      return subtraction(top, bottom, level, drawSetup(rng, settings.mode));
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
