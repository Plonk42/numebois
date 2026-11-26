import type { Rng } from '../../core/rng';
import { MONTHS, daysIn, weekday } from '../../core/time';
import type { Exercise } from '../../core/types';

export const CALENDAR = 'time.calendar';

export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ORDINALS = ['premier', 'deuxième', 'troisième', 'quatrième'];
/** « d’avril », « de mai ». */
const of = (month: string) => (/^[aeiou]/.test(month) ? `d’${month}` : `de ${month}`);

/**
 * Levels:
 * 0. the day of the week of a date, circled on the month;
 * 1. the date of the second (third…) Wednesday of the month;
 * 2. the date one or two weeks after a date, circled;
 * 3. without the calendar: the 12th is a Thursday, what day is the 15th?
 */
export const CALENDAR_LEVELS = 4;

export interface CalendarExercise extends Exercise {
  year: number;
  month: number;
  /** The date given, and the one asked. */
  given: number;
  asked: number;
}

/** 4 days of the week, the right one among them, in the order of the week. */
function dayChoices(rng: Rng, right: number): string[] {
  const others = WEEKDAYS.map((_, i) => i).filter((i) => i !== right);
  const picked = new Set([right]);
  while (picked.size < 4) picked.add(rng.pick(others));
  return [...picked].sort((a, b) => a - b).map((i) => WEEKDAYS[i]);
}

export function generateCalendar(rng: Rng, level: number): CalendarExercise {
  const year = rng.int(2026, 2028);
  const month = rng.int(0, 11);
  const length = daysIn(year, month);
  const name = MONTHS[month];
  const base = { skill: CALENDAR, level, year, month };
  switch (level) {
    case 0: {
      const day = rng.int(1, length);
      const right = weekday(year, month, day);
      return {
        ...base,
        instruction: 'Lis le calendrier.',
        statement: `Le ${day} ${name} : quel jour de la semaine ?`,
        figure: { kind: 'calendar', year, month, mark: day },
        input: { kind: 'choice', options: dayChoices(rng, right) },
        answer: WEEKDAYS[right],
        given: day,
        asked: day,
      };
    }
    case 1: {
      const day = rng.int(0, 6);
      const rank = rng.int(0, 3);
      const first = ((day - weekday(year, month, 1) + 7) % 7) + 1;
      const date = first + 7 * rank;
      return {
        ...base,
        instruction: 'Lis le calendrier.',
        statement: `Le ${ORDINALS[rank]} ${WEEKDAYS[day]} ${of(name)} : quelle date ?`,
        figure: { kind: 'calendar', year, month },
        input: { kind: 'keypad', maxDigits: 2 },
        answer: String(date),
        given: first,
        asked: date,
      };
    }
    case 2: {
      const weeks = rng.int(1, 2);
      const day = rng.int(1, length - 7 * weeks);
      const after = weeks === 1 ? 'Une semaine' : 'Deux semaines';
      return {
        ...base,
        instruction: 'Lis le calendrier.',
        statement: `${after} après le ${day} ${name} : quelle date ?`,
        figure: { kind: 'calendar', year, month, mark: day },
        input: { kind: 'keypad', maxDigits: 2 },
        answer: String(day + 7 * weeks),
        given: day,
        asked: day + 7 * weeks,
      };
    }
    case 3: {
      const given = rng.int(1, 20);
      let asked: number;
      do asked = rng.int(1, 28);
      while (asked === given || Math.abs(asked - given) > 10);
      const day = weekday(year, month, given);
      const right = (day + asked - given + 70) % 7;
      return {
        ...base,
        instruction: 'Trouve le jour de la semaine.',
        statement: `Le ${given} est un ${WEEKDAYS[day]}.\nQuel jour est le ${asked} ?`,
        input: { kind: 'choice', options: dayChoices(rng, right) },
        answer: WEEKDAYS[right],
        given,
        asked,
      };
    }
    default:
      throw new RangeError(`niveau ${level}`);
  }
}
