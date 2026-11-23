import { hasEmptyRank, type WriteDigitsExercise } from './generators';
import { formatNumber, numberWordParts } from './words';

const RANKS = [
  ['millier', 'milliers'],
  ['centaine', 'centaines'],
  ['dizaine', 'dizaines'],
  ['unité', 'unités'],
] as const;

/** « 3 milliers, 2 centaines, 4 dizaines, 0 unité » (10 000: « 10 milliers, … »). */
function rankCount(value: number): string {
  const digits = [
    Math.floor(value / 1000),
    Math.floor(value / 100) % 10,
    Math.floor(value / 10) % 10,
    value % 10,
  ];
  const first = value >= 1000 ? 0 : 1;
  return digits
    .slice(first)
    .map((digit, i) => `${digit} ${RANKS[first + i][digit >= 2 ? 1 : 0]}`)
    .join(', ');
}

/** First line: the words cut by rank; second line: the method or the answer. */
export function writeDigitsHint(exercise: WriteDigitsExercise, attempt: 1 | 2): string {
  const { value } = exercise;
  const parts = numberWordParts(value).join(' · ');
  if (attempt === 2) return `${parts}\n${rankCount(value)} : ${formatNumber(value)}.`;
  if (hasEmptyRank(value)) return `${parts}\nUn chiffre par rang. Un rang vide, c’est 0.`;
  const ranks =
    value >= 1000 ? 'milliers, centaines, dizaines, unités' : 'centaines, dizaines, unités';
  return `${parts}\nUn chiffre par rang : ${ranks}.`;
}
