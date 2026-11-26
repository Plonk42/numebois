import type { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';

export const MONEY = 'units.money';
export const MAGNITUDE = 'units.magnitude';

const SPACE = '\u00a0';

/** « 3 € 70 c », « 12 € », « 70 c ». */
export function amountText(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  if (rest === 0) return `${euros}${SPACE}€`;
  if (euros === 0) return `${rest}${SPACE}c`;
  return `${euros}${SPACE}€ ${rest}${SPACE}c`;
}

/**
 * Levels:
 * 0. notes and euro coins to count, in euros;
 * 1. coins with cents too, the amount among 4;
 * 2. the change given back from a 10 € note, among 4.
 */
export const MONEY_LEVELS = 3;

const EURO_MONEY = [2000, 1000, 500, 200, 100];
const CENT_MONEY = [500, 200, 100, 50, 20, 10, 5];

export interface MoneyExercise extends Exercise {
  /** The amount to find, in cents. */
  cents: number;
}

/** The right amount and 3 near ones (a coin forgotten or counted twice), in order. */
function amountChoices(rng: Rng, cents: number): string[] {
  const near = [10, -10, 50, -50, 100, -100].map((n) => cents + n).filter((n) => n > 0);
  const picked = new Set([cents]);
  while (picked.size < 4) picked.add(rng.pick(near));
  return [...picked].sort((a, b) => a - b).map(amountText);
}

export function generateMoney(rng: Rng, level: number): MoneyExercise {
  if (level === 2) {
    const price = 10 * rng.int(15, 95);
    const cents = 1000 - price;
    return {
      skill: MONEY,
      level,
      instruction: 'Rends la monnaie.',
      statement: `Tu paies ${amountText(price)} avec un billet de 10${SPACE}€.\nCombien te rend-on ?`,
      input: { kind: 'choice', options: amountChoices(rng, cents) },
      answer: amountText(cents),
      cents,
    };
  }
  if (level !== 0 && level !== 1) throw new RangeError(`niveau ${level}`);
  const money = level === 0 ? EURO_MONEY : CENT_MONEY;
  const count = rng.int(3, level === 0 ? 5 : 6);
  const pieces = Array.from({ length: count }, () => rng.pick(money)).sort((a, b) => b - a);
  const cents = pieces.reduce((sum, n) => sum + n, 0);
  return countMoney(pieces, level, level === 0 ? undefined : amountChoices(rng, cents));
}

/** Notes and coins to count, in euros on the keypad, or among `choices` (an astuce builds its own). */
export function countMoney(
  pieces: readonly number[],
  level: number,
  choices?: string[],
): MoneyExercise {
  const cents = pieces.reduce((sum, n) => sum + n, 0);
  return {
    skill: MONEY,
    level,
    instruction: 'Compte l’argent.',
    statement: choices ? 'Combien d’argent en tout ?' : 'Combien d’euros en tout ?',
    figure: { kind: 'money', cents: pieces },
    input: choices ? { kind: 'choice', options: choices } : { kind: 'keypad', maxDigits: 3 },
    answer: choices ? amountText(cents) : String(cents / 100),
    cents,
  };
}

/** Something to weigh up: about `n` of `unit`. */
export interface Thing {
  text: string;
  n: number;
  unit: string;
}

const LENGTHS = ['mm', 'cm', 'm', 'km'];
const MASSES = ['g', 'kg'];
const VOLUMES = ['cL', 'dL', 'L'];

const THINGS: readonly (readonly Thing[])[] = [
  [
    { text: 'Un crayon mesure environ', n: 15, unit: 'cm' },
    { text: 'Une porte mesure environ', n: 2, unit: 'm' },
    { text: 'Une fourmi mesure environ', n: 5, unit: 'mm' },
    { text: 'Le village voisin est à environ', n: 8, unit: 'km' },
    { text: 'Un pommier mesure environ', n: 4, unit: 'm' },
    { text: 'Une feuille de chêne mesure environ', n: 10, unit: 'cm' },
    { text: 'Une coccinelle mesure environ', n: 6, unit: 'mm' },
    { text: 'La rivière mesure environ', n: 30, unit: 'km' },
  ],
  [
    { text: 'Une pomme pèse environ', n: 150, unit: 'g' },
    { text: 'Un enfant de 8 ans pèse environ', n: 25, unit: 'kg' },
    { text: 'Une citrouille pèse environ', n: 4, unit: 'kg' },
    { text: 'Un gland pèse environ', n: 5, unit: 'g' },
    { text: 'Un seau contient environ', n: 10, unit: 'L' },
    { text: 'Un verre contient environ', n: 20, unit: 'cL' },
    { text: 'Un bol contient environ', n: 3, unit: 'dL' },
    { text: 'Une baignoire contient environ', n: 150, unit: 'L' },
  ],
];

/** Levels: 0. lengths; 1. masses and volumes. */
export const MAGNITUDE_LEVELS = THINGS.length;

export interface MagnitudeExercise extends Exercise {
  thing: Thing;
}

export function familyOf(unit: string): string[] {
  return [LENGTHS, MASSES, VOLUMES].find((units) => units.includes(unit))!;
}

export function generateMagnitude(rng: Rng, level: number): MagnitudeExercise {
  const things = THINGS[level];
  if (!things) throw new RangeError(`niveau ${level}`);
  const thing = rng.pick(things);
  const options = familyOf(thing.unit).map((unit) => `${thing.n}${SPACE}${unit}`);
  return {
    skill: MAGNITUDE,
    level,
    instruction: 'Choisis l’unité qui convient.',
    statement: `${thing.text} ${thing.n}…`,
    input: { kind: 'choice', options },
    answer: `${thing.n}${SPACE}${thing.unit}`,
    thing,
  };
}
