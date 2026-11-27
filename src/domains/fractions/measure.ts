import type { Rng } from '../../core/rng';
import type { Exercise, NumberLine, Tried } from '../../core/types';
import { triedFraction, triedNumber } from '../../core/validate';
import { fractionText, shuffle } from './generators';
import { partsName } from './words';

export const MEASURE = 'fractions.measure';

/** Measure a strip with the ruler, or place the end of a length on it. */
export type MeasureForm = 'measure' | 'mixed' | 'place';

/**
 * Levels (#171), a ruler graduated in fractions of the unit (bande-unité graduée):
 * 0. a strip measured in quarters, up to the unit: 3/4 d'unité;
 * 1. a fraction placed on the ruler in quarters: 3/4, 1/2;
 * 2. a strip longer than the unit: 2 unités et 1/4 d'unité, among 4;
 * 3. a fraction placed on the ruler in tenths: 3/10, 1/2, 2/5;
 * 4. a strip measured in tenths, up to the unit: 7/10 d'unité.
 */
export const MEASURE_LEVELS = 5;

export interface MeasureExercise extends Exercise {
  form: MeasureForm;
  /** Parts of the unit on the ruler: 4 or 10. */
  denominator: number;
  /** Where the strip ends, or the tick to place, in parts of the unit. */
  tick: number;
  /** The fraction to place, as written in the statement (1/2 on a ruler in tenths). */
  asked?: readonly [number, number];
}

function ruler(denominator: number, units: number): NumberLine {
  return {
    from: 0,
    to: denominator * units,
    step: 1,
    labels: Array.from({ length: units + 1 }, (_, i) => i * denominator),
    denominator,
  };
}

const unitsText = (n: number) => `${n} unité${n > 1 ? 's' : ''}`;

/** « 2 unités et 1/4 d'unité ». */
export const mixedText = (whole: number, quarters: number) =>
  `${unitsText(whole)} et ${fractionText(quarters, 4)} d’unité`;

function measure(rng: Rng, level: number, denominator: number): MeasureExercise {
  const tick = rng.int(1, denominator - 1);
  return {
    skill: MEASURE,
    level,
    form: 'measure',
    denominator,
    tick,
    instruction: 'Mesure la bande avec la règle.',
    statement: 'Quelle fraction d’unité mesure la bande ?',
    figure: {
      kind: 'number-line',
      line: ruler(denominator, denominator === 4 ? 2 : 1),
      arrow: tick,
      strip: true,
    },
    input: { kind: 'fraction' },
    answer: fractionText(tick, denominator),
  };
}

function mixed(rng: Rng, level: number): MeasureExercise {
  const whole = rng.int(1, 2);
  const quarters = rng.int(1, 3);
  const right = mixedText(whole, quarters);
  const near: [number, number][] = [
    [whole, 4 - quarters],
    [whole + 1, quarters],
    [whole - 1, quarters],
    [whole, quarters === 1 ? 2 : quarters - 1],
    [whole + 1, 4 - quarters],
    [whole, quarters === 3 ? 2 : quarters + 1],
    [whole + 2, quarters],
  ];
  const lures: string[] = [];
  for (const [w, q] of near) {
    const text = mixedText(w, q);
    if (w >= 1 && text !== right && !lures.includes(text) && lures.length < 3) lures.push(text);
  }
  return {
    skill: MEASURE,
    level,
    form: 'mixed',
    denominator: 4,
    tick: whole * 4 + quarters,
    instruction: 'Mesure la bande avec la règle.',
    statement: 'Combien mesure la bande ?',
    figure: { kind: 'number-line', line: ruler(4, 3), arrow: whole * 4 + quarters, strip: true },
    input: { kind: 'choice', options: shuffle(rng, [right, ...lures]) },
    answer: right,
  };
}

