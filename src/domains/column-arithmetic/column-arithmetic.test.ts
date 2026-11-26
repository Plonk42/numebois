import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { addColumns, carryCount } from './columns';
import { ADD_LEVELS, fitsAddLevel, generateAddition } from './generators';
import { additionHint } from './hints';

const MODES = ['guided', 'guided', 'accompanied', 'accompanied', 'alone', 'alone'];

describe('poser une addition', () => {
  it('a une règle par niveau, sur 1 000 graines', () => {
    expect(MODES).toHaveLength(ADD_LEVELS);
    for (let level = 0; level < ADD_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateAddition(new Rng(seed), level);
        const { rows, input } = exercise;
        expect(fitsAddLevel(rows, level), `${rows.join(' + ')} au niveau ${level}`).toBe(true);
        expect(input.kind === 'column' && input.mode).toBe(MODES[level]);
        expect(Number(exercise.answer)).toBeLessThanOrEqual(9999);
      }
    }
  });

  it('pose les chiffres et les retenues d’un calcul direct, sur 1 000 graines', () => {
    for (let level = 0; level < ADD_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const { rows, answer } = generateAddition(new Rng(seed), level);
        const columns = addColumns(rows);
        const sum = rows.reduce((total, n) => total + n, 0);
        expect(answer).toBe(String(sum));
        expect(
          columns
            .map((c) => c.digit)
            .reverse()
            .join(''),
        ).toBe(String(sum));
        // Column by column, as on a sheet: the digits of the rank, plus the carry received.
        let received = 0;
        columns.forEach((column, rank) => {
          const digits = rows.map((n) => Math.floor(n / 10 ** rank) % 10);
          const total = received + digits.reduce((s, d) => s + d, 0);
          expect([column.digit, column.carry]).toEqual([total % 10, Math.floor(total / 10)]);
          received = column.carry;
        });
        expect(columns.at(-1)!.carry).toBe(0);
      }
    }
  });

  it('dit ce que Plume écrit dans chaque colonne', () => {
    expect(addColumns([468, 275])).toEqual([
      { digit: 3, carry: 1, calc: '8 + 5 = 13', say: 'J’écris 3, je retiens 1.' },
      { digit: 4, carry: 1, calc: '1 + 6 + 7 = 14', say: 'J’écris 4, je retiens 1.' },
      { digit: 7, carry: 0, calc: '1 + 4 + 2 = 7', say: 'J’écris 7.' },
    ]);
    expect(addColumns([87, 48]).at(-1)).toEqual({
      digit: 1,
      carry: 0,
      calc: 'Il reste la retenue : 1',
      say: 'J’écris 1.',
    });
    expect(carryCount(addColumns([99, 99, 99]))).toBe(2);
    expect(addColumns([99, 99, 99])[0]).toMatchObject({ calc: '9 + 9 + 9 = 27', carry: 2 });
  });

  it('montre la méthode, puis le résultat', () => {
    const exercise = generateAddition(new Rng(1), 4);
    expect(additionHint(exercise, 1)).toContain('de droite à gauche');
    expect(additionHint(exercise, 2)).toContain(`= `);
  });
});
