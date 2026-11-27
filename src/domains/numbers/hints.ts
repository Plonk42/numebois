import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import {
  RANK_NAMES,
  hasEmptyRank,
  signOf,
  type CompareExercise,
  type DecomposeExercise,
  type NumberLineExercise,
  type OrderExercise,
  type ReadExercise,
  type WriteDigitsExercise,
} from './generators';
import { withoutZeros } from './lures';
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

/** « Il manque un 0 » when the zeros of the empty ranks are left out, else null (#168). */
function zerosLeftOut(value: number, tried?: Tried): string | null {
  const answer = triedNumber(tried);
  if (answer === null || answer === value || answer !== withoutZeros(value)) return null;
  const missing = String(value).length - String(answer).length;
  return `Il manque ${missing > 1 ? 'des 0' : 'un 0'}`;
}

/** First line: the words cut by rank; second line: the zero left out, the method or the answer. */
export function writeDigitsHint(
  exercise: WriteDigitsExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { value } = exercise;
  const parts = numberWordParts(value).join(' · ');
  if (attempt === 2) return `${parts}\n${rankCount(value)} : ${formatNumber(value)}.`;
  const zeros = zerosLeftOut(value, tried);
  if (zeros) return `${parts}\n${zeros} : un rang vide, c’est 0.`;
  if (hasEmptyRank(value)) return `${parts}\nUn chiffre par rang. Un rang vide, c’est 0.`;
  const ranks =
    value >= 1000 ? 'milliers, centaines, dizaines, unités' : 'centaines, dizaines, unités';
  return `${parts}\nUn chiffre par rang : ${ranks}.`;
}

/** Read by slices: the thousands, then the rest. */
export function readHint({ value }: ReadExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    return value >= 1000
      ? 'Lis d’abord les milliers, puis le reste.'
      : 'Lis les centaines, puis les dizaines et les unités.';
  }
  return `${formatNumber(value)} : ${numberWordParts(value).join(' · ')}.`;
}

