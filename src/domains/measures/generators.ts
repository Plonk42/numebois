import type { Rng } from '../../core/rng';
import { DRAWING_AREA, RULER_REST_Y, type Point, type Segment } from '../../core/sheet';
import type { Exercise } from '../../core/types';

export const MEASURE = 'measures.measure';
export const DRAW = 'measures.draw';

/**
 * Levels of measuring, the ruler moved by the finger:
 * 0. a segment of whole centimetres;
 * 1. in millimetres, by half centimetres (45 mm);
 * 2. in millimetres (47 mm);
 * 3. a slanting segment of whole centimetres: the ruler turns;
 * 4. a broken line of 2 segments, the total in centimetres;
 * 5. a broken line of 3 segments.
 */
export const MEASURE_LEVELS = 6;
/**
 * Levels of drawing: 0. whole centimetres; 1. millimetres by half centimetres (45 mm);
 * 2. centimetres and millimetres (7 cm 4 mm).
 */
export const DRAW_LEVELS = 3;

/** Segments drawn in whole centimetres turn by this much, at most this far. */
const SLANTS = [-45, -30, -15, 15, 30, 45];
const BROKEN_TURNS = [-60, -45, -30, 30, 45, 60];

export interface MeasureExercise extends Exercise {
  /** Lengths of the segments, in millimetres. */
  lengths: readonly number[];
  unit: 'cm' | 'mm';
}

const inside = ({ x, y }: Point) =>
  x >= DRAWING_AREA.left &&
  x <= DRAWING_AREA.right &&
  y >= DRAWING_AREA.top &&
  y <= DRAWING_AREA.bottom;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A segment from `from`, `length` mm long, turned by `angle` degrees (upwards when positive). */
function towards(from: Point, length: number, angle: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: round(from.x + length * Math.cos(rad)), y: round(from.y - length * Math.sin(rad)) };
}

/** A line of segments of these lengths and turns that fits in the drawing area, or null. */
function polyline(
  rng: Rng,
  lengths: readonly number[],
  angles: readonly number[],
): Segment[] | null {
  const span = lengths.reduce(
    (sum, length, i) => sum + length * Math.cos((angles[i] * Math.PI) / 180),
    0,
  );
  const room = DRAWING_AREA.right - DRAWING_AREA.left - span;
  if (room < 0) return null;
  let at: Point = {
    x: DRAWING_AREA.left + rng.int(0, Math.floor(room)),
    y: rng.int(DRAWING_AREA.top, DRAWING_AREA.bottom),
  };
  const lines: Segment[] = [];
  for (const [i, length] of lengths.entries()) {
    const to = towards(at, length, angles[i]);
    if (!inside(at) || !inside(to)) return null;
    lines.push({ from: at, to });
    at = to;
  }
  return lines;
}

function drawLengths(rng: Rng, level: number): number[] {
  switch (level) {
    case 0:
      return [10 * rng.int(3, 12)];
    case 1:
      return [10 * rng.int(2, 12) + 5];
    case 2: {
      let length: number;
      do length = rng.int(21, 128);
      while (length % 5 === 0);
      return [length];
    }
    case 3:
      return [10 * rng.int(4, 10)];
    case 4:
      return [10 * rng.int(3, 7), 10 * rng.int(3, 7)];
    case 5:
      return [10 * rng.int(2, 5), 10 * rng.int(2, 5), 10 * rng.int(2, 5)];
    default:
      throw new RangeError(`niveau ${level}`);
  }
}

function drawAngles(rng: Rng, level: number, count: number): number[] {
  if (level < 3) return [0];
  if (level === 3) return [rng.pick(SLANTS)];
  const angles = [rng.pick([-30, -15, 0, 15, 30])];
  while (angles.length < count) angles.push(angles.at(-1)! + rng.pick(BROKEN_TURNS));
  return angles;
}

/** The ruler at rest, under the drawing, at the left: the child slides its 0 onto a point. */
const RULER_REST: Point = { x: 3, y: RULER_REST_Y };

export function generateMeasure(rng: Rng, level: number): MeasureExercise {
  let lengths: number[];
  let lines: Segment[] | null;
  do {
    lengths = drawLengths(rng, level);
    lines = polyline(rng, lengths, drawAngles(rng, level, lengths.length));
  } while (!lines);
  const unit = level === 1 || level === 2 ? 'mm' : 'cm';
  const total = lengths.reduce((sum, n) => sum + n, 0);
  const many = lines.length > 1;
  return {
    skill: MEASURE,
    level,
    instruction: 'Mesure avec la règle.',
    statement: many ? 'Combien mesure la ligne brisée ?' : 'Combien mesure ce segment ?',
    input: { kind: 'ruler', lines, unit, ruler: RULER_REST },
    answer: String(unit === 'cm' ? total / 10 : total),
    lengths,
    unit,
  };
}

export interface DrawExercise extends Exercise {
  /** The length to draw, in millimetres. */
  length: number;
}

/** « 7 cm », « 45 mm », « 7 cm 4 mm ». */
export function lengthText(length: number, level: number): string {
  if (level === 0) return `${length / 10}\u00a0cm`;
  if (level === 1) return `${length}\u00a0mm`;
  return `${Math.floor(length / 10)}\u00a0cm ${length % 10}\u00a0mm`;
}

export function generateDraw(rng: Rng, level: number): DrawExercise {
  let length: number;
  if (level === 0) length = 10 * rng.int(3, 12);
  else if (level === 1) length = 10 * rng.int(2, 11) + 5;
  else if (level === 2) {
    do length = rng.int(21, 118);
    while (length % 5 === 0);
  } else throw new RangeError(`niveau ${level}`);
  const start = { x: rng.int(DRAWING_AREA.left, 20), y: rng.int(14, 26) };
  return {
    skill: DRAW,
    level,
    instruction: 'Trace avec la règle.',
    statement: `Trace un segment de ${lengthText(length, level)}.`,
    input: { kind: 'draw', start, ruler: RULER_REST },
    answer: String(length),
    length,
  };
}
