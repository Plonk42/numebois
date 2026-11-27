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

/**
 * `a × b`, `b` of two digits (#176), set out as in class: a line for the units of `b`, a line
 * for its tens that starts with a 0 in the units, then the sum of the two lines.
 */
export function multiplyByTwoDigits(
  a: number,
  b: number,
): { partials: Column[][]; columns: Column[] } {
  const [units, tens] = [b % 10, Math.floor(b / 10)];
  const shift: Column = {
    digit: 0,
    carry: 0,
    calc: `Maintenant, je multiplie par ${tens} dizaine${tens > 1 ? 's' : ''}.`,
    say: 'J’écris d’abord un 0 dans les unités.',
  };
  // The carries of the sum wait in the bag too, as those of the two lines.
  const columns = addColumns([a * units, a * tens * 10]).map((column, rank) => {
    const say = column.say.replace(/je retiens (\d+)\./, 'je mets $1 dans le sac.');
    return { ...column, say: rank === 0 ? `J’additionne les deux lignes.\n${say}` : say };
  });
  return { partials: [multiplyColumns(a, units), [shift, ...multiplyColumns(a, tens)]], columns };
}

/** Carries of an addition: columns that send one over the next. */
export const carryCount = (columns: readonly Column[]) =>
  columns.filter((column) => column.carry > 0).length;

/**
 * The columns of `top − bottom` set out on a sheet, from the units, by compensation as the class
 * does it (#173): a top digit too small gets 10 more (« 13 − 8 = 5 »), and the carry, 1, goes
 * down beside the bottom digit of the next column, which it is added to (« 7 + 1 = 8 »).
 */
export function subtractColumns(top: number, bottom: number): Column[] {
  const columns: Column[] = [];
  let received = 0;
  for (let rank = 0; rank < rankCount(top); rank++) {
    const high = digitAt(top, rank);
    const low = digitAt(bottom, rank);
    const taken = low + received;
    const carry = high < taken ? 1 : 0;
    const digit = high + 10 * carry - taken;
    const minus = `${high + 10 * carry} − ${taken} = ${digit}`;
    let calc = minus;
    if (received > 0) {
      calc =
        rankCount(bottom) > rank
          ? `${low} + 1 = ${taken}, puis ${minus}`
          : `Il reste la retenue : ${minus}`;
    }
    let say = `J’écris ${digit}.`;
    if (carry > 0) {
      say = `${high} − ${taken}, je ne peux pas : j’ajoute 10.\nJ’écris ${digit}, je retiens 1 en bas.`;
    }
    columns.push({ digit, carry, calc, say });
    received = carry;
  }
  return columns;
}

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
