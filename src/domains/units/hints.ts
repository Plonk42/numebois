import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import { formatNumber as n } from '../numbers/words';
import {
  columnsOf,
  factorOf,
  type ConvertExercise,
  type Pair,
  type RelationExercise,
} from './generators';
import { amountText, familyOf, type MagnitudeExercise, type MoneyExercise } from './everyday';

const SPACE = '\u00a0';

/** Where the relation is seen: the ruler, the table, the coins. */
function reminder({ big, small }: { big: string; small: string }): string {
  if (big === '€') return 'Une pièce de 1 € vaut 100 pièces de 1 centime.';
  return `Du ${big} au ${small} : un 0 par colonne du tableau.`;
}

/** 1: a 0 too many or too few named (#168), then where the relation is seen; 2: the relation. */
export function relationHint(
  { relation, back }: RelationExercise,
  attempt: 1 | 2,
  tried?: Tried,
): string {
  const { big, small, factor } = relation;
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const right = back ? 1 : factor;
    if (answer === right * 10) return `Un 0 de trop.\n${reminder(relation)}`;
    if (answer === right / 10) return `Il manque un 0.\n${reminder(relation)}`;
    return reminder(relation);
  }
  return `1${SPACE}${big} = ${n(factor)}${SPACE}${small}.`;
}

const ruleOf = (pair: Pair) => `1${SPACE}${pair.big} = ${n(factorOf(pair))}${SPACE}${pair.small}`;

/** Everything in the smaller unit: the zeros left out, a column too many or too few. */
function totalSlip({ pair, big, small }: ConvertExercise, answer: number): string | null {
  const factor = factorOf(pair);
  const method = `Un chiffre par colonne, jusqu’aux ${pair.small}.\nComplète avec des 0.`;
  const not = (k: number) => `${ruleOf(pair)}, pas ${n(k)}${SPACE}${pair.small}.\n${method}`;
  if (answer === Number(`${big}${small}`))
    return `Il manque des 0 dans les colonnes vides.\n${method}`;
  if (answer === big * factor * 10 + small) return not(factor * 10);
  if (answer !== big * (factor / 10) + small) return null;
  if (factor === 10 && small > 0)
    return `${big} + ${small} : ce ne sont pas les mêmes unités.\n${method}`;
  return not(factor / 10);
}

/** What is left in the smaller unit: the number of larger ones taken away, a 0 too many, 1 left. */
function smallSlip({ pair, big, small }: ConvertExercise, answer: number): string | null {
  const factor = factorOf(pair);
  const method = `${ruleOf(pair)}.\nCherche combien de ${pair.big} il y a d’abord.`;
  const larger = `${big}${SPACE}${pair.big}`;
  if (answer === big * factor + small - big) {
    return `Tu as enlevé ${big}, pas ${larger}.\n${larger} = ${n(big * factor)}${SPACE}${pair.small}.`;
  }
  if (answer === small * 10) return `Il y a un 0 de trop.\n${method}`;
  if (answer !== small + factor) return null;
  return `${n(answer)}${SPACE}${pair.small}, c’est plus que 1${SPACE}${pair.big}.\n${method}`;
}

/** Into the larger unit: the number copied, or read up to another column. */
function bigSlip({ pair, big, small }: ConvertExercise, answer: number): string | null {
  const total = big * factorOf(pair) + small;
  const method = `Arrête-toi à la colonne des ${pair.big}.`;
  if (answer === total) return `Tu as recopié ${n(total)}.\n${method}`;
  const columns = columnsOf(pair);
  const at = columns.indexOf(pair.small);
  const read = columns.slice(0, at).findLast((_, i) => {
    const reached = Math.floor(total / 10 ** (at - i));
    return reached > 0 && reached === answer;
  });
  return read ? `Tu as lu jusqu’aux ${read}.\n${method}` : null;
}

const CONVERT_SLIPS = { total: totalSlip, small: smallSlip, big: bigSlip };

