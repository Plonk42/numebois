import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { addColumns, carryCount, multiplyColumns } from './columns';
import {
  addition,
  ADD_LEVELS,
  fitsAddLevel,
  fitsMultiplyLevel,
  generateAddition,
  generateMultiplication,
  multiplication,
  MULTIPLY_LEVELS,
  WRITTEN_SHARE,
} from './generators';
import { additionHint, multiplicationHint } from './hints';

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

describe('poser une multiplication (#49)', () => {
  const MULTIPLY_MODES = ['guided', 'guided', 'accompanied', 'accompanied', 'alone', 'alone'];

  it('a une règle par niveau, sur 1 000 graines', () => {
    expect(MULTIPLY_MODES).toHaveLength(MULTIPLY_LEVELS);
    for (let level = 0; level < MULTIPLY_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateMultiplication(new Rng(seed), level);
        const { a, b, input } = exercise;
        expect(fitsMultiplyLevel(a, b, level), `${a} × ${b} au niveau ${level}`).toBe(true);
        expect(input.kind === 'column' && input.mode).toBe(MULTIPLY_MODES[level]);
        expect(b).toBeGreaterThanOrEqual(2);
        expect(b).toBeLessThanOrEqual(9);
        expect(a * b).toBeLessThanOrEqual(9999);
      }
    }
  });

  it('pose les chiffres et le sac à retenue d’un calcul direct, sur 1 000 graines', () => {
    for (let level = 0; level < MULTIPLY_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const { a, b, answer } = generateMultiplication(new Rng(seed), level);
        const columns = multiplyColumns(a, b);
        expect(answer).toBe(String(a * b));
        expect(
          columns
            .map((c) => c.digit)
            .reverse()
            .join(''),
        ).toBe(String(a * b));
        // Column by column: the digit of `a` times `b`, plus what waits in the bag.
        let bag = 0;
        columns.forEach((column, rank) => {
          const total = (Math.floor(a / 10 ** rank) % 10) * b + bag;
          expect([column.digit, column.carry]).toEqual([total % 10, Math.floor(total / 10)]);
          bag = column.carry;
        });
        expect(columns.at(-1)!.carry).toBe(0);
      }
    }
  });

  it('dit ce que Plume écrit et ce qu’elle met dans le sac', () => {
    expect(multiplyColumns(347, 6)).toEqual([
      { digit: 2, carry: 4, calc: '7 × 6 = 42', say: 'J’écris 2, je mets 4 dans le sac.' },
      { digit: 8, carry: 2, calc: '4 × 6 + 4 = 28', say: 'J’écris 8, je mets 2 dans le sac.' },
      { digit: 0, carry: 2, calc: '3 × 6 + 2 = 20', say: 'J’écris 0, je mets 2 dans le sac.' },
      { digit: 2, carry: 0, calc: 'Il reste 2 dans le sac', say: 'J’écris 2.' },
    ]);
    expect(multiplyColumns(1205, 7).map((c) => c.digit)).toEqual([5, 3, 4, 8]);
    const exercise = generateMultiplication(new Rng(2), 4);
    expect(multiplicationHint(exercise, 1)).toContain(`par ${exercise.b}`);
    expect(multiplicationHint(exercise, 2)).toContain('=');
  });
});

describe('poser l’opération avant de la calculer (#158)', () => {
  const generators = [
    ['addition', generateAddition, ADD_LEVELS],
    ['multiplication', generateMultiplication, MULTIPLY_LEVELS],
  ] as const;

  it.each(generators)(
    '%s : d’un appui avec Plume, puis écrite de plus en plus, sur 1 000 graines',
    (_, generate, levels) => {
      for (let level = 0; level < levels; level++) {
        let written = 0;
        for (let seed = 0; seed < 1000; seed++) {
          const { input, instruction } = generate(new Rng(seed), level);
          if (input.kind !== 'column') throw new Error(input.kind);
          expect(instruction).toMatch(/^Pose l’opération/);
          if (input.setup === 'write') written++;
        }
        const share = WRITTEN_SHARE[MODES[level] as keyof typeof WRITTEN_SHARE];
        expect(written / 1000, `niveau ${level}`).toBeCloseTo(share, 1);
      }
    },
  );

  it('laisse Plume poser ses démos', () => {
    expect(addition([47, 38], 0).input).not.toHaveProperty('setup');
    expect(multiplication(47, 3, 0).input).not.toHaveProperty('setup');
    expect(addition([47, 38], 0).instruction).toBe('Calcule avec Plume, colonne par colonne.');
  });
});
