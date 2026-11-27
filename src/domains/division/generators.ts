import type { Exercise, ExerciseContext, Noun } from '../../core/types';
import type { Rng } from '../../core/rng';

export const SHARE = 'division.share';
export const DIVIDE = 'division.divide';

/** Shared in equal parts (how many in each?), or put in groups of `per` (how many groups?). */
export type ShareAsk = 'share' | 'group';

export interface ShareExercise extends Exercise {
  ask: ShareAsk;
  /** What is shared, the number of groups and how many in each: `total = groups × per`. */
  total: number;
  groups: number;
  per: number;
  item: Noun;
  group: Noun;
}

interface ShareLevel {
  asks: readonly ShareAsk[];
  /** Groups and parts, drawn between the two. */
  groups: readonly [number, number];
  per: readonly [number, number];
  figure: boolean;
}

/**
 * Levels of « partager et grouper » (#175), with the things of the decor:
 * 0. share up to 20 in 2 to 4 groups, the things drawn with the empty groups;
 * 1. put up to 20 in groups of 2 to 5, the things drawn;
 * 2. both, up to 30 (6 groups or 6 in each at most), drawn;
 * 3. both, up to 50, without the drawing.
 */
const SHARE_BY_LEVEL: readonly ShareLevel[] = [
  { asks: ['share'], groups: [2, 4], per: [2, 5], figure: true },
  { asks: ['group'], groups: [2, 5], per: [2, 5], figure: true },
  { asks: ['share', 'group'], groups: [2, 6], per: [2, 6], figure: true },
  { asks: ['share', 'group'], groups: [2, 9], per: [2, 9], figure: false },
];
export const SHARE_LEVELS = SHARE_BY_LEVEL.length;
const SHARE_MAX = [20, 20, 30, 50];

const de = (word: string) => (/^[aeiouyâéèêîôœ]/i.test(word) ? `d’${word}` : `de ${word}`);

export function generateShare(rng: Rng, level: number, context: ExerciseContext): ShareExercise {
  const settings = SHARE_BY_LEVEL[level];
  if (!settings) throw new RangeError(`niveau ${level}`);
  const ask = rng.pick(settings.asks);
  const { group, item } = rng.pick(context.vocabulary.groups);
  let groups: number;
  let per: number;
  do {
    groups = rng.int(...settings.groups);
    per = rng.int(...settings.per);
  } while (groups * per > SHARE_MAX[level] || groups * per < 6);
  const total = groups * per;
  const statement =
    ask === 'share'
      ? `Partage ${total} ${item.many} dans ${groups} ${group.many}. Combien ${de(item.many)} dans chaque ${group.one}\u00a0?`
      : `Range ${total} ${item.many}, ${per} par ${group.one}. Combien ${de(group.many)}\u00a0?`;
  return {
    skill: SHARE,
    level,
    instruction: ask === 'share' ? 'Partage en parts égales.' : 'Fais des groupes égaux.',
    statement,
    ...(settings.figure && {
      figure: { kind: 'share', items: total, groups: ask === 'share' ? groups : 0 },
    }),
    input: { kind: 'keypad', maxDigits: 2 },
    answer: String(ask === 'share' ? per : groups),
    ask,
    total,
    groups,
    per,
    item,
    group,
  };
}

/** `dividend ÷ divisor = quotient`, the sign ÷ read from a multiplication. */
export interface DivideExercise extends Exercise {
  dividend: number;
  divisor: number;
  quotient: number;
  /** The multiplication given before the division (« 3 × 6 = 18, donc 18 ÷ 3 = ? »). */
  given: boolean;
}

interface DivideLevel {
  divisors: readonly number[];
  quotients: readonly [number, number];
  given: boolean;
}

/**
 * Levels of « diviser » (#175), the inverse of the multiplication:
 * 0. « 3 × 6 = 18, donc 18 ÷ 3 = ? », tables 2 to 5;
 * 1. 35 ÷ 5, tables 2, 5 and 10;
 * 2. 42 ÷ 7, tables 2 to 9;
 * 3. « 7 × 13 = 91, donc 91 ÷ 7 = ? », a quotient from 11 to 25.
 */
const DIVIDE_BY_LEVEL: readonly DivideLevel[] = [
  { divisors: [2, 3, 4, 5], quotients: [2, 9], given: true },
  { divisors: [2, 5, 10], quotients: [2, 10], given: false },
  { divisors: [2, 3, 4, 5, 6, 7, 8, 9], quotients: [2, 9], given: false },
  { divisors: [2, 3, 4, 5, 6, 7, 8, 9], quotients: [11, 25], given: true },
];
export const DIVIDE_LEVELS = DIVIDE_BY_LEVEL.length;

export function generateDivide(rng: Rng, level: number): DivideExercise {
  const settings = DIVIDE_BY_LEVEL[level];
  if (!settings) throw new RangeError(`niveau ${level}`);
  const divisor = rng.pick(settings.divisors);
  const quotient = rng.int(...settings.quotients);
  const dividend = divisor * quotient;
  const division = `${dividend}\u00a0÷\u00a0${divisor} = ?`;
  return {
    skill: DIVIDE,
    level,
    instruction: settings.given ? 'Lis la multiplication, puis divise.' : 'Divise.',
    statement: settings.given
      ? `${divisor}\u00a0×\u00a0${quotient} = ${dividend}, donc ${division}`
      : division,
    input: { kind: 'keypad', maxDigits: 2, inline: true },
    answer: String(quotient),
    dividend,
    divisor,
    quotient,
    given: settings.given,
  };
}
