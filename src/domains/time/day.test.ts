import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { daysIn, parseTime, weekday } from '../../core/time';
import { CALENDAR_LEVELS, WEEKDAYS, generateCalendar } from './calendar';
import { DURATIONS_LEVELS, generateDuration } from './durations';
import { unitFacts } from './facts';
import { durationHint } from './hints';
import { RELATIONS, UNITS_LEVELS, generateUnits } from './units';
import { validateAny } from './validate';

const SEEDS = 1000;
const levels = (count: number) => Array.from({ length: count }, (_, level) => level);

describe('heures, minutes et secondes', () => {
  it.each(levels(UNITS_LEVELS))('level %i: 1 000 seeds, the answer worked out', (level) => {
    const statements = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateUnits(new Rng(seed), level);
      const { relation, big, small, back } = exercise;
      const total = big * relation.factor + small;
      expect(Number(exercise.answer)).toBe(back ? small : total);
      expect(exercise.statement.split('?')).toHaveLength(2);
      if (level === 0) expect([big, small]).toEqual([1, 0]);
      if (level === 1) expect(big).toBeGreaterThanOrEqual(2);
      if (level >= 2) {
        expect(relation.factor).toBe(60);
        expect(small % 5 === 0 && small > 0 && small < 60).toBe(true);
      }
      expect(back).toBe(level === 3);
      // Only the relations by heart are facts: the drill asks them, never a multiple.
      const fact = unitFacts.of(exercise);
      expect(fact === null).toBe(level > 0);
      statements.add(exercise.statement);
    }
    const expected = [RELATIONS.length, 12, 20, 20][level];
    expect(statements.size).toBeGreaterThanOrEqual(expected);
  });

  it('declares a fact per relation, each one asked again by the drill', () => {
    expect(unitFacts.all).toHaveLength(RELATIONS.length);
    for (const fact of unitFacts.all) {
      expect(unitFacts.of(unitFacts.exercise(fact, new Rng(1)))).toBe(fact);
    }
    const grouped = unitFacts.groups!.flatMap((group) => group.facts);
    expect([...grouped].sort()).toEqual([...unitFacts.all].sort());
  });
});

describe('les durées', () => {
  it.each(levels(DURATIONS_LEVELS))('level %i: 1 000 seeds on the timeline', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateDuration(new Rng(seed), level);
      const { start, end } = exercise;
      const length = end - start;
      expect(start % 5 === 0 && end % 5 === 0).toBe(true);
      expect(start).toBeGreaterThanOrEqual(8 * 60);
      expect(end).toBeLessThan(20 * 60);
      const sameHour = Math.floor(start / 60) === Math.floor(end / 60);
      if (level === 0) expect(sameHour && length >= 10).toBe(true);
      if (level === 1) expect(length % 60).toBe(0);
      if (level === 2) expect(!sameHour && length < 60).toBe(true);
      if (level >= 3) expect(length % 60).not.toBe(0);
      if (level === 3) expect(length).toBeGreaterThan(60);
      expect(exercise.figure).toEqual({
        kind: 'timeline',
        start,
        end,
        asked: level === 4 ? 'end' : 'duration',
      });
      const time = parseTime(exercise.answer);
      if (level === 4) expect(time).toEqual({ hours: Math.floor(end / 60), minutes: end % 60 });
      else if (level === 3)
        expect(time).toEqual({ hours: Math.floor(length / 60), minutes: length % 60 });
      else expect(Number(exercise.answer)).toBe(level === 1 ? length / 60 : length);
      expect(validateAny(exercise, exercise.answer)).toBe(true);
      // The worked hint jumps to the whole hour, then on: two jumps at most.
      expect(durationHint(exercise, 2).split('\n').length).toBeLessThanOrEqual(3);
    }
  });
});

describe('le calendrier', () => {
  it('knows the days of the week of a few dates', () => {
    // Thursday 26 November 2026; 29 February 2028 exists.
    expect(WEEKDAYS[weekday(2026, 10, 26)]).toBe('jeudi');
    expect(daysIn(2028, 1)).toBe(29);
    expect(daysIn(2027, 1)).toBe(28);
  });

  it.each(levels(CALENDAR_LEVELS))('level %i: 1 000 seeds, a date of the month', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateCalendar(new Rng(seed), level);
      const { year, month, given, asked } = exercise;
      const length = daysIn(year, month);
      expect(given >= 1 && given <= length && asked >= 1 && asked <= length).toBe(true);
      if (exercise.input.kind === 'choice') {
        expect(exercise.answer).toBe(WEEKDAYS[weekday(year, month, asked)]);
        expect(exercise.input.options).toContain(exercise.answer);
      } else {
        expect(Number(exercise.answer)).toBe(asked);
      }
      if (level === 1) expect(weekday(year, month, asked)).toBe(weekday(year, month, given));
      if (level === 1) expect(given).toBeLessThanOrEqual(7);
      if (level === 2) expect([7, 14]).toContain(asked - given);
      expect(exercise.figure === undefined).toBe(level === 3);
      expect(validateAny(exercise, exercise.answer)).toBe(true);
    }
  });
});
