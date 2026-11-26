/** Days of the game: local day numbers, a new day starts at midnight on the tablet. */
const DAY_MS = 86_400_000;

export function today(): number {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / DAY_MS);
}

/** « 3 décembre », « 1er mars » for the child. */
export function dayLabel(day: number): string {
  const date = new Date(day * DAY_MS);
  const month = date.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  const number = date.getUTCDate();
  return `${number === 1 ? '1er' : number} ${month}`;
}
