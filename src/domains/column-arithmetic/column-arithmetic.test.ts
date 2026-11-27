import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import {
  addColumns,
  carryCount,
  multiplyByTwoDigits,
  multiplyColumns,
  subtractColumns,
} from './columns';
import {
  addition,
  ADD_LEVELS,
  fitsAddLevel,
  fitsMultiplyLevel,
  generateAddition,
  generateMultiplication,
  multiplication,
  MULTIPLY_LEVELS,
  multiplyStatement,
  WRITTEN_SHARE,
  SUBTRACT_LEVELS,
  fitsSubtractLevel,
  generateSubtraction,
  subtraction,
} from './generators';
import {
  fitsPriceLevel,
  generatePrices,
  PRICE_LEVELS,
  priceDigits,
  priceHint,
  priceOperation,
  priceText,
} from './prices';
import { additionHint, multiplicationHint, subtractionHint, subtractionLures } from './hints';

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

const MULTIPLY_MODES = [...MODES, 'guided', 'accompanied', 'alone'];

describe('poser une multiplication (#49)', () => {
  it('a une règle par niveau, sur 1 000 graines', () => {
    expect(MULTIPLY_MODES).toHaveLength(MULTIPLY_LEVELS);
    for (let level = 0; level < MULTIPLY_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateMultiplication(new Rng(seed), level);
        const { a, b, input } = exercise;
        expect(fitsMultiplyLevel(a, b, level), `${a} × ${b} au niveau ${level}`).toBe(true);
        expect(input.kind === 'column' && input.mode).toBe(MULTIPLY_MODES[level]);
        expect(b).toBeGreaterThanOrEqual(2);
        expect(b).toBeLessThanOrEqual(level < 6 ? 9 : 49);
        if (level >= 6) expect(b % 10).not.toBe(0);
        expect(a * b).toBeLessThanOrEqual(9999);
      }
    }
  });

  it('pose les chiffres et le sac à retenue d’un calcul direct, sur 1 000 graines', () => {
    for (let level = 0; level < 6; level++) {
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
        // Column by column: `b` times the digit of `a`, plus what waits in the bag; the last
        // one written whole (#164).
        let bag = 0;
        const ranks = String(a).length;
        columns.forEach((column, rank) => {
          if (rank >= ranks) {
            expect(column).toMatchObject({ joined: true, carry: 0 });
            return;
          }
          const total = (Math.floor(a / 10 ** rank) % 10) * b + bag;
          const last = rank === ranks - 1;
          expect([column.digit, column.carry]).toEqual([
            total % 10,
            last ? 0 : Math.floor(total / 10),
          ]);
          if (last) expect(column.say).toBe(`J’écris ${total}.`);
          bag = column.carry;
        });
        expect(columns.at(-1)!.carry).toBe(0);
      }
    }
  });

  it('dit ce que Plume écrit et ce qu’elle met dans le sac, comme la classe', () => {
    const last = '6 × 3 = 18, puis 18 + 2 = 20';
    expect(multiplyColumns(347, 6)).toEqual([
      { digit: 2, carry: 4, calc: '6 × 7 = 42', say: 'J’écris 2, je mets 4 dans le sac.' },
      { digit: 8, carry: 2, calc: '6 × 4 + 4 = 28', say: 'J’écris 8, je mets 2 dans le sac.' },
      { digit: 0, carry: 0, calc: last, say: 'J’écris 20.' },
      { digit: 2, carry: 0, calc: last, say: 'J’écris 20.', joined: true },
    ]);
    // 26 × 4 as in class: « 4 × 6 = 24 », then « 8 + 2 = 10. J’écris 10. »
    expect(multiplyColumns(26, 4).map((c) => [c.calc, c.say])).toEqual([
      ['4 × 6 = 24', 'J’écris 4, je mets 2 dans le sac.'],
      ['4 × 2 = 8, puis 8 + 2 = 10', 'J’écris 10.'],
      ['4 × 2 = 8, puis 8 + 2 = 10', 'J’écris 10.'],
    ]);
    expect(multiplyColumns(1205, 7).map((c) => c.digit)).toEqual([5, 3, 4, 8]);
    const exercise = generateMultiplication(new Rng(2), 4);
    expect(multiplicationHint(exercise, 1)).toContain(`${exercise.b} × chaque chiffre`);
    expect(multiplicationHint(exercise, 2)).toContain('=');
  });
});

