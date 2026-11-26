import type { Column } from '../../core/types';

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
