/** A time of the day, as a `time` or `clock` input returns it. */
export interface TimeOfDay {
  hours: number;
  minutes: number;
  seconds?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Written as at school (owner): « 14h10 », « 3h00 », with seconds « 3h45min20s ». */
export function timeText({ hours, minutes, seconds }: TimeOfDay): string {
  const text = `${hours}h${pad(minutes)}`;
  return seconds === undefined ? text : `${text}min${pad(seconds)}s`;
}

/** The time of `timeText`, or null; the numbers are not checked against a clock. */
export function parseTime(text: string): TimeOfDay | null {
  const match = /^(\d{1,2})h(\d{2})(?:min(\d{2})s)?$/.exec(text);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return {
    hours: Number(hours),
    minutes: Number(minutes),
    ...(seconds === undefined ? {} : { seconds: Number(seconds) }),
  };
}

/** The time a clock face shows, from 1h00 to 12h59. */
export function onDial(hours: number, minutes: number): TimeOfDay {
  return { hours: hours % 12 || 12, minutes };
}

/** A time of the day given in minutes since midnight: « 14h10 ». */
export function clockText(minutes: number): string {
  return timeText({ hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/** A duration as written in a sentence: « 45 min », « 2 h », « 1 h 20 min ». */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}\u00a0min`;
  return rest === 0 ? `${hours}\u00a0h` : `${hours}\u00a0h\u00a0${rest}\u00a0min`;
}

export const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Day of the week of a date, 0 for Monday (a given date: no clock is read). */
export function weekday(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
}

export function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
