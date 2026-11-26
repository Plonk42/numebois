import type { Rng } from '../../core/rng';
import { clockText, durationText, timeText } from '../../core/time';
import type { Exercise } from '../../core/types';

export const DURATIONS = 'time.durations';

/** Something of the day that starts and ends, and the pronoun that stands for it. */
const ACTIVITIES = [
  { name: 'la promenade', it: 'elle' },
  { name: 'le pique-nique', it: 'il' },
  { name: 'la sieste', it: 'elle' },
  { name: 'le goûter', it: 'il' },
  { name: 'la pêche', it: 'elle' },
  { name: 'le spectacle', it: 'il' },
] as const;

/**
 * Levels, on a timeline (frise) with a jump to each whole hour:
 * 0. within the hour, in minutes (14h10 to 14h45);
 * 1. whole hours (9h15 to 12h15);
 * 2. past the hour, under an hour, in minutes (14h40 to 15h10);
 * 3. more than an hour, in hours and minutes (14h10 to 15h30: 1h20);
 * 4. the end, from the start and the duration (14h10 and 45 min: 14h55).
 */
export const DURATIONS_LEVELS = 5;

export interface DurationExercise extends Exercise {
  /** Minutes since midnight. */
  start: number;
  end: number;
}

/** Minutes since midnight, a multiple of 5, between `from` and `to` hours. */
const drawStart = (rng: Rng, from: number, to: number, minutes: [number, number]) =>
  60 * rng.int(from, to) + 5 * rng.int(minutes[0] / 5, minutes[1] / 5);

function drawSpan(rng: Rng, level: number): [number, number] {
  switch (level) {
    case 0: {
      const start = drawStart(rng, 8, 17, [0, 40]);
      const room = 55 - (start % 60);
      return [start, start + 5 * rng.int(2, room / 5)];
    }
    case 1: {
      const start = drawStart(rng, 8, 15, [0, 45]);
      return [start, start + 60 * rng.int(1, 4)];
    }
    case 2: {
      const start = drawStart(rng, 8, 17, [30, 55]);
      const past = 60 - (start % 60);
      return [start, start + past + 5 * rng.int(1, (55 - past) / 5)];
    }
    case 3:
    case 4: {
      const start = drawStart(rng, 8, 16, [5, 55]);
      let length: number;
      do length = 5 * rng.int(level === 3 ? 13 : 3, 35);
      while (length % 60 === 0);
      return [start, start + length];
    }
    default:
      throw new RangeError(`niveau ${level}`);
  }
}

const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

export function generateDuration(rng: Rng, level: number): DurationExercise {
  const [start, end] = drawSpan(rng, level);
  const { name, it } = rng.pick(ACTIVITIES);
  const from = clockText(start);
  const to = clockText(end);
  const base = {
    skill: DURATIONS,
    level,
    instruction: level === 4 ? 'Trouve l’heure de la fin.' : 'Calcule la durée.',
    start,
    end,
  };
  if (level === 4) {
    return {
      ...base,
      statement: `${capital(name)} commence à ${from} et dure ${durationText(end - start)}.\nÀ quelle heure finit-${it} ?`,
      figure: { kind: 'timeline', start, end, asked: 'end' },
      input: { kind: 'time', seconds: false },
      answer: to,
    };
  }
  const figure = { kind: 'timeline', start, end, asked: 'duration' } as const;
  if (level === 3) {
    return {
      ...base,
      statement: `De ${from} à ${to}, combien de temps dure ${name} ?`,
      figure,
      input: { kind: 'time', seconds: false, duration: true },
      answer: timeText({ hours: Math.floor((end - start) / 60), minutes: (end - start) % 60 }),
    };
  }
  const hours = level === 1;
  return {
    ...base,
    statement: `De ${from} à ${to}, combien ${hours ? 'd’heures' : 'de minutes'} dure ${name} ?`,
    figure,
    input: { kind: 'keypad', maxDigits: 2 },
    answer: String(hours ? (end - start) / 60 : end - start),
  };
}
