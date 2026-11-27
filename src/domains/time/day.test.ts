import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { daysIn, parseTime, weekday } from '../../core/time';
import { CALENDAR_LEVELS, WEEKDAYS, generateCalendar } from './calendar';
import { DURATIONS_LEVELS, generateDuration, stopsOf } from './durations';
import { unitFacts } from './facts';
import { durationHint, unitsHint } from './hints';
import { RELATIONS, UNITS_LEVELS, generateUnits, unitsLures } from './units';
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
      const stops = level === 4 ? [] : stopsOf(start, end);
      expect(exercise.figure).toEqual({
        kind: 'timeline',
        start,
        end,
        stops,
        asked: level === 4 ? 'end' : 'duration',
      });
      // Equal jumps of an hour from the start (#166): the whole hours read at once.
      if (level === 1) expect(stops).toHaveLength(length / 60 - 1);
      if (level === 1 || level === 3) {
        for (const [i, t] of stops.entries()) expect(t).toBe(start + 60 * (i + 1));
      }
      if (level === 0) expect(stops).toEqual([]);
      if (level === 2) expect(stops).toEqual([Math.ceil(start / 60) * 60]);
      const time = parseTime(exercise.answer);
      if (level === 4) expect(time).toEqual({ hours: Math.floor(end / 60), minutes: end % 60 });
      else if (level === 3)
        expect(time).toEqual({ hours: Math.floor(length / 60), minutes: length % 60 });
      else expect(Number(exercise.answer)).toBe(level === 1 ? length / 60 : length);
      expect(validateAny(exercise, exercise.answer)).toBe(true);
      // The worked hint: the hours, then the minutes; two jumps at most.
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

describe('heures, minutes et secondes : indices après une erreur (#168)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });
  const [hour] = RELATIONS;
  const at = (level: number, big: number, small: number) => {
    const exercise = { ...generateUnits(new Rng(1), level), relation: hour, big, small };
    return { ...exercise, answer: String(exercise.back ? small : big * 60 + small) };
  };

  it('100 to the hour, the numbers added, 10 off, the number copied', () => {
    const mixed = at(2, 1, 20);
    expect(unitsHint(mixed, 1, tried(120))).toBe('1\u00a0h = 60 min, pas 100 min.');
    expect(unitsHint(mixed, 1, tried(21))).toBe(
      '1 + 20 : ce ne sont pas les mêmes unités.\nChange d’abord 1 h en min.',
    );
    expect(unitsHint(mixed, 1, tried(90))).toBe('Tu es à 10 min près.\n1\u00a0h = 60 min.');
    expect(unitsHint(at(1, 3, 0), 1, tried(3))).toBe('Tu as recopié 3.\n1\u00a0h = 60 min.');
  });

  it('taken back: the total copied, one larger unit left', () => {
    expect(unitsHint(at(3, 1, 20), 1, tried(80))).toBe(
      'Tu as recopié 80.\nEnlève d’abord 1 h, c’est 60 min.',
    );
    expect(unitsHint(at(3, 2, 15), 1, tried(75))).toBe(
      '75 min, c’est plus que 1\u00a0h.\n1\u00a0h = 60 min.',
    );
  });

  it('by heart: the clock, never the relation, which is the answer', () => {
    expect(unitsHint(at(0, 1, 0), 1, tried(100))).toBe(
      'Ce n’est pas 100 min.\nEn une heure, la grande aiguille fait un tour.',
    );
  });

  it.each(levels(UNITS_LEVELS))('level %i: every lure is a recognised mistake', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateUnits(new Rng(seed), level);
      for (const lure of unitsLures(exercise)) {
        if (lure < 0 || String(lure) === exercise.answer) continue;
        // « une demi-heure = 1 min »: no 1 written to copy.
        if (!exercise.relation.one.startsWith('1') && lure === 1) continue;
        expect(unitsHint(exercise, 1, tried(lure)), `${exercise.statement} → ${lure}`).not.toBe(
          unitsHint(exercise, 1),
        );
      }
    }
  });
});
