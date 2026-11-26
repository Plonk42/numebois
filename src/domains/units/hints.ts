import { TABLES, type ConvertExercise, type RelationExercise } from './generators';
import { amountText, type MagnitudeExercise, type MoneyExercise } from './everyday';

const SPACE = '\u00a0';

/** Where the relation is seen: the ruler, the table, the coins. */
function reminder({ big, small }: { big: string; small: string }): string {
  if (big === '€') return 'Une pièce de 1 € vaut 100 pièces de 1 centime.';
  return `Du ${big} au ${small} : un 0 par colonne du tableau.`;
}

/** 1: where the relation is seen; 2: the relation. */
export function relationHint({ relation }: RelationExercise, attempt: 1 | 2): string {
  const { big, small, factor } = relation;
  if (attempt === 1) return reminder(relation);
  return `1${SPACE}${big} = ${factor}${SPACE}${small}.`;
}

/** 1: the table, a digit per column; 2: the conversion worked out. */
export function convertHint({ pair, big, small, back }: ConvertExercise, attempt: 1 | 2): string {
  const units: readonly string[] = TABLES[pair.family];
  const factor = 10 ** (units.indexOf(pair.small) - units.indexOf(pair.big));
  const rule = `1${SPACE}${pair.big} = ${factor}${SPACE}${pair.small}.`;
  if (attempt === 1) {
    if (back) return `${rule}\nCherche combien de ${pair.big} il y a d’abord.`;
    return `Un chiffre par colonne, jusqu’aux ${pair.small}.\nComplète avec des 0.`;
  }
  const total = big * factor + small;
  if (back) {
    return `${big}${SPACE}${pair.big} = ${big * factor}${SPACE}${pair.small}.\n${total} − ${big * factor} = ${small}.`;
  }
  if (small === 0) return `${rule}\n${big}${SPACE}${pair.big} = ${total}${SPACE}${pair.small}.`;
  return `${big}${SPACE}${pair.big} = ${big * factor}${SPACE}${pair.small}.\n${big * factor} + ${small} = ${total}.`;
}

/** 1: the notes first, then the coins; 2: the amount, or the change counted up to 10 €. */
export function moneyHint({ level, cents }: MoneyExercise, attempt: 1 | 2): string {
  if (level === 2) {
    if (attempt === 1) return 'Compte ce qu’il faut ajouter pour aller jusqu’à 10 €.';
    return `${amountText(1000 - cents)} + ${amountText(cents)} = 10${SPACE}€.`;
  }
  if (attempt === 1) return 'Compte d’abord les billets, puis les pièces.';
  return `En tout : ${amountText(cents)}.`;
}

/** 1: a landmark of the family; 2: the right size. */
export function magnitudeHint({ thing }: MagnitudeExercise, attempt: 1 | 2): string {
  if (attempt === 2) return `${thing.text} ${thing.n}${SPACE}${thing.unit}.`;
  if (['g', 'kg'].includes(thing.unit)) return '1 kg, c’est un paquet de farine.';
  if (['cL', 'dL', 'L'].includes(thing.unit)) return '1 L, c’est une grande bouteille d’eau.';
  return '1 cm, c’est la largeur d’un doigt.\n1 m, c’est un grand pas.';
}