/** How to read each way of showing a number to compose. */
const COMPOSE_METHOD: Record<DecomposeExercise['show'], string> = {
  words: 'Un chiffre par rang. Un rang vide, c’est 0.',
  named: 'Un chiffre par rang, dans l’ordre.',
  mixed: 'Remets chaque nombre à son rang. Un rang vide, c’est 0.',
  sum: 'Chaque nombre donne le chiffre d’un rang. Un rang vide, c’est 0.',
  blocks: 'Une plaque, c’est 100. Une barre, 10. Un cube, 1.',
  table: 'Lis les chiffres du tableau, de gauche à droite.',
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count >= 2 ? 's' : ''}`;
}

/** What a wrong digit or count tells: another rank's digit, the digit alone, another count. */
function rankSlip({ value, ask, rank }: DecomposeExercise, answer: number): string | null {
  const digit = (r: number) => Math.floor(value / 10 ** r) % 10;
  const ranks = [3, 2, 1, 0].filter((r) => r !== rank && 10 ** r <= value);
  if (ask === 'digit') {
    const other = ranks.find((r) => digit(r) === answer);
    if (other === undefined) return null;
    return `${answer}, c’est le chiffre des ${RANK_NAMES[other][1]}.\nCherche celui des ${RANK_NAMES[rank][1]}.`;
  }
  if (answer === digit(rank))
    return `${answer}, c’est seulement le chiffre des ${RANK_NAMES[rank][1]}.`;
  if (answer === value) return 'Tu as recopié tout le nombre.';
  const other = ranks.find((r) => r > 0 && Math.floor(value / 10 ** r) === answer);
  if (other === undefined) return null;
  return `${formatNumber(answer)}, c’est le nombre de ${RANK_NAMES[other][1]}.`;
}

/** A zero left out, another rank's digit or count, named before the method (#168). */
function decomposeSlip(exercise: DecomposeExercise, tried?: Tried): string | null {
  const { value, ask, show } = exercise;
  if (ask === 'compose') {
    const zeros = zerosLeftOut(value, tried);
    return zeros && `${zeros}.\n${COMPOSE_METHOD[show]}`;
  }
  const answer = triedNumber(tried);
  if (answer === null || String(answer) === exercise.answer) return null;
  const slip = rankSlip(exercise, answer);
  if (!slip || ask === 'digit') return slip;
  return `${slip}\n${decomposeMethod(exercise, 1)}`;
}

/** 1: the mistake when recognised, else the method; 2: the answer rank by rank. */
export function decomposeHint(exercise: DecomposeExercise, attempt: 1 | 2, tried?: Tried): string {
  return (attempt === 1 && decomposeSlip(exercise, tried)) || decomposeMethod(exercise, attempt);
}

/** Rank by rank; an empty rank is a 0. */
function decomposeMethod(exercise: DecomposeExercise, attempt: 1 | 2): string {
  const { value, ask, rank, show } = exercise;
  const ranks = rankCount(value);
  const [one, many] = RANK_NAMES[rank];
  if (ask === 'compose') {
    if (attempt === 1) return COMPOSE_METHOD[show];
    if (show === 'blocks') {
      const [hundreds, tens, units] = [...String(value)].map(Number);
      return `${plural(hundreds, 'plaque')}, ${plural(tens, 'barre')}, ${plural(units, 'cube')} : ${formatNumber(value)}.`;
    }
    return `${ranks} : ${formatNumber(value)}.`;
  }
  if (ask === 'digit') {
    if (attempt === 1) {
      return show === 'table'
        ? `Cherche la colonne des ${many}.`
        : 'De droite à gauche : unités, dizaines, centaines, milliers.';
    }
    return `${formatNumber(value)} : ${ranks}.\nLe chiffre des ${many} est ${exercise.answer}.`;
  }
  if (attempt === 1) {
    return show === 'table'
      ? `Lis tous les chiffres, jusqu’à la colonne des ${many}.`
      : `Cache les chiffres à droite des ${many}.`;
  }
  const count = Number(exercise.answer);
  return (
    `Dans ${formatNumber(value)}, il y a ${formatNumber(count)} ${many}.\n` +
    `${formatNumber(count)} ${count >= 2 ? many : one} font ${formatNumber(count * 10 ** rank)}.`
  );
}

/** Rank by rank from the left; the point of the sign shows the smaller number. */
export function compareHint({ a, b }: CompareExercise, attempt: 1 | 2): string {
  const [x, y] = [String(a), String(b)];
  const sign = signOf(a, b);
  if (attempt === 1) {
    const method =
      x.length === y.length
        ? 'Compare rang par rang, en partant de la gauche.'
        : 'Le nombre qui a le plus de chiffres est le plus grand.';
    return `${method}\nLa pointe du signe montre le plus petit.`;
  }
  const result = `${formatNumber(a)} ${sign} ${formatNumber(b)}.`;
  if (sign === '=') return `Les deux nombres sont pareils : ${result}`;
  if (x.length !== y.length) {
    return `${formatNumber(a)} a ${x.length} chiffres, ${formatNumber(b)} en a ${y.length}.\n${result}`;
  }
  const at = [...x].findIndex((digit, i) => digit !== y[i]);
  const rank = RANK_NAMES[x.length - 1 - at][1];
  return `Premier rang différent : les ${rank}, ${x[at]} ${sign} ${y[at]}.\n${result}`;
}

/** Compare like two numbers, then all of them. */
export function orderHint({ values, want }: OrderExercise, attempt: 1 | 2): string {
  if (attempt === 1) {
    const largest = Math.max(...values);
    return largest >= 1000
      ? 'Regarde d’abord les milliers, puis les centaines.'
      : 'Regarde d’abord les centaines, puis les dizaines.';
  }
  const sorted = [...values].sort((p, q) => p - q).map((v) => formatNumber(v));
  const target = want === 'largest' ? sorted.at(-1) : sorted[0];
  return `Rangés : ${sorted.join(' < ')}.\nLe plus ${want === 'largest' ? 'grand' : 'petit'} : ${target}.`;
}

/** From the closest written number, tick by tick; a tick or two away named first (#168). */
export function numberLineHint(
  { line, value }: NumberLineExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const start = line.labels.reduce((best, label) =>
    Math.abs(label - value) < Math.abs(best - value) ? label : best,
  );
  const forward = value > start;
  const step = formatNumber(line.step);
  if (attempt === 1) {
    const method = `Pars de ${formatNumber(start)} et ${forward ? 'avance' : 'recule'} de ${step} en ${step}.`;
    const answer = triedNumber(tried);
    const off = answer === null ? 0 : Math.abs(answer - value) / line.step;
    if (off === 1 || off === 2) return `Tu es à ${off} trait${off > 1 ? 's' : ''} près.\n${method}`;
    return method;
  }
  const count = Math.abs(value - start) / line.step;
  const ticks = `${count} trait${count > 1 ? 's' : ''} de ${step}${forward ? '' : ' en arrière'}`;
  return `Depuis ${formatNumber(start)}, ${ticks} : ${formatNumber(value)}.`;
}