/** 1: the mistake when recognised, else the table, a digit per column; 2: the conversion worked out. */
export function convertHint(exercise: ConvertExercise, attempt: 1 | 2, tried?: Tried): string {
  const { pair, big, small, asked } = exercise;
  const factor = factorOf(pair);
  const rule = `1${SPACE}${pair.big} = ${n(factor)}${SPACE}${pair.small}.`;
  const total = big * factor + small;
  if (attempt === 1) {
    const answer = triedNumber(tried);
    const slip =
      answer === null || String(answer) === exercise.answer
        ? null
        : CONVERT_SLIPS[asked](exercise, answer);
    if (slip) return slip;
    if (asked === 'small') return `${rule}\nCherche combien de ${pair.big} il y a d’abord.`;
    if (asked === 'big') {
      return `Écris ${n(total)} : son chiffre des unités dans les ${pair.small}.\nLis jusqu’à la colonne des ${pair.big}.`;
    }
    return `Un chiffre par colonne, jusqu’aux ${pair.small}.\nComplète avec des 0.`;
  }
  const larger = `${big}${SPACE}${pair.big} = ${n(big * factor)}${SPACE}${pair.small}.`;
  if (asked === 'small') return `${larger}\n${n(total)} − ${n(big * factor)} = ${small}.`;
  if (asked === 'big' && small === 0) {
    return `${rule}\n${n(total)}${SPACE}${pair.small} = ${big}${SPACE}${pair.big}.`;
  }
  if (small === 0) return `${rule}\n${big}${SPACE}${pair.big} = ${n(total)}${SPACE}${pair.small}.`;
  return `${larger}\n${n(big * factor)} + ${small} = ${n(total)}.`;
}

/** 1: the notes first, then the coins; 2: the amount, or the change counted up to 10 €. */
/** The pieces counted one by one, 1 € off, the price taken for the change (#168). */
function moneySlip({ level, cents, figure }: MoneyExercise, tried: Tried): string | null {
  if (level === 2) {
    if (tried.answer !== amountText(1000 - cents)) return null;
    return 'Ça, c’est le prix.\nCompte ce qu’il faut ajouter pour aller jusqu’à 10 €.';
  }
  const euros = triedNumber(tried);
  if (euros === null || euros * 100 === cents) return null;
  if (figure?.kind === 'money' && euros === figure.cents.length) {
    return 'Tu as compté les billets et les pièces un par un.\nRegarde ce que vaut chacun.';
  }
  if (Math.abs(euros * 100 - cents) !== 100) return null;
  return 'Tu es à 1 € près.\nCompte d’abord les billets, puis les pièces.';
}

/** 1: the mistake when recognised, else the notes then the coins; 2: the amount, or the change. */
export function moneyHint(exercise: MoneyExercise, attempt: 1 | 2, tried?: Tried): string {
  const { level, cents } = exercise;
  const slip = attempt === 1 && tried && moneySlip(exercise, tried);
  if (slip) return slip;
  if (level === 2) {
    if (attempt === 1) return 'Compte ce qu’il faut ajouter pour aller jusqu’à 10 €.';
    return `${amountText(1000 - cents)} + ${amountText(cents)} = 10${SPACE}€.`;
  }
  if (attempt === 1) return 'Compte d’abord les billets, puis les pièces.';
  return `En tout : ${amountText(cents)}.`;
}

/** 1: a unit far too big or too small named (#168), then a landmark of the family; 2: the right size. */
export function magnitudeHint({ thing }: MagnitudeExercise, attempt: 1 | 2, tried?: Tried): string {
  if (attempt === 2) return `${thing.text} ${thing.n}${SPACE}${thing.unit}.`;
  const landmark = landmarkOf(thing.unit);
  const unit = tried?.answer.split(SPACE)[1];
  const units = unit && familyOf(thing.unit);
  if (!units || unit === thing.unit || !units.includes(unit)) return landmark;
  const much =
    units.indexOf(unit) > units.indexOf(thing.unit) ? 'beaucoup trop' : 'beaucoup trop peu';
  return `${tried!.answer}, ce serait ${much}.\n${landmark}`;
}

function landmarkOf(unit: string): string {
  if (['g', 'kg'].includes(unit)) return '1 kg, c’est un paquet de farine.';
  if (['cL', 'dL', 'L'].includes(unit)) return '1 L, c’est une grande bouteille d’eau.';
  if (unit === 'dm') return '1 dm, c’est la largeur d’une main.\n1 m, c’est un grand pas.';
  return '1 cm, c’est la largeur d’un doigt.\n1 m, c’est un grand pas.';
}
