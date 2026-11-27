import type { Rng } from '../../core/rng';
import type { ColumnMode, ColumnSetup, Exercise, Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { addColumns, carryCount, rankCount, subtractColumns } from './columns';
import { columnSlip, COMPENSATION } from './hints';
import { drawSetup, INSTRUCTIONS, SETUP_INSTRUCTIONS } from './generators';

export const PRICES = 'column-arithmetic.prices';

/** Keeps a price on one line. */
const SPACE = '\u00a0';
/** Prices are worked in cents: the last two columns, after the comma. */
export const CENTS = 2;

/** Two prices added or one taken from the other, in cents: 456 for 4,56 €. */
export interface PriceExercise extends Exercise {
  operator: '+' | '−';
  rows: readonly [number, number];
}

/** « 4,56 » for 456 cents: the comma always, the cents always two digits. */
export const priceDigits = (cents: number) =>
  `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;

/** « 4,56 € », and a whole price in the statement as « 68 € » or « 68,00 € » (owner: both). */
export function priceText(cents: number, whole: boolean): string {
  if (cents % 100 === 0 && whole) return `${cents / 100}${SPACE}€`;
  return `${priceDigits(cents)}${SPACE}€`;
}

interface PriceLevel {
  operator: '+' | '−';
  mode: ColumnMode;
  /** Ranks of the euros of each price, drawn between the two. */
  euros: readonly (readonly [number, number])[];
  carries: number;
  /** The second price without cents: 143,45 € − 68 €. */
  whole?: boolean;
}

/**
 * Levels of « poser des prix » (#177), the comma under the comma, results as many digits as the
 * top number:
 * 0. guided addition, euros of 1 or 2 digits, a carry: 4,56 € + 15,30 €;
 * 1. accompanied addition, two carries;
 * 2. guided subtraction, euros of 2 digits, a carry: 45,30 € − 12,85 €;
 * 3. accompanied subtraction, a price without cents: 243,45 € − 68 €;
 * 4. addition alone, euros up to 3 digits, two carries;
 * 5. subtraction alone, euros of 3 digits, two carries, sometimes a price without cents.
 */
const PRICE_BY_LEVEL: readonly PriceLevel[] = [
  {
    operator: '+',
    mode: 'guided',
    euros: [
      [1, 2],
      [1, 2],
    ],
    carries: 1,
  },
  {
    operator: '+',
    mode: 'accompanied',
    euros: [
      [1, 2],
      [1, 2],
    ],
    carries: 2,
  },
  {
    operator: '−',
    mode: 'guided',
    euros: [
      [2, 2],
      [1, 2],
    ],
    carries: 1,
  },
  {
    operator: '−',
    mode: 'accompanied',
    euros: [
      [3, 3],
      [2, 2],
    ],
    carries: 1,
    whole: true,
  },
  {
    operator: '+',
    mode: 'alone',
    euros: [
      [2, 3],
      [1, 3],
    ],
    carries: 2,
  },
  {
    operator: '−',
    mode: 'alone',
    euros: [
      [3, 3],
      [2, 3],
    ],
    carries: 2,
  },
];

export const PRICE_LEVELS = PRICE_BY_LEVEL.length;

const PRICE_INSTRUCTIONS: Record<ColumnMode, string> = {
  ...INSTRUCTIONS,
  alone: 'Calcule l’opération posée.',
};

export const priceStatement = (operator: '+' | '−', rows: readonly number[], wholes: boolean) =>
  rows.map((cents) => priceText(cents, wholes)).join(`${SPACE}${operator} `);

export function priceOperation(
  operator: '+' | '−',
  rows: readonly [number, number],
  level: number,
  setup?: ColumnSetup,
  wholes = false,
): PriceExercise {
  const { mode } = PRICE_BY_LEVEL[level];
  const statement = priceStatement(operator, rows, wholes);
  const [a, b] = rows;
  return {
    skill: PRICES,
    level,
    instruction: setup ? SETUP_INSTRUCTIONS[mode](statement) : PRICE_INSTRUCTIONS[mode],
    statement,
    input: {
      kind: 'column',
      operator,
      rows,
      columns: operator === '+' ? addColumns(rows) : subtractColumns(a, b),
      mode,
      decimals: CENTS,
      ...(setup && { setup }),
    },
    answer: String(operator === '+' ? a + b : a - b),
    operator,
    rows,
  };
}

/** Whether two prices fit a level: the euros, the carries, a result without a 0 on the left. */
export function fitsPriceLevel(rows: readonly [number, number], level: number): boolean {
  const { operator, euros, carries, whole } = PRICE_BY_LEVEL[level];
  const [a, b] = rows;
  const result = operator === '+' ? a + b : a - b;
  const columns = operator === '+' ? addColumns(rows) : subtractColumns(a, b);
  return (
    rows.every((cents, i) => {
      const ranks = rankCount(Math.floor(cents / 100));
      return cents >= 100 && ranks >= euros[i][0] && ranks <= euros[i][1];
    }) &&
    result > 0 &&
    rankCount(result) === (operator === '+' ? columns.length : rankCount(a)) &&
    carryCount(columns) >= carries &&
    (!whole || b % 100 === 0)
  );
}

export function generatePrices(rng: Rng, level: number): PriceExercise {
  const settings = PRICE_BY_LEVEL[level];
  if (!settings) throw new RangeError(`niveau ${level}`);
  // A price without cents now and then at the last level.
  const whole = settings.whole || (level === PRICE_LEVELS - 1 && rng.chance(1 / 3));
  for (;;) {
    const rows = settings.euros.map(([low, high], i) => {
      const ranks = rng.int(low, high);
      const euros = rng.int(10 ** (ranks - 1), 10 ** ranks - 1);
      return euros * 100 + (whole && i === 1 ? 0 : rng.int(1, 99));
    }) as unknown as [number, number];
    if (fitsPriceLevel(rows, level) && (!whole || rows[1] % 100 === 0)) {
      const wholes = rng.fork('wholes').chance(1 / 2);
      return priceOperation(settings.operator, rows, level, drawSetup(rng, settings.mode), wholes);
    }
  }
}

const RANK_NAMES = ['centimes', 'dizaines de centimes', 'unités', 'dizaines', 'centaines'];

/** 1: the mistake when recognised, else the method; 2: the result, the comma under the comma. */
export function priceHint(exercise: PriceExercise, attempt: 1 | 2, tried?: Tried): string {
  const { operator, rows } = exercise;
  const [a, b] = rows;
  const right = Number(exercise.answer);
  if (attempt === 2) {
    return `${priceStatement(operator, rows, false)} = ${priceText(right, false)}.\nLa virgule reste sous la virgule.`;
  }
  const method =
    operator === '+'
      ? 'Calcule chaque colonne, de droite à gauche.\nLa virgule descend sous la virgule.'
      : `Calcule chaque colonne, de droite à gauche.\n${COMPENSATION}`;
  const answer = triedNumber(tried);
  if (answer === null || answer === right) return method;
  const columns = operator === '+' ? addColumns(rows) : subtractColumns(a, b);
  const carries = [0, ...columns.map((column) => column.carry)];
  const where =
    operator === '+' ? 'Elle est en haut de la colonne.' : 'Ajoute-la au chiffre du bas.';
  return columnSlip(right, carries, answer, where, operator === '+' ? 1 : -1, RANK_NAMES) ?? method;
}
