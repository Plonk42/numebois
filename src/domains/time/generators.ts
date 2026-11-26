import type { Rng } from '../../core/rng';
import { onDial, timeText, type TimeOfDay } from '../../core/time';
import type { Exercise } from '../../core/types';

export const READ_CLOCK = 'time.read-clock';
export const SET_CLOCK = 'time.set-clock';

/** Said in the statement from the level of the afternoon: 14h10 is 2h10 on the clock. */
export type Period = 'morning' | 'afternoon' | 'evening';

export const PERIOD_WORDS: Record<Period, string> = {
  morning: 'le matin',
  afternoon: 'l’après-midi',
  evening: 'le soir',
};

/**
 * Levels, to read the time and to set the hands:
 * 0. o'clock;
 * 1. half past (and o'clock);
 * 2. quarters;
 * 3. 5 by 5 minutes;
 * 4. to the minute;
 * 5. the morning, the afternoon or the evening said: 14h10 is 2h10 on the clock (5 by 5);
 * 6. reading only: the seconds too, on the second hand.
 */
export const READ_LEVELS = 7;
export const SET_LEVELS = 6;
export const AFTERNOON_LEVEL = 5;
export const SECONDS_LEVEL = 6;

/** A time of the level; `hours` from 1 to 12, or from 0 to 23 when the period is said. */
export interface DrawnTime extends TimeOfDay {
  period?: Period;
}

const QUARTERS = [0, 15, 30, 45];

function drawMinutes(rng: Rng, level: number): number {
  switch (level) {
    case 0:
      return 0;
    case 1:
      return rng.pick([0, 30, 30]);
    case 2:
      return rng.pick([15, 45, 15, 45, 0, 30]);
    case 3: {
      // Mostly the minutes that are not a quarter: the quarters come at the level before.
      const fives = rng.chance(0.8) ? [5, 10, 20, 25, 35, 40, 50, 55] : QUARTERS;
      return rng.pick(fives);
    }
    case 4: {
      let minutes: number;
      do minutes = rng.int(1, 59);
      while (minutes % 5 === 0);
      return minutes;
    }
    default:
      return 5 * rng.int(0, 11);
  }
}

const PERIOD_HOURS: Record<Period, [number, number]> = {
  morning: [6, 11],
  afternoon: [13, 17],
  evening: [18, 22],
};

export function drawTime(rng: Rng, level: number): DrawnTime {
  if (!Number.isInteger(level) || level < 0 || level >= READ_LEVELS) {
    throw new RangeError(`niveau ${level}`);
  }
  if (level === AFTERNOON_LEVEL) {
    // The afternoon and the evening, where the hours change, more often than the morning.
    const period = rng.pick<Period>(['morning', 'afternoon', 'afternoon', 'evening']);
    const [from, to] = PERIOD_HOURS[period];
    return { hours: rng.int(from, to), minutes: drawMinutes(rng, level), period };
  }
  const hours = rng.int(1, 12);
  if (level === SECONDS_LEVEL) {
    return { hours, minutes: rng.int(0, 59), seconds: rng.int(1, 59) };
  }
  return { hours, minutes: drawMinutes(rng, level) };
}

/** Reading the clock: the time typed in its boxes, the period added when it is said. */
export interface ReadClockExercise extends Exercise, DrawnTime {}

export function generateReadClock(rng: Rng, level: number): ReadClockExercise {
  return readClock(drawTime(rng, level), level);
}

export function readClock(time: DrawnTime, level: number): ReadClockExercise {
  const { hours, minutes, seconds, period } = time;
  const question = 'Quelle heure est-il ?';
  return {
    skill: READ_CLOCK,
    level,
    instruction: 'Lis l’heure sur l’horloge.',
    statement: period ? `C’est ${PERIOD_WORDS[period]}.\n${question}` : question,
    figure: { kind: 'clock', hours, minutes, ...(seconds === undefined ? {} : { seconds }) },
    input: { kind: 'time', seconds: seconds !== undefined },
    answer: timeText(time),
    ...time,
  };
}

/** Setting the hands on a written time: the clock shows it from 1h00 to 12h59. */
export interface SetClockExercise extends Exercise, DrawnTime {}

export function generateSetClock(rng: Rng, level: number): SetClockExercise {
  if (level >= SET_LEVELS) throw new RangeError(`niveau ${level}`);
  return setClock(drawTime(rng, level), level);
}

export function setClock(time: DrawnTime, level: number): SetClockExercise {
  const { hours, minutes } = time;
  return {
    skill: SET_CLOCK,
    level,
    instruction: 'Place les aiguilles de l’horloge.',
    statement: timeText({ hours, minutes }),
    input: { kind: 'clock', step: level === 4 ? 1 : 5 },
    answer: timeText(onDial(hours, minutes)),
    ...time,
  };
}
