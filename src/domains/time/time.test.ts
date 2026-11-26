import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { onDial, parseTime, timeText } from '../../core/time';
import { handAngles, turnHourHand, turnMinuteHand } from '../../ui/widgets/dial';
import {
  AFTERNOON_LEVEL,
  PERIOD_WORDS,
  READ_LEVELS,
  SECONDS_LEVEL,
  SET_LEVELS,
  drawTime,
  generateReadClock,
  generateSetClock,
} from './generators';
import { validateReading, validateSetting } from './validate';

const SEEDS = 1000;
const levels = (count: number) => Array.from({ length: count }, (_, level) => level);

/** What the minutes of each level may be. */
const MINUTES_OF_LEVEL: ((minutes: number) => boolean)[] = [
  (m) => m === 0,
  (m) => m === 0 || m === 30,
  (m) => m % 15 === 0,
  (m) => m % 5 === 0,
  (m) => m % 5 !== 0,
  (m) => m % 5 === 0,
  (m) => m >= 0 && m <= 59,
];

describe('lire l’heure', () => {
  it('writes and reads a time as at school', () => {
    expect(timeText({ hours: 14, minutes: 5 })).toBe('14h05');
    expect(timeText({ hours: 3, minutes: 45, seconds: 7 })).toBe('3h45min07s');
    expect(parseTime('3h45min07s')).toEqual({ hours: 3, minutes: 45, seconds: 7 });
    expect(parseTime('14h5')).toBeNull();
    expect(onDial(0, 10)).toEqual({ hours: 12, minutes: 10 });
    expect(onDial(14, 10)).toEqual({ hours: 2, minutes: 10 });
  });

  it.each(levels(READ_LEVELS))('level %i: 1 000 seeds on the minutes of the level', (level) => {
    const answers = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateReadClock(new Rng(seed), level);
      const { hours, minutes, seconds, period } = exercise;
      expect(MINUTES_OF_LEVEL[level](minutes), exercise.answer).toBe(true);
      expect(exercise.figure).toEqual({
        kind: 'clock',
        hours,
        minutes,
        ...(seconds === undefined ? {} : { seconds }),
      });
      expect(exercise.input).toEqual({ kind: 'time', seconds: level === SECONDS_LEVEL });
      expect(period !== undefined).toBe(level === AFTERNOON_LEVEL);
      expect(parseTime(exercise.answer)).toEqual({
        hours,
        minutes,
        ...(seconds === undefined ? {} : { seconds }),
      });
      if (period) {
        expect(exercise.statement).toContain(`C’est ${PERIOD_WORDS[period]}.`);
        // In the afternoon, the hour on the clock alone is not the time.
        if (hours > 12) {
          const dial = timeText(onDial(hours, minutes));
          expect(validateReading(exercise, dial), dial).toBe(false);
        }
      } else {
        expect(hours).toBeGreaterThanOrEqual(1);
        expect(hours).toBeLessThanOrEqual(12);
        // Without a period, 3h45 and 15h45 are the same clock.
        const later = timeText({ hours: hours + 12, minutes, seconds });
        expect(validateReading(exercise, later)).toBe(hours < 12);
      }
      expect(validateReading(exercise, exercise.answer)).toBe(true);
      answers.add(exercise.answer);
    }
    expect(answers.size).toBeGreaterThanOrEqual(level === 0 ? 12 : 20);
  });

  it('refuses an unknown level and is reproducible', () => {
    expect(() => generateReadClock(new Rng(1), READ_LEVELS)).toThrow(RangeError);
    expect(() => generateSetClock(new Rng(1), SET_LEVELS)).toThrow(RangeError);
    expect(generateReadClock(new Rng(42), 4)).toEqual(generateReadClock(new Rng(42), 4));
  });
});

describe('placer les aiguilles', () => {
  it.each(levels(SET_LEVELS))('level %i: 1 000 seeds, the answer on the clock', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateSetClock(new Rng(seed), level);
      const { hours, minutes } = exercise;
      expect(MINUTES_OF_LEVEL[level](minutes), exercise.statement).toBe(true);
      expect(exercise.statement).toBe(timeText({ hours, minutes }));
      expect(exercise.answer).toBe(timeText(onDial(hours, minutes)));
      expect(exercise.input).toEqual({ kind: 'clock', step: level === 4 ? 1 : 5 });
      expect(validateSetting(exercise, exercise.answer)).toBe(true);
      expect(validateSetting(exercise, timeText(onDial(hours + 1, minutes)))).toBe(false);
    }
  });

  it('round trip of the clock on 1 000 seeds: the hands drawn, then turned by the finger', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const level = seed % READ_LEVELS;
      const { hours, minutes } = drawTime(new Rng(seed), level);
      const angles = handAngles(hours, minutes);
      // From 12h00, the finger turns the minute hand clockwise to its angle, a little at a time,
      // then takes the hour hand where it is drawn.
      let total = 0;
      for (let angle = 0; angle <= angles.minute; angle += 2) {
        total = turnMinuteHand(total, angle, 1);
      }
      total = turnMinuteHand(total, angles.minute, 1);
      total = turnHourHand(total, angles.hour);
      expect(timeText(onDial(Math.floor(total / 60), total % 60))).toBe(
        timeText(onDial(hours, minutes)),
      );
    }
  });

  it('the minute hand drives the hour hand past 12, both ways', () => {
    // 3h55, the minute hand turned to 5: 4h05; back to 50: 3h50.
    const at355 = 3 * 60 + 55;
    expect(turnMinuteHand(at355, 30, 5)).toBe(4 * 60 + 5);
    expect(turnMinuteHand(4 * 60 + 5, 300, 5)).toBe(3 * 60 + 50);
    // From 12h05 back to 11h55, and the hour hand keeps the minutes.
    expect(turnMinuteHand(5, 330, 5)).toBe(11 * 60 + 55);
    expect(turnHourHand(45, 90 + 22)).toBe(3 * 60 + 45);
  });
});