/** A fraction that falls on a tick: quarters or a half on quarters; tenths, a half or fifths on tenths. */
function drawPlaced(rng: Rng, denominator: number): [number, number] {
  if (denominator === 4) return rng.chance(1 / 4) ? [1, 2] : [rng.int(1, 3), 4];
  const roll = rng.int(0, 4);
  if (roll === 0) return [1, 2];
  if (roll === 1) return [rng.int(1, 4), 5];
  return [rng.int(1, 9), 10];
}

function place(rng: Rng, level: number, denominator: number): MeasureExercise {
  const asked = drawPlaced(rng, denominator);
  const tick = (asked[0] * denominator) / asked[1];
  return {
    skill: MEASURE,
    level,
    form: 'place',
    denominator,
    tick,
    asked,
    instruction: 'Place le bout de la bande sur la règle.',
    statement: `Une bande de ${fractionText(...asked)} d’unité`,
    input: { kind: 'number-line', line: ruler(denominator, denominator === 4 ? 2 : 1) },
    answer: String(tick),
  };
}

export function generateMeasure(rng: Rng, level: number): MeasureExercise {
  if (level === 0) return measure(rng, level, 4);
  if (level === 1) return place(rng, level, 4);
  if (level === 2) return mixed(rng, level);
  if (level === 3) return place(rng, level, 10);
  if (level === 4) return measure(rng, level, 10);
  throw new RangeError(`niveau ${level}`);
}

/** The ticks counted with the 0, a part too many in the unit, the numerator placed as such (#168). */
function measureSlip(exercise: MeasureExercise, tried: Tried): string | null {
  const { form, denominator: d, tick, asked } = exercise;
  if (form === 'measure') {
    const fraction = triedFraction(tried);
    if (fraction?.[0] === tick + 1 && fraction[1] === d) {
      return 'Tu as compté le trait du 0.\nCompte les bonds depuis 0.';
    }
    if (fraction?.[1] === d + 1) {
      return `Entre 0 et 1, il y a ${d} parts, pas ${d + 1}.\nCompte les espaces, pas les traits.`;
    }
    return null;
  }
  if (form === 'place' && asked && asked[1] !== d && triedNumber(tried) === asked[0]) {
    return `${fractionText(...asked)}, ce n’est pas ${fractionText(asked[0], d)}.\nÉcris d’abord ${fractionText(...asked)} en ${partsName(d)}.`;
  }
  return null;
}

/** Where the end of the strip goes: the fraction written in the parts of the ruler first. */
function placeHint({ denominator: d, tick, asked }: MeasureExercise, attempt: 1 | 2): string {
  const [n, m] = asked!;
  if (attempt === 2) {
    const same = m === d ? '' : ` = ${fractionText(tick, d)}`;
    return `${fractionText(n, m)}${same} : ${tick} bonds depuis 0.`;
  }
  if (m !== d) {
    return `Combien de ${partsName(d)} dans ${fractionText(n, m)} ?\nPuis avance d’autant de bonds depuis 0.`;
  }
  return `L’unité est partagée en ${d} parts égales.\nAvance de ${n} bonds depuis 0.`;
}

/** 1: the mistake when recognised, else how to read the ruler; 2: the tick of the answer. */
export function measureHint(exercise: MeasureExercise, attempt: 1 | 2, tried?: Tried): string {
  const slip = attempt === 1 && tried && measureSlip(exercise, tried);
  if (slip) return slip;
  const { form, denominator: d, tick, answer } = exercise;
  if (form === 'place') return placeHint(exercise, attempt);
  if (form === 'mixed') {
    if (attempt === 1)
      return 'Compte d’abord les unités entières.\nPuis les quarts après le dernier nombre.';
    return `La bande dépasse ${Math.floor(tick / 4)} de ${tick % 4} quart${tick % 4 > 1 ? 's' : ''} :\n${answer}.`;
  }
  if (attempt === 1) {
    return `L’unité est partagée en ${d} parts égales.\nCompte les bonds de 0 au bout de la bande.`;
  }
  return `La bande s’arrête après ${tick} bonds :\n${fractionText(tick, d)} d’unité.`;
}
