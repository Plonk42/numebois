import type { Rng } from '../../core/rng';
import type { Exercise } from '../../core/types';

export const READ_GAUGE = 'measures.read-gauge';

interface Graduation {
  instrument: 'scale' | 'jug';
  unit: string;
  max: number;
  step: number;
  label: number;
}

/**
 * Levels, each one with more ticks between two numbers:
 * 0. a measuring jug in cL, a number on each tick of 10;
 * 1. a kitchen scale in g, a tick every 100, a number every 200;
 * 2. the jug, a tick every 5 cL, a number every 10;
 * 3. the scale, a tick every 50 g, a number every 100;
 * 4. the scale, a tick every 20 g, a number every 100.
 */
const GRADUATIONS: readonly Graduation[] = [
  { instrument: 'jug', unit: 'cL', max: 50, step: 10, label: 10 },
  { instrument: 'scale', unit: 'g', max: 1000, step: 100, label: 200 },
  { instrument: 'jug', unit: 'cL', max: 50, step: 5, label: 10 },
  { instrument: 'scale', unit: 'g', max: 1000, step: 50, label: 100 },
  { instrument: 'scale', unit: 'g', max: 1000, step: 20, label: 100 },
];
export const GAUGE_LEVELS = GRADUATIONS.length;

const WEIGHED = ['la citrouille', 'le panier de pommes', 'le sac de farine', 'le melon'];
const POURED = ['de jus', 'd’eau', 'de lait', 'de sirop'];

export interface GaugeExercise extends Exercise {
  value: number;
  step: number;
  label: number;
  unit: string;
  instrument: 'scale' | 'jug';
}

export function generateGauge(rng: Rng, level: number): GaugeExercise {
  const graduation = GRADUATIONS[level];
  if (!graduation) throw new RangeError(`niveau ${level}`);
  const { instrument, unit, max, step, label } = graduation;
  const ticks = max / step;
  // Mostly on a tick without a number, where the ticks have to be counted.
  let value: number;
  do value = step * rng.int(1, ticks - 1);
  while (value % label === 0 && step !== label && rng.chance(0.8));
  const statement =
    instrument === 'scale'
      ? `Combien pèse ${rng.pick(WEIGHED)}, en ${unit} ?`
      : `Combien ${rng.pick(POURED)}, en ${unit} ?`;
  return {
    skill: READ_GAUGE,
    level,
    instruction: instrument === 'scale' ? 'Lis la balance.' : 'Lis le verre doseur.',
    statement,
    figure: { kind: 'gauge', instrument, max, step, label, value, unit },
    input: { kind: 'keypad', maxDigits: 4 },
    answer: String(value),
    value,
    step,
    label,
    unit,
    instrument,
  };
}

/** A tick off, a number off, or the ticks counted instead of their value. */
export function gaugeLures({ value, step, label }: GaugeExercise): number[] {
  const below = Math.floor(value / label) * label;
  const counted = below + (value - below) / step;
  return [value + step, value - step, counted, value + label].filter((n) => n !== value);
}
