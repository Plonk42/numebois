import type { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';

export const ADD = 'mental-math.add';
export const SUBTRACT = 'mental-math.subtract';
export const NINE_ELEVEN = 'mental-math.nine-eleven';
export const COMPLEMENTS = 'mental-math.complements';
export const DOUBLES_HALVES = 'mental-math.doubles-halves';
export const TIMES_TEN = 'mental-math.times-10-100';

const CALCULATE = 'Calcule de tête.';
/** Keeps an operation on one line. */
const SPACE = '\u00a0';

export type Operator = '+' | '−';

/** `a + b` or `a − b`; the answer is the result. */
export interface OperationExercise extends Exercise {
  a: number;
  op: Operator;
  b: number;
}

function operation(
  skill: string,
  level: number,
  a: number,
  op: Operator,
  b: number,
): OperationExercise {
  return {
    skill,
    level,
    instruction: CALCULATE,
    statement: `${a}${SPACE}${op}${SPACE}${b}`,
    input: { kind: 'keypad', maxDigits: 3 },
    answer: String(op === '+' ? a + b : a - b),
    a,
    op,
    b,
  };
}

function levelError(level: number): RangeError {
  return new RangeError(`niveau ${level}`);
}

/**
 * Levels of « additionner de tête », results up to 99:
 * 0. 34 + 5, without reaching the next ten;
 * 1. 38 + 5, crossing the ten;
 * 2. 34 + 20, whole tens;
 * 3. 34 + 25, units without carry;
 * 4. 38 + 27, units with a carry.
 */
export const ADD_LEVELS = 5;

export function generateAdd(rng: Rng, level: number): OperationExercise {
  const add = (a: number, b: number) => operation(ADD, level, a, '+', b);
  switch (level) {
    case 0: {
      const u = rng.int(1, 8);
      return add(rng.int(1, 9) * 10 + u, rng.int(1, 9 - u));
    }
    case 1: {
      const u = rng.int(1, 9);
      return add(rng.int(1, 8) * 10 + u, rng.int(10 - u, 9));
    }
    case 2: {
      const t = rng.int(1, 8);
      return add(t * 10 + rng.int(1, 9), rng.int(1, 9 - t) * 10);
    }
    case 3: {
      const t = rng.int(1, 8);
      const u = rng.int(0, 8);
      return add(t * 10 + u, rng.int(1, 9 - t) * 10 + rng.int(1, 9 - u));
    }
    case 4: {
      const t = rng.int(1, 7);
      const u = rng.int(1, 9);
      return add(t * 10 + u, rng.int(1, 8 - t) * 10 + rng.int(10 - u, 9));
    }
    default:
      throw levelError(level);
  }
}

/** Levels of « soustraire de tête », mirroring the addition (37 − 4, 32 − 5, 57 − 20…). */
export const SUBTRACT_LEVELS = 5;

export function generateSubtract(rng: Rng, level: number): OperationExercise {
  const subtract = (a: number, b: number) => operation(SUBTRACT, level, a, '−', b);
  switch (level) {
    case 0: {
      const u = rng.int(1, 9);
      return subtract(rng.int(1, 9) * 10 + u, rng.int(1, u));
    }
    case 1: {
      const u = rng.int(0, 8);
      return subtract(rng.int(1, 9) * 10 + u, rng.int(u + 1, 9));
    }
    case 2: {
      const t = rng.int(2, 9);
      return subtract(t * 10 + rng.int(1, 9), rng.int(1, t - 1) * 10);
    }
    case 3: {
      const t = rng.int(2, 9);
      const u = rng.int(1, 9);
      return subtract(t * 10 + u, rng.int(1, t - 1) * 10 + rng.int(1, u));
    }
    case 4: {
      const t = rng.int(3, 9);
      const u = rng.int(0, 8);
      return subtract(t * 10 + u, rng.int(1, t - 2) * 10 + rng.int(u + 1, 9));
    }
    default:
      throw levelError(level);
  }
}

/** Levels of « ajouter ou enlever 9 et 11 »: 0. 34 + 9, 34 + 11; 1. 34 − 9, 34 − 11. */
export const NINE_ELEVEN_LEVELS = 2;

export function generateNineEleven(rng: Rng, level: number): OperationExercise {
  const b = rng.pick([9, 11]);
  switch (level) {
    case 0:
      return operation(NINE_ELEVEN, level, rng.int(11, 88), '+', b);
    case 1:
      return operation(NINE_ELEVEN, level, rng.int(21, 99), '−', b);
    default:
      throw levelError(level);
  }
}

/** `given + ? = target`; the answer is the missing number. */
export interface ComplementExercise extends Exercise {
  given: number;
  target: 10 | 100;
}

/** Levels of « compléments »: 0. 3 + ? = 10; 1. 30 + ? = 100; 2. 37 + ? = 100. */
export const COMPLEMENTS_LEVELS = 3;

export function generateComplement(rng: Rng, level: number): ComplementExercise {
  let given: number;
  let target: 10 | 100 = 100;
  switch (level) {
    case 0:
      given = rng.int(1, 9);
      target = 10;
      break;
    case 1:
      given = rng.int(1, 9) * 10;
      break;
    case 2:
      given = rng.int(1, 8) * 10 + rng.int(1, 9);
      break;
    default:
      throw levelError(level);
  }
  return {
    skill: COMPLEMENTS,
    level,
    instruction: 'Trouve le nombre qui manque.',
    statement: `${given}${SPACE}+${SPACE}?${SPACE}=${SPACE}${target}`,
    input: { kind: 'keypad', maxDigits: 3 },
    answer: String(target - given),
    given,
    target,
  };
}

export interface DoubleHalfExercise extends Exercise {
  kind: 'double' | 'half';
  value: number;
}

/**
 * Levels of « doubles et moitiés »:
 * 0. double of 1 to 10;
 * 1. half of an even number up to 20;
 * 2. double of 11 to 44, without carry;
 * 3. half of 20 to 88 with even tens and units.
 */
export const DOUBLES_HALVES_LEVELS = 4;

export function generateDoubleHalf(rng: Rng, level: number): DoubleHalfExercise {
  let kind: DoubleHalfExercise['kind'] = 'double';
  let value: number;
  switch (level) {
    case 0:
      value = rng.int(1, 10);
      break;
    case 1:
      kind = 'half';
      value = 2 * rng.int(1, 10);
      break;
    case 2: {
      const t = rng.int(1, 4);
      value = t * 10 + rng.int(t === 1 ? 1 : 0, 4);
      break;
    }
    case 3:
      kind = 'half';
      value = rng.pick([20, 40, 60, 80]) + 2 * rng.int(0, 4);
      break;
    default:
      throw levelError(level);
  }
  return {
    skill: DOUBLES_HALVES,
    level,
    instruction: CALCULATE,
    statement: kind === 'double' ? `Le double de ${value}` : `La moitié de ${value}`,
    input: { kind: 'keypad', maxDigits: 3 },
    answer: String(kind === 'double' ? 2 * value : value / 2),
    kind,
    value,
  };
}

export interface TimesTenExercise extends Exercise {
  value: number;
  factor: 10 | 100;
  /** `10 × 34` rather than `34 × 10`. */
  factorFirst: boolean;
}

/**
 * Levels of « multiplier par 10 et par 100 », × 10 and × 100 mixed:
 * 0. 34 × 10, 34 × 100;
 * 1. also 10 × 34, 100 × 34.
 */
export const TIMES_TEN_LEVELS = 2;

export function generateTimesTen(rng: Rng, level: number): TimesTenExercise {
  if (level !== 0 && level !== 1) throw levelError(level);
  const factor = rng.pick([10, 100] as const);
  const value = rng.int(2, 99);
  const factorFirst = level === 1 && rng.chance(0.5);
  const [left, right] = factorFirst ? [factor, value] : [value, factor];
  return {
    skill: TIMES_TEN,
    level,
    instruction: CALCULATE,
    statement: `${left}${SPACE}×${SPACE}${right}`,
    input: { kind: 'keypad', maxDigits: 4 },
    answer: String(value * factor),
    value,
    factor,
    factorFirst,
  };
}
