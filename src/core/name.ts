/** Characters of a first name kept at most: a long one stays on a line of the cards (#138). */
export const MAX_NAME_LENGTH = 20;

const EDGES = new Set([' ', "'", '’', '-']);

function trimEdges(chars: readonly string[]): string[] {
  let start = 0;
  let end = chars.length;
  while (start < end && EDGES.has(chars[start])) start++;
  while (end > start && EDGES.has(chars[end - 1])) end--;
  return chars.slice(start, end);
}

/**
 * The first name as typed, made fit to show: letters, single spaces, hyphens and apostrophes
 * only, bounded, a capital first. Empty when nothing is left.
 */
export function cleanName(typed: string): string {
  const kept = trimEdges([...typed.normalize('NFC').replace(/[^\p{L}\p{M}'’-]+/gu, ' ')]);
  const name = trimEdges(kept.slice(0, MAX_NAME_LENGTH)).join('');
  return name.charAt(0).toLocaleUpperCase('fr') + name.slice(1);
}

/**
 * « Sentier terminé ! » for « Zébulon » : « Sentier terminé, Zébulon ! » ; unchanged without a
 * name. The name and its mark stay on one line (no-break spaces, word joiner after a hyphen).
 */
export function named(text: string, name: string): string {
  if (!name) return text;
  const whole = name.replaceAll(' ', '\u00a0').replaceAll('-', '-\u2060');
  if (!text.endsWith(' !') && !text.endsWith(' ?')) return `${text}, ${whole}`;
  return `${text.slice(0, -2)}, ${whole}\u00a0${text.at(-1)}`;
}
