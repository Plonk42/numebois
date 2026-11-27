import type { Tried } from '../../core/types';
import { triedFraction, triedNumber } from '../../core/validate';
import { fractionText, type ReadExercise } from './generators';
import { fractionWords, partsName } from './words';

/** « 1 part », « 3 parts ». */
export const partsText = (n: number) => `${n} part${n > 1 ? 's' : ''}`;

/** The numbers the other way round, the white parts counted in or alone (#168). */
function readSlip(exercise: ReadExercise, tried: Tried): string | null {
  if (exercise.form === 'colour') return colourSlip(exercise, tried);
  if (exercise.form === 'words') return wordsSlip(exercise, tried);
  const fraction = triedFraction(tried);
  if (!fraction) return null;
  const { numerator: n, denominator: d } = exercise;
  const [a, b] = fraction;
  if (a === d && b === n && a !== b) {
    return 'Le nombre du haut compte les parts coloriées.\nCelui du bas compte toutes les parts.';
  }
  if (a === n && b === d - n) {
    return 'En bas, compte toutes les parts.\nAussi celles qui ne sont pas coloriées.';
  }
  if (a === d - n && b === d && a > 0) {
    return 'Tu as compté les parts qui ne sont pas coloriées.\nEn haut, compte les parts coloriées.';
  }
  return null;
}

function colourSlip({ numerator, denominator }: ReadExercise, tried: Tried): string | null {
  const count = triedNumber(tried);
  if (count === null || count === numerator || count === 0) return null;
  return `Tu as colorié ${partsText(count)} : c’est ${fractionText(count, denominator)}.\nLe nombre du haut dit combien en colorier.`;
}

function wordsSlip({ numerator, denominator }: ReadExercise, tried: Tried): string | null {
  if (numerator >= 2 && numerator !== denominator) {
    const swapped = fractionWords(denominator, numerator);
    if (tried.answer === swapped) {
      return 'Tu as lu le nombre du bas en premier.\nOn lit d’abord le nombre du haut.';
    }
  }
  const [, name] = tried.answer.split(' ');
  if (name && name !== partsName(denominator, true) && name !== partsName(denominator)) {
    return `En bas, il y a ${denominator} : ce sont des ${partsName(denominator)}.`;
  }
  return null;
}

/** 1: the mistake when recognised, else what each number tells; 2: the parts counted. */
export function readHint(exercise: ReadExercise, attempt: 1 | 2, tried?: Tried): string {
  const slip = attempt === 1 && tried && readSlip(exercise, tried);
  if (slip) return slip;
  const { form, numerator: n, denominator: d } = exercise;
  const fraction = fractionText(n, d);
  if (form === 'words') {
    if (attempt === 1) {
      return `On lit le nombre du haut, puis le nom des parts.\nEn bas ${d} : des ${partsName(d)}.`;
    }
    return `${fraction} se lit «\u00a0${fractionWords(n, d)}\u00a0».`;
  }
  if (form === 'colour') {
    if (attempt === 1) {
      return 'Le nombre du bas dit en combien de parts.\nLe nombre du haut dit combien en colorier.';
    }
    return `Colorie ${partsText(n)} sur les ${d} : ${fraction}.`;
  }
  if (attempt === 1) {
    return 'En bas : le nombre de parts égales en tout.\nEn haut : le nombre de parts coloriées.';
  }
  const coloured = n > 1 ? 'coloriées' : 'coloriée';
  return `${partsText(n)} ${coloured} sur ${d} en tout :\nc’est ${fraction}.`;
}
