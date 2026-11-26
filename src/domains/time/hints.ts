import { onDial, timeText } from '../../core/time';
import {
  PERIOD_WORDS,
  type DrawnTime,
  type ReadClockExercise,
  type SetClockExercise,
} from './generators';

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
