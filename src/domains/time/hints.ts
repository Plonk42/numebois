import {
  clockText,
  durationText,
  onDial,
  parseTime,
  timeText,
  weekday,
  type TimeOfDay,
} from '../../core/time';
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

/** The hands read the other way round: the hour on the minute number, the minutes on the hour. */
function swapped({ hours, minutes }: TimeOfDay, tried: TimeOfDay): boolean {
  const same = tried.hours % 12 === hours % 12 && tried.minutes === minutes;
  return (
    !same &&
    minutes % 5 === 0 &&
    tried.hours === (minutes / 5 || 12) &&
    tried.minutes === 5 * (hours % 12)
  );
}

/** What a wrong reading tells: the hands swapped, the number read, the next hour, the period (#168). */
function readingSlip(exercise: ReadClockExercise, tried: TimeOfDay): string | null {
  const { hours, minutes, seconds, period } = exercise;
  const dial = onDial(hours, minutes).hours;
  const sameHour = onDial(tried.hours, 0).hours === dial;
  if (seconds !== undefined && sameHour && tried.minutes === seconds && tried.seconds === minutes) {
    return 'Tu as échangé minutes et secondes.\nLa trotteuse, la plus fine, compte les secondes.';
  }
  if (swapped(exercise, tried)) {
    return 'Tu as lu les aiguilles à l’envers.\nLa petite montre l’heure, la grande les minutes.';
  }
  if (tried.minutes !== minutes) {
    if (sameHour && minutes % 5 === 0 && tried.minutes === minutes / 5) {
      return 'Tu as lu le chiffre, pas les minutes.\nLa grande aiguille compte de 5 en 5.';
    }
    return null;
  }
  const next = (dial % 12) + 1;
  if (minutes > 0 && onDial(tried.hours, 0).hours === next) {
    return `La petite aiguille n’est pas encore sur le ${next}.\nLis le nombre qu’elle vient de passer.`;
  }
  if (period === 'morning' && tried.hours === hours + 12) {
    return 'Le matin, garde les heures de l’horloge.';
  }
  if (period && period !== 'morning' && tried.hours === dial) {
    return `Tu as bien lu l’horloge.\nC’est ${PERIOD_WORDS[period]} : ajoute 12 aux heures.`;
  }
  return null;
}

