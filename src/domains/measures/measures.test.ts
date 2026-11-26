import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { DRAWING_AREA, segmentLength } from '../../core/sheet';
import { DRAW_LEVELS, MEASURE_LEVELS, generateDraw, generateMeasure } from './generators';
import { validateDrawing } from './validate';

const SEEDS = 1000;
const levels = (count: number) => Array.from({ length: count }, (_, level) => level);
const inArea = ({ x, y }: { x: number; y: number }) =>
  x >= DRAWING_AREA.left &&
  x <= DRAWING_AREA.right &&
  y >= DRAWING_AREA.top &&
  y <= DRAWING_AREA.bottom;

describe('mesurer à la règle', () => {
  it.each(levels(MEASURE_LEVELS))(
    'level %i: 1 000 seeds, lengths exact to the millimetre',
    (level) => {
      const answers = new Set<string>();
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = generateMeasure(new Rng(seed), level);
        const { input, lengths, unit } = exercise;
        if (input.kind !== 'ruler') throw new Error(input.kind);
        expect(input.lines).toHaveLength(lengths.length);
        for (const [i, line] of input.lines.entries()) {
          expect(Number.isInteger(lengths[i])).toBe(true);
          expect(Math.abs(segmentLength(line) - lengths[i])).toBeLessThan(0.01);
          expect(inArea(line.from) && inArea(line.to), JSON.stringify(line)).toBe(true);
          // A broken line goes on from the end of the segment before.
          if (i > 0) expect(line.from).toEqual(input.lines[i - 1].to);
        }
        // The ruler at rest: its 0 left of every segment, under them.
        expect(input.ruler.x).toBeLessThan(input.lines[0].from.x - 5);
        expect(input.ruler.y).toBeGreaterThan(DRAWING_AREA.bottom);
        const total = lengths.reduce((sum, n) => sum + n, 0);
        expect(unit).toBe(level === 1 || level === 2 ? 'mm' : 'cm');
        expect(Number(exercise.answer)).toBe(unit === 'cm' ? total / 10 : total);
        if (unit === 'cm') expect(lengths.every((n) => n % 10 === 0)).toBe(true);
        if (level === 1) expect(total % 10).toBe(5);
        if (level === 2) expect(total % 5).not.toBe(0);
        const flat = input.lines.every(({ from, to }) => Math.abs(from.y - to.y) < 0.01);
        expect(flat).toBe(level < 3);
        expect(lengths).toHaveLength([1, 1, 1, 1, 2, 3][level]);
        answers.add(exercise.answer);
      }
      expect(answers.size).toBeGreaterThanOrEqual(5);
    },
  );
});

describe('tracer à la règle', () => {
  it.each(levels(DRAW_LEVELS))('level %i: 1 000 seeds, a segment that fits', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateDraw(new Rng(seed), level);
      const { input, length } = exercise;
      if (input.kind !== 'draw') throw new Error(input.kind);
      expect(inArea(input.start)).toBe(true);
      expect(input.start.x + length).toBeLessThanOrEqual(DRAWING_AREA.right);
      expect(exercise.answer).toBe(String(length));
      if (level === 0) expect(length % 10).toBe(0);
      if (level === 1) expect(length % 10).toBe(5);
      if (level === 2) expect(length % 5).not.toBe(0);
      // To the millimetre, or one off: a pencil line is that wide.
      expect(validateDrawing(exercise, String(length + 1))).toBe(true);
      expect(validateDrawing(exercise, String(length - 2))).toBe(false);
    }
  });
});
