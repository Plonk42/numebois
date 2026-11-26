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
