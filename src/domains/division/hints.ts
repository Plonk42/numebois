import type { Tried } from '../../core/types';
import { triedNumber } from '../../core/validate';
import type { DivideExercise, ShareExercise } from './generators';

/**
 * What a wrong number tells (#168): a subtraction or a multiplication instead of a division,
 * else the product that does not give back the total (« 3 × 5 = 15, pas 18 »).
 */
function divisionSlip(total: number, by: number, tried?: Tried): string | null {
  const answer = triedNumber(tried);
  if (answer === null || answer * by === total) return null;
  if (answer === total - by) return `${answer}, c’est ${total} − ${by} : une soustraction.`;
  if (answer === total * by) return `${answer}, c’est ${total} × ${by} : une multiplication.`;
  if (answer === 0 || answer > total) return null;
  return `${by} × ${answer} = ${by * answer}, pas ${total}.`;
}

export function shareHint(exercise: ShareExercise, attempt: 1 | 2, tried?: Tried): string {
  const { ask, total, groups, per, item, group } = exercise;
  if (attempt === 2) {
    return ask === 'share'
      ? `${groups} × ${per} = ${total}, donc ${total} ÷ ${groups} = ${per}.\n${per} ${item.many} dans chaque ${group.one}.`
      : `${per} × ${groups} = ${total}, donc ${total} ÷ ${per} = ${groups}.\n${groups} ${group.many}.`;
  }
  const by = ask === 'share' ? groups : per;
  const slip = divisionSlip(total, by, tried);
  const method =
    ask === 'share'
      ? `Distribue tour à tour dans chaque ${group.one}, jusqu’au bout.`
      : `Combien de fois ${per} dans ${total} ? Cherche dans la table de ${per}.`;
  return slip ? `${slip}\n${method}` : method;
}

export function divideHint(exercise: DivideExercise, attempt: 1 | 2, tried?: Tried): string {
  const { dividend, divisor, quotient, given } = exercise;
  if (attempt === 2)
    return `${divisor} × ${quotient} = ${dividend}, donc ${dividend} ÷ ${divisor} = ${quotient}.`;
  const method = given
    ? 'La multiplication donne la réponse.'
    : `Cherche ${divisor} × ? = ${dividend} dans la table de ${divisor}.`;
  const slip = divisionSlip(dividend, divisor, tried);
  return slip ? `${slip}\n${method}` : method;
}

/** A subtraction or a multiplication instead of the division, a neighbour of the quotient. */
export function shareLures({ ask, total, groups, per }: ShareExercise): number[] {
  const [by, answer] = ask === 'share' ? [groups, per] : [per, groups];
  return [total - by, answer + 1, answer - 1].filter((n) => n > 0);
}

export function divideLures({ dividend, divisor, quotient }: DivideExercise): number[] {
  return [dividend - divisor, quotient + 1, quotient - 1].filter((n) => n > 0);
}