/** 1: the mistake when recognised, else how to read it; 2: each hand read, then the time. */
export function readClockHint(exercise: ReadClockExercise, attempt: 1 | 2, tried?: Tried): string {
  if (attempt === 1) {
    const time = tried && parseTime(tried.answer);
    return (time && readingSlip(exercise, time)) || readingMethod(exercise);
  }
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

/** What hands set wrong tell: swapped, the big one on the number of minutes, one of them (#168). */
function settingSlip({ hours, minutes }: SetClockExercise, tried: TimeOfDay): string | null {
  const dial = onDial(hours, minutes);
  if (swapped(dial, tried))
    return 'La petite et la grande aiguille sont échangées.\nLa petite montre l’heure.';
  if (minutes > 0 && minutes < 12 && tried.minutes === 5 * minutes) {
    return `Tu as mis la grande aiguille sur le ${minutes}.\nElle compte de 5 en 5 : 5 minutes par chiffre.`;
  }
  if (tried.minutes === minutes) {
    return 'La grande aiguille est bien placée.\nRegarde la petite : elle montre l’heure.';
  }
  if (onDial(tried.hours, 0).hours === dial.hours) {
    return 'La petite aiguille est bien placée.\nLa grande : 5 minutes par chiffre.';
  }
  return null;
}

/** 1: the mistake when recognised, else the hour hand first, then the minute hand; 2: where each one goes. */
export function setClockHint(exercise: SetClockExercise, attempt: 1 | 2, tried?: Tried): string {
  const { hours, minutes, period } = exercise;
  const dial = onDial(hours, minutes);
  if (attempt === 1) {
    const time = tried && parseTime(tried.answer);
    const slip = time && settingSlip(exercise, time);
    if (slip) return slip;
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

/** The answer tried as a duration in minutes: minutes, hours, a duration or the end time. */
function triedLength({ level, start }: DurationExercise, tried: Tried): number | null {
  if (level < 3) {
    const n = triedNumber(tried);
    if (n === null) return null;
    return level === 1 ? n * 60 : n;
  }
  const time = parseTime(tried.answer);
  if (!time) return null;
  return time.hours * 60 + time.minutes - (level === 4 ? start : 0);
}

/** 100 minutes to the hour, the end minutes copied, 5 minutes or an hour off (#168). */
function durationSlip(exercise: DurationExercise, tried: Tried): string | null {
  const { level, start, end } = exercise;
  const length = end - start;
  const t = triedLength(exercise, tried);
  if (t === null || t === length) return null;
  const hundreds =
    (Math.floor(end / 60) - Math.floor(start / 60)) * 100 + (end % 60) - (start % 60);
  if (level === 2 && t === hundreds) {
    return 'Une heure, c’est 60 min, pas 100.\nFais un bond jusqu’à l’heure pile, puis continue.';
  }
  if ((level === 0 || level === 2) && t === end % 60) {
    return `${end % 60}, ce sont les minutes de la fin.\nCompte du début à la fin.`;
  }
  if (Math.abs(t - length) === 5 && level !== 1) {
    return `Tu es à 5 min près.\n${durationMethod(exercise)}`;
  }
  if (level < 3 || Math.abs(t - length) !== 60) return null;
  if (level === 4 && t < length && (start % 60) + (length % 60) >= 60) {
    return 'Les minutes sont bonnes.\nTu passes l’heure pile : l’heure avance de 1.';
  }
  return 'Les minutes sont bonnes.\nRecompte les bonds d’une heure.';
}

/** How the jumps go, at each level. */
function durationMethod({ level, start, end }: DurationExercise): string {
  if (level === 0) return 'Compte les minutes de 5 en 5,\ndu début à la fin.';
  if (level === 1) return 'Un bond, une heure : compte les bonds.';
  if (level === 2) return 'Fais un bond jusqu’à l’heure pile, puis continue.';
  if (level === 3) return 'Un bond, une heure.\nPuis compte les minutes du dernier bond.';
  const add = `Ajoute ${durationText(end - start)} à ${clockText(start)}.`;
  return end - start > 60
    ? `${add}\nD’abord les heures, puis les minutes.`
    : `${add}\nVa d’abord jusqu’à l’heure pile.`;
}

/** 1: the mistake when recognised, else how the jumps go; 2: each jump, then the duration or the end. */
export function durationHint(exercise: DurationExercise, attempt: 1 | 2, tried?: Tried): string {
  const { level, start, end } = exercise;
  const length = end - start;
  if (attempt === 1) return (tried && durationSlip(exercise, tried)) || durationMethod(exercise);
  if (level === 0) return `De ${clockText(start)} à ${clockText(end)} : ${length} min.`;
  if (level === 1) return `De ${clockText(start)} à ${clockText(end)} : ${length / 60} h.`;
  const lines = jumps(start, end).map(
    ([a, b]) => `${clockText(a)} → ${clockText(b)} : ${durationText(b - a)}.`,
  );
  const total = level === 4 ? `Fin à ${clockText(end)}.` : `En tout : ${durationText(length)}.`;
  return [...lines, total].join('\n');
}

/** A day next to the right one, a week or a day off (#168). */
function calendarSlip(exercise: CalendarExercise, tried: Tried): string | null {
  const { level, asked } = exercise;
  if (level === 0 || level === 3) {
    const [day, right] = [tried.answer, exercise.answer].map((d) => WEEKDAYS.indexOf(d));
    if (day < 0 || ((day - right + 7) % 7 !== 1 && (right - day + 7) % 7 !== 1)) return null;
    if (level === 0) {
      return 'C’est le jour d’à côté.\nRemonte bien droit jusqu’au nom de la colonne.';
    }
    return 'Tu es à 1 jour près.\nTous les 7 jours, le même jour revient.';
  }
  const date = triedNumber(tried);
  if (date === asked + 7) return 'Une semaine de trop : une ligne plus haut.';
  if (date === asked - 7) return 'Il manque une semaine : une ligne plus bas.';
  if (date !== null && Math.abs(date - asked) === 1) {
    return `Tu es à 1 jour près.\n${calendarHint(exercise, 1)}`;
  }
  return null;
}

/** 1: the mistake when recognised, else where to look; 2: the line or the weeks that give the answer. */
export function calendarHint(exercise: CalendarExercise, attempt: 1 | 2, tried?: Tried): string {
  const slip = attempt === 1 && tried && calendarSlip(exercise, tried);
  if (slip) return slip;
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