describe('poser l’opération avant de la calculer (#158)', () => {
  const generators = [
    ['addition', generateAddition, ADD_LEVELS, MODES],
    ['multiplication', generateMultiplication, MULTIPLY_LEVELS, MULTIPLY_MODES],
  ] as const;

  it.each(generators)(
    '%s : d’un appui avec Plume, puis écrite de plus en plus, sur 1 000 graines',
    (_, generate, levels, modes) => {
      for (let level = 0; level < levels; level++) {
        let written = 0;
        for (let seed = 0; seed < 1000; seed++) {
          const { input, instruction, statement } = generate(new Rng(seed), level);
          if (input.kind !== 'column') throw new Error(input.kind);
          expect(instruction.startsWith(`Pose ${statement}`), instruction).toBe(true);
          if (input.setup === 'write') written++;
        }
        const share = WRITTEN_SHARE[modes[level] as keyof typeof WRITTEN_SHARE];
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

describe('poser une soustraction, par compensation (#173)', () => {
  it('a une règle par niveau, sur 1 000 graines', () => {
    expect(MODES).toHaveLength(SUBTRACT_LEVELS);
    const zeros = [0, 0, 0, 0, 0, 0];
    for (let level = 0; level < SUBTRACT_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateSubtraction(new Rng(seed), level);
        const { top, bottom, input } = exercise;
        expect(fitsSubtractLevel(top, bottom, level), `${top} − ${bottom} au niveau ${level}`).toBe(
          true,
        );
        expect(input.kind === 'column' && input.mode).toBe(MODES[level]);
        expect(String(top - bottom)).toHaveLength(String(top).length);
        if (String(top).slice(1, -1).includes('0')) zeros[level]++;
      }
    }
    expect(zeros[4]).toBe(1000);
  });

  it('pose les chiffres et les retenues d’un calcul direct, sur 1 000 graines', () => {
    for (let level = 0; level < SUBTRACT_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const { top, bottom, answer, input } = generateSubtraction(new Rng(seed), level);
        if (input.kind !== 'column') throw new Error(input.kind);
        expect(answer).toBe(String(top - bottom));
        expect(
          input.columns
            .map((c) => c.digit)
            .reverse()
            .join(''),
        ).toBe(answer);
        // Column by column: 10 more at the top when it is too small, the carry added at the bottom.
        let received = 0;
        input.columns.forEach((column, rank) => {
          const high = Math.floor(top / 10 ** rank) % 10;
          const taken = (Math.floor(bottom / 10 ** rank) % 10) + received;
          expect(column.carry).toBe(high < taken ? 1 : 0);
          expect(column.digit).toBe(high + 10 * column.carry - taken);
          received = column.carry;
        });
        expect(input.columns.at(-1)!.carry).toBe(0);
      }
    }
  });

  it('dit ce que Plume écrit, comme la classe', () => {
    expect(subtractColumns(523, 178).map((c) => [c.calc, c.say])).toEqual([
      ['13 − 8 = 5', '3 − 8, je ne peux pas : j’ajoute 10.\nJ’écris 5, je retiens 1 en bas.'],
      [
        '7 + 1 = 8, puis 12 − 8 = 4',
        '2 − 8, je ne peux pas : j’ajoute 10.\nJ’écris 4, je retiens 1 en bas.',
      ],
      ['1 + 1 = 2, puis 5 − 2 = 3', 'J’écris 3.'],
    ]);
    expect(subtractColumns(403, 78).at(-1)!.calc).toBe('Il reste la retenue : 4 − 1 = 3');
    expect(subtractColumns(403, 178)[1].calc).toBe('7 + 1 = 8, puis 10 − 8 = 2');
  });

  it('nomme la colonne à l’envers et la retenue oubliée', () => {
    const exercise = subtraction(523, 169, 4);
    const tried = (answer: number) => ({ answer: String(answer) });
    // 3 − 9 worked as 9 − 3.
    expect(subtractionHint(exercise, 1, tried(356))).toBe(
      'Aux unités, 3 − 9, on ne peut pas.\nEn haut trop petit ? Ajoute 10, et retiens 1 en bas.',
    );
    expect(subtractionHint(subtraction(523, 178, 4), 1, tried(355))).toBe(
      'Aux dizaines, tu as oublié la retenue.\nAjoute-la au chiffre du bas.',
    );
    expect(subtractionHint(exercise, 2)).toBe(
      '523\u00a0−\u00a0169 = 354.\nRegarde les retenues en bas des colonnes.',
    );
    for (let level = 0; level < SUBTRACT_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const e = generateSubtraction(new Rng(seed), level);
        for (const lure of subtractionLures(e)) {
          expect(subtractionHint(e, 1, tried(lure)), `${e.statement} → ${lure}`).not.toBe(
            subtractionHint(e, 1),
          );
        }
      }
    }
  });

  it('se pose d’un appui avec Plume, puis écrite de plus en plus', () => {
    for (let level = 0; level < SUBTRACT_LEVELS; level++) {
      let written = 0;
      for (let seed = 0; seed < 1000; seed++) {
        const { input, instruction, statement } = generateSubtraction(new Rng(seed), level);
        if (input.kind !== 'column') throw new Error(input.kind);
        expect(instruction.startsWith(`Pose ${statement}`), instruction).toBe(true);
        if (input.setup === 'write') written++;
      }
      const share = WRITTEN_SHARE[MODES[level] as keyof typeof WRITTEN_SHARE];
      expect(written / 1000, `niveau ${level}`).toBeCloseTo(share, 1);
    }
    expect(subtraction(523, 178, 0).input).not.toHaveProperty('setup');
  });
});

describe('poser des prix en euros (#177)', () => {
  const OPERATORS = ['+', '+', '−', '−', '+', '−'];
  const PRICE_MODES = ['guided', 'accompanied', 'guided', 'accompanied', 'alone', 'alone'];

  it('a une règle par niveau, sur 1 000 graines', () => {
    expect(OPERATORS).toHaveLength(PRICE_LEVELS);
    let wholes = 0;
    for (let level = 0; level < PRICE_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generatePrices(new Rng(seed), level);
        const { rows, operator, input, statement } = exercise;
        expect(fitsPriceLevel(rows, level), statement).toBe(true);
        expect(operator).toBe(OPERATORS[level]);
        expect(input.kind === 'column' && input.mode).toBe(PRICE_MODES[level]);
        expect(input.kind === 'column' && input.decimals).toBe(2);
        expect(statement).toMatch(/^\d+(,\d\d)?\u00a0€\u00a0[+−] \d+(,\d\d)?\u00a0€$/);
        if (level === 3) expect(rows[1] % 100).toBe(0);
        if (/ \d+\u00a0€$/.test(statement)) wholes++;
      }
    }
    // A price without cents written « 68 € » or « 68,00 € » (owner: both).
    expect(wholes).toBeGreaterThan(300);
  });

  it('pose les chiffres d’un calcul direct, en centimes, sur 1 000 graines', () => {
    for (let level = 0; level < PRICE_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const { rows, operator, answer, input } = generatePrices(new Rng(seed), level);
        if (input.kind !== 'column') throw new Error(input.kind);
        const [a, b] = rows;
        expect(answer).toBe(String(operator === '+' ? a + b : a - b));
        expect(
          input.columns
            .map((c) => c.digit)
            .reverse()
            .join(''),
        ).toBe(answer);
      }
    }
  });

  it('écrit les prix comme sur une fiche, la virgule sous la virgule', () => {
    expect(priceDigits(456)).toBe('4,56');
    expect(priceDigits(6800)).toBe('68,00');
    expect(priceText(6800, true)).toBe('68\u00a0€');
    expect(priceText(6800, false)).toBe('68,00\u00a0€');
    const exercise = priceOperation('−', [24345, 6800], 3, undefined, true);
    expect(exercise.statement).toBe('243,45\u00a0€\u00a0− 68\u00a0€');
    expect(priceHint(exercise, 2)).toBe(
      '243,45\u00a0€\u00a0− 68,00\u00a0€ = 175,45\u00a0€.\nLa virgule reste sous la virgule.',
    );
    expect(priceHint(exercise, 1)).toContain('Ajoute 10, et retiens 1 en bas.');
    // The carry of the cents forgotten in the euros.
    expect(priceHint(exercise, 1, { answer: '18545' })).toBe(
      'Aux dizaines, tu as oublié la retenue.\nAjoute-la au chiffre du bas.',
    );
    const sum = priceOperation('+', [456, 1570], 0);
    expect(priceHint(sum, 1)).toContain('La virgule descend sous la virgule.');
    expect(priceHint(sum, 1, { answer: '1926' })).toBe(
      'Aux unités, tu as oublié la retenue.\nElle est en haut de la colonne.',
    );
  });
});

