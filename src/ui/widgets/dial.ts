/** Minutes on a clock face, from 12h00 to 11h59. */
export const DIAL_MINUTES = 12 * 60;

export const wrap = (n: number, size: number) => ((n % size) + size) % size;

/** Angles of the hands, in degrees clockwise from 12. */
export function handAngles(hours: number, minutes: number, seconds = 0) {
  return {
    hour: ((hours % 12) + minutes / 60 + seconds / 3600) * 30,
    minute: (minutes + seconds / 60) * 6,
    second: seconds * 6,
  };
}

/**
 * The minute hand turned to `angle`, snapped by `step` minutes: the shortest way round, so the
 * hour hand goes on to the next hour past 12, as on a real clock. `total`: minutes on the face.
 */
export function turnMinuteHand(total: number, angle: number, step: number): number {
  const minutes = total % 60;
  const target = wrap(Math.round(angle / 6 / step) * step, 60);
  return wrap(total + wrap(target - minutes + 30, 60) - 30, DIAL_MINUTES);
}

/** The hour hand turned to `angle`: it jumps from hour to hour, the minutes stay. */
export function turnHourHand(total: number, angle: number): number {
  const minutes = total % 60;
  return wrap(Math.round(angle / 30 - minutes / 60), 12) * 60 + minutes;
}
