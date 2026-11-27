import { clockText, durationText, onDial, timeText, weekday } from '../../core/time';
import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { WEEKDAYS, type CalendarExercise } from './calendar';
import { stopsOf, type DurationExercise } from './durations';
import {
  PERIOD_WORDS,
  type DrawnTime,
  type ReadClockExercise,
  type SetClockExercise,
} from './generators';
import type { UnitsExercise } from './units';

/** Where the minute hand stands: on a number, or a few ticks after one. */
function minuteSpot(minutes: number): string {
  const number = Math.floor(minutes / 5) || 12;
  const ticks = minutes % 5;
  if (ticks === 0) return `sur ${number}`;
  return `${ticks} trait${ticks > 1 ? 's' : ''} après le ${number}`;
}

/** Where the hour hand stands: on the hour, or between it and the next one. */
function hourSpot(hours: number, minutes: number): string {
  const dial = onDial(hours, 0).hours;
  return minutes === 0 ? `sur ${dial}` : `entre ${dial} et ${(dial % 12) + 1}`;
}

/** The method of the level: the hour hand, the half, the quarter, 5 by 5, the ticks. */
function readingMethod({ minutes, seconds, period }: DrawnTime): string {
  if (period === 'morning') return 'Le matin, lis les heures comme sur l’horloge.';
  if (period) return `C’est ${PERIOD_WORDS[period]} : ajoute 12 aux heures de l’horloge.`;
  if (seconds !== undefined) {
    return 'La trotteuse, la plus fine, compte les secondes.\nUn petit trait, une seconde.';
  }
  if (minutes === 0) return 'La petite aiguille montre l’heure.\nLa grande sur 12 : l’heure pile.';
  if (minutes === 30) return 'La grande aiguille sur 6, c’est la demie : 30 minutes.';
  if (minutes % 15 === 0) return 'Un quart de tour de la grande aiguille fait 15 minutes.';
  if (minutes % 5 === 0) return 'La grande aiguille compte de 5 en 5 :\n5 minutes par chiffre.';
  return 'Compte de 5 en 5 jusqu’au chiffre,\npuis les petits traits un par un.';
}

/** 1: how to read it; 2: each hand read, then the time. */
export function readClockHint(exercise: ReadClockExercise, attempt: 1 | 2): string {
  if (attempt === 1) return readingMethod(exercise);
  const { hours, minutes, seconds, period } = exercise;
  const said = `Il est ${exercise.answer}.`;
  const dial = onDial(hours, minutes);
  if (period === 'morning') return `L’horloge montre ${timeText(dial)}, le matin.\n${said}`;
  if (period) {
    return `L’horloge montre ${timeText(dial)}.\n${dial.hours} + 12 = ${hours}.\n${said}`;
  }
  if (seconds !== undefined) {
    return `Les aiguilles montrent ${timeText(dial)}.\nLa trotteuse montre ${seconds} secondes.\n${said}`;
  }
  const big =
    minutes === 0
      ? 'La grande est sur 12.'
      : `La grande est ${minuteSpot(minutes)} : ${minutes} minutes.`;
  return `La petite aiguille est ${hourSpot(hours, minutes)}.\n${big}\n${said}`;
}

/** 1: the hour hand first, then the minute hand; 2: where each one goes. */
export function setClockHint({ hours, minutes, period }: SetClockExercise, attempt: 1 | 2): string {
  const dial = onDial(hours, minutes);
  if (attempt === 1) {
    if (period && period !== 'morning') return 'Après midi, enlève 12 aux heures pour l’horloge.';
    if (minutes === 0) return 'La petite aiguille sur l’heure,\nla grande sur 12.';
    return 'La petite aiguille montre l’heure.\nLa grande : 5 minutes par chiffre.';
  }
  const where = `La petite aiguille ${hourSpot(hours, minutes)},\nla grande ${minuteSpot(minutes)}.`;
  if (period && period !== 'morning') return `${hours} − 12 = ${dial.hours}.\n${where}`;
  return where;
}

/** Where a relation is seen: the clock and the calendar. */
const REMINDERS: Record<string, string> = {
  'hour-minutes': 'En une heure, la grande aiguille fait un tour.',
  'minute-seconds': 'En une minute, la trotteuse fait un tour.',
  'half-hour': 'Une heure, c’est 60 minutes : prends-en la moitié.',
  'quarter-hour': 'Un quart d’heure : la grande aiguille fait un quart de tour.',
  'day-hours': 'En un jour, la petite aiguille fait 2 tours.',
  'week-days': 'Compte les jours, de lundi à dimanche.',
  'year-months': 'Compte les mois, de janvier à décembre.',
};

/** The relation, or at level 0, where it is the answer, the clock or the calendar. */
function unitsMethod({ relation: r, level }: UnitsExercise): string {
  return level === 0 ? REMINDERS[r.key] : `${r.one} = ${r.factor} ${r.small}.`;
}

/** 100 counted to the larger unit (10 to a day, a week…), as in tens and hundreds. */
function hundredSlip({ relation: r, level }: UnitsExercise): string {
  const hundred = r.factor === 60 ? 100 : 10;
  if (level === 0) return `Ce n’est pas ${hundred} ${r.small}.\n${REMINDERS[r.key]}`;
  return `${r.one} = ${r.factor} ${r.small}, pas ${hundred} ${r.small}.`;
}