describe('multiplier par un nombre à deux chiffres (#176)', () => {
  it('pose les deux lignes et leur somme d’un calcul direct, sur 1 000 graines', () => {
    for (let level = 6; level < MULTIPLY_LEVELS; level++) {
      let smallFirst = 0;
      for (let seed = 0; seed < 1000; seed++) {
        const { a, b, answer, input, statement } = generateMultiplication(new Rng(seed), level);
        if (input.kind !== 'column') throw new Error(input.kind);
        expect(answer).toBe(String(a * b));
        expect(input.rows).toEqual([a, b]);
        expect(String(a).length).toBeGreaterThanOrEqual(String(b).length);
        const number = (line: readonly { digit: number }[]) =>
          Number(
            line
              .map((c) => c.digit)
              .reverse()
              .join(''),
          );
        const [first, second] = input.partials!;
        expect(number(first)).toBe(a * (b % 10));
        expect(second[0]).toMatchObject({ digit: 0, carry: 0 });
        expect(number(second)).toBe(a * Math.floor(b / 10) * 10);
        expect(number(input.columns)).toBe(a * b);
        if (statement !== multiplyStatement(a, b)) {
          smallFirst++;
          expect(String(a).length).toBeGreaterThan(String(b).length);
        }
      }
      if (level === 7) expect(smallFirst / 1000).toBeCloseTo(0.5, 1);
    }
  });

  it('dit ce que Plume écrit, comme la classe', () => {
    const { partials, columns } = multiplyByTwoDigits(548, 16);
    expect(partials[0].map((c) => c.calc)).toEqual([
      '6 × 8 = 48',
      '6 × 4 + 4 = 28',
      '6 × 5 = 30, puis 30 + 2 = 32',
      '6 × 5 = 30, puis 30 + 2 = 32',
    ]);
    expect(partials[1][0]).toEqual({
      digit: 0,
      carry: 0,
      calc: 'Maintenant, je multiplie par 1 dizaine.',
      say: 'J’écris d’abord un 0 dans les unités.',
    });
    expect(partials[1].slice(1).map((c) => c.digit)).toEqual([8, 4, 5]);
    expect(columns[0].say).toBe('J’additionne les deux lignes.\nJ’écris 8.');
    expect(columns[1].say).toBe('J’écris 6, je mets 1 dans le sac.');
    expect(columns.map((c) => c.digit)).toEqual([8, 6, 7, 8]);
  });
});

describe('indices de la multiplication par deux chiffres (#176)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });
  const exercise = multiplication(548, 16, 7);

  it('nomme une ligne oubliée et le 0 oublié', () => {
    expect(multiplicationHint(exercise, 1, tried(3288 + 548))).toBe(
      'Il manque le 0 de la 2e ligne.\nElle commence par un 0 dans les unités.',
    );
    expect(multiplicationHint(exercise, 1, tried(3288))).toBe(
      'Il manque la 2e ligne, celle des dizaines.',
    );
    expect(multiplicationHint(exercise, 1, tried(5480))).toBe(
      'Il manque la 1re ligne, celle des unités.',
    );
    // 8 + 8 = 16: the carry forgotten on the hundreds of the sum.
    expect(multiplicationHint(exercise, 1, tried(8668))).toBe(
      'Aux centaines, tu as oublié la retenue.\nElle est dans le sac.',
    );
    expect(multiplicationHint(exercise, 1)).toContain('Une ligne pour les unités');
    expect(multiplicationHint(exercise, 2)).toBe(
      '548\u00a0×\u00a016 = 8\u202f768.\n3\u202f288 + 5\u202f480 = 8\u202f768.',
    );
  });
});
