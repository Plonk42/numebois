import type { Column } from '../../core/types';
import { formatNumber } from '../numbers/words';

const digitAt = (n: number, rank: number) => Math.floor(n / 10 ** rank) % 10;

/** Ranks of a number: 1 for 7, 4 for 1 258. */
export const rankCount = (n: number) => String(n).length;

/**
 * The columns of an addition set out on a sheet, from the units: in each one, the carry
 * received then the digits of the numbers that reach it, the digit written under the line and
 * the carry over the next column, with what Plume says about it.
 */
export function addColumns(rows: readonly number[]): Column[] {
  const width = rankCount(rows.reduce((sum, n) => sum + n, 0));
  const columns: Column[] = [];
  let received = 0;
  for (let rank = 0; rank < width; rank++) {
    const terms = rows.filter((n) => rankCount(n) > rank).map((n) => digitAt(n, rank));
    const total = received + terms.reduce((sum, d) => sum + d, 0);
    const digit = total % 10;
    const carry = Math.floor(total / 10);
    const parts = [...(received > 0 ? [received] : []), ...terms];
    let calc = `${parts.join(' + ')} = ${total}`;
    let say = `J’écris ${digit}, je retiens ${carry}.`;
    if (terms.length === 0) {
      calc = `Il reste la retenue : ${received}`;
      say = `J’écris ${digit}.`;
    } else if (carry === 0) {
      say = `J’écris ${digit}.`;
    }
    columns.push({ digit, carry, calc, say });
    received = carry;
  }
  return columns;
}

/** Carries of an addition: columns that send one over the next. */
export const carryCount = (columns: readonly Column[]) =>
  columns.filter((column) => column.carry > 0).length;

/**
 * The columns of `a × b` (b of one digit) set out on a sheet, from the units, as the class says
 * it (#164): `b` times each digit of `a`, plus what waits in the bag of carries, the digit
 * written under the line and what goes into the bag for the next column (the school's « sac à
 * retenue », #49). The last digit of `a` gives a number written whole (« J'écris 10. »): the
 * columns over it are `joined` to it, with the same words.
 */
export function multiplyColumns(a: number, b: number): Column[] {
  const ranks = rankCount(a);
  const columns: Column[] = [];
  let received = 0;
  for (let rank = 0; rank < ranks; rank++) {
    const own = digitAt(a, rank);
    const product = b * own;
    const total = product + received;
    const last = rank === ranks - 1;
    const digit = total % 10;
    const carry = last ? 0 : Math.floor(total / 10);
    let calc = `${b} × ${own} = ${product}`;
    if (received > 0) {
      calc = last
        ? `${calc}, puis ${product} + ${received} = ${total}`
        : `${b} × ${own} + ${received} = ${total}`;
    }
    let say = carry > 0 ? `J’écris ${digit}, je mets ${carry} dans le sac.` : `J’écris ${digit}.`;
    if (last) say = `J’écris ${formatNumber(total)}.`;
    columns.push({ digit, carry, calc, say });
    // The number of the last column, written whole: its tens (and hundreds) on the left.
    if (last) {
      for (let rest = Math.floor(total / 10); rest > 0; rest = Math.floor(rest / 10)) {
        columns.push({ digit: rest % 10, carry: 0, calc, say, joined: true });
      }
    }
    received = carry;
  }
  return columns;
}