/** Taken back: the total copied, 100 taken away, one larger unit left, 10 off (#168). */
function backSlip(exercise: UnitsExercise, answer: number): string | null {
  const { relation: r, big, small } = exercise;
  const total = big * r.factor + small;
  if (answer === total) {
    return `Tu as recopié ${total}.\nEnlève d’abord ${big} ${r.big}, c’est ${big * r.factor} ${r.small}.`;
  }
  if (answer === total - (r.factor === 60 ? 100 : 10) * big) return hundredSlip(exercise);
  const method = unitsMethod(exercise);
  if (answer === small + r.factor)
    return `${answer} ${r.small}, c’est plus que ${r.one}.\n${method}`;
  return answer === small + 10 ? `Tu es à 10 ${r.small} près.\n${method}` : null;
}

/** Into the smaller unit: 100 to the larger one, 10 off, the two numbers added or copied (#168). */
function unitsSlip(exercise: UnitsExercise, answer: number): string | null {
  const { relation: r, big, small, back } = exercise;
  if (back) return backSlip(exercise, answer);
  const method = unitsMethod(exercise);
  if (answer === big * (r.factor === 60 ? 100 : 10) + small) return hundredSlip(exercise);
  if (answer === big * r.factor + small + 10) return `Tu es à 10 ${r.small} près.\n${method}`;
  if (answer !== big + small) return null;
  if (small > 0) {
    return `${big} + ${small} : ce ne sont pas les mêmes unités.\nChange d’abord ${big} ${r.big} en ${r.small}.`;
  }
  return r.one.startsWith('1') ? `Tu as recopié ${big}.\n${method}` : null;
}

/** 1: the mistake when recognised, else the relation; 2: the relation used, the larger units added one by one. */
export function unitsHint(exercise: UnitsExercise, attempt: 1 | 2, tried?: Tried): string {
  const { relation: r, big, small, back } = exercise;
  const rule = `${r.one} = ${r.factor} ${r.small}.`;
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const slip =
      answer === null || String(answer) === exercise.answer ? null : unitsSlip(exercise, answer);
    return slip ?? (exercise.level === 0 ? REMINDERS[r.key] : rule);
  }
  if (exercise.level === 0) return rule;
  const bigs = Array.from({ length: big }, () => r.factor).join(' + ');
  const larger = big * r.factor;
  if (back) {
    return `${rule}\n${larger + small} − ${larger} = ${small} ${r.small}.`;
  }
  if (small === 0) return `${rule}\n${bigs} = ${larger} ${r.small}.`;
  return `${rule}\n${larger} + ${small} = ${larger + small} ${r.small}.`;
}

/** The jumps of the timeline, the hours from the start told as one: 14h10 → 16h10, 16h10 → 16h30. */
function jumps(start: number, end: number): [number, number][] {
  const stops = stopsOf(start, end);
  if (stops.length === 0) return [[start, end]];
  const last = stops.at(-1)!;
  return stops[0] - start === 60
    ? [
        [start, last],
        [last, end],
      ]
    : [
        [start, stops[0]],
        [stops[0], end],
      ];
}

/** 1: how the jumps go; 2: each jump, then the duration or the end. */
export function durationHint({ level, start, end }: DurationExercise, attempt: 1 | 2): string {
  const length = end - start;
  if (attempt === 1) {
    if (level === 0) return 'Compte les minutes de 5 en 5,\ndu début à la fin.';
    if (level === 1) return 'Un bond, une heure : compte les bonds.';
    if (level === 2) return 'Fais un bond jusqu’à l’heure pile, puis continue.';
    if (level === 3) return 'Un bond, une heure.\nPuis compte les minutes du dernier bond.';
    const add = `Ajoute ${durationText(length)} à ${clockText(start)}.`;
    return length > 60
      ? `${add}\nD’abord les heures, puis les minutes.`
      : `${add}\nVa d’abord jusqu’à l’heure pile.`;
  }
  if (level === 0) return `De ${clockText(start)} à ${clockText(end)} : ${length} min.`;
  if (level === 1) return `De ${clockText(start)} à ${clockText(end)} : ${length / 60} h.`;
  const lines = jumps(start, end).map(
    ([a, b]) => `${clockText(a)} → ${clockText(b)} : ${durationText(b - a)}.`,
  );
  const total = level === 4 ? `Fin à ${clockText(end)}.` : `En tout : ${durationText(length)}.`;
  return [...lines, total].join('\n');
}

/** 1: where to look; 2: the line or the weeks that give the answer. */
export function calendarHint(exercise: CalendarExercise, attempt: 1 | 2): string {
  const { level, year, month, given, asked } = exercise;
  if (level === 0) {
    return attempt === 1
      ? `Trouve le ${given}, puis monte jusqu’au nom de sa colonne.`
      : `Le ${given} est dans la colonne du ${exercise.answer}.`;
  }
  if (level === 1) {
    const day = WEEKDAYS[weekday(year, month, given)];
    return attempt === 1
      ? `Descends la colonne du ${day}, semaine après semaine.`
      : `Les ${day}s : ${Array.from({ length: (asked - given) / 7 + 1 }, (_, i) => given + 7 * i).join(', ')}.`;
  }
  if (level === 2) {
    return attempt === 1
      ? 'Une semaine, c’est 7 jours : une ligne plus bas.'
      : `${given} + ${asked - given} = ${asked}.`;
  }
  if (attempt === 1) return 'Tous les 7 jours, le même jour revient.';
  const gap = asked - given;
  return `Du ${given} au ${asked} : ${Math.abs(gap)} jour${Math.abs(gap) > 1 ? 's' : ''}.\nLe ${asked} est un ${exercise.answer}.`;
}
