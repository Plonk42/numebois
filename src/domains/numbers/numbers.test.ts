import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import {
  COMPARE_LEVELS,
  DECOMPOSE_LEVELS,
  DECOMPOSE_SHOWS,
  EASY_SHOW_SHARE,
  NUMBER_LINE_LEVELS,
  ORDER_LEVELS,
  RANK_NAMES,
  READ_LEVELS,
  WRITE_DIGITS_LEVELS,
  generateCompare,
  generateDecompose,
  generateLinePlace,
  generateLineRead,
  generateOrder,
  generateRead,
  generateWriteDigits,
  hasEmptyRank,
  type DecomposeExercise,
  type WriteDigitsExercise,
} from './generators';
import { compareHint, decomposeHint, numberLineHint, orderHint, writeDigitsHint } from './hints';
import { decomposeLures } from './lures';
import { decompose, lineRead, operationWords, writeDigits } from './skills';
import {
  OPERATION_WORDS_LEVELS,
  generateOperationWords,
  operationWordsHint,
  operationWordsLures,
  wordOf,
} from './operation-words';
import { offerChoices } from '../../core/choices';
import type { Exercise, NumberLine, Skill } from '../../core/types';
import { validateNumber } from '../../core/validate';
import { formatNumber, numberWords } from './words';

describe('numberWords', () => {
  it.each([
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt-et-un'],
    [22, 'vingt-deux'],
    [60, 'soixante'],
    [70, 'soixante-dix'],
    [71, 'soixante-et-onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [90, 'quatre-vingt-dix'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [101, 'cent-un'],
    [200, 'deux-cents'],
    [201, 'deux-cent-un'],
    [280, 'deux-cent-quatre-vingts'],
    [1000, 'mille'],
    [1001, 'mille-un'],
    [1200, 'mille-deux-cents'],
    [2000, 'deux-mille'],
    [3240, 'trois-mille-deux-cent-quarante'],
    [7080, 'sept-mille-quatre-vingts'],
    [9999, 'neuf-mille-neuf-cent-quatre-vingt-dix-neuf'],
    [10_000, 'dix-mille'],
  ])('%i → %s', (n, words) => {
    expect(numberWords(n)).toBe(words);
  });

  it('gives a different spelling to each number up to 10 000, with school words only', () => {
    const seen = new Set<string>();
    const vocabulary = new Set<string>();
    for (let n = 1; n <= 10_000; n++) {
      const words = numberWords(n);
      seen.add(words);
      for (const word of words.split('-')) vocabulary.add(word);
    }
    expect(seen.size).toBe(10_000);
    expect([...vocabulary].sort()).toEqual(
      [
        ...['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
        ...['onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'],
        ...['vingt', 'vingts', 'trente', 'quarante', 'cinquante', 'soixante'],
        ...['cent', 'cents', 'mille', 'et'],
      ].sort(),
    );
  });

  it('refuses numbers outside 1 to 10 000', () => {
    expect(() => numberWords(0)).toThrow(RangeError);
    expect(() => numberWords(10_001)).toThrow(RangeError);
    expect(() => numberWords(2.5)).toThrow(RangeError);
  });

  it('groups the digits as at school', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(3240)).toBe('3\u202f240');
    expect(formatNumber(10_000)).toBe('10\u202f000');
  });
});

describe('écrire en chiffres', () => {
  const RULES: ((value: number) => boolean)[] = [
    (v) => v >= 100 && v <= 999,
    (v) => v >= 1000 && v <= 9999 && !String(v).includes('0'),
    (v) => v >= 1000 && v <= 9999 && hasEmptyRank(v),
    (v) => v === 10_000 || (v >= 1000 && v <= 9999 && v % 100 >= 70),
  ];

  it('declares one rule per level', () => {
    expect(RULES).toHaveLength(WRITE_DIGITS_LEVELS);
  });

  for (let level = 0; level < WRITE_DIGITS_LEVELS; level++) {
    it(`level ${level}: 1 000 seeds within the constraints`, () => {
      const values = new Set<number>();
      for (let seed = 0; seed < 1000; seed++) {
        const exercise = generateWriteDigits(new Rng(seed), level);
        expect(RULES[level](exercise.value), `${exercise.value}`).toBe(true);
        expect(exercise.answer).toBe(String(exercise.value));
        expect(exercise.statement).toBe(numberWords(exercise.value));
        expect(validateNumber(exercise, exercise.answer)).toBe(true);
        values.add(exercise.value);
      }
      expect(values.size).toBeGreaterThan(500);
    });
  }

  it('is reproducible from its seed', () => {
    expect(generateWriteDigits(new Rng(42), 2)).toEqual(generateWriteDigits(new Rng(42), 2));
  });

  it('refuses an unknown level', () => {
    expect(() => generateWriteDigits(new Rng(1), WRITE_DIGITS_LEVELS)).toThrow(RangeError);
  });

  it('validates the number, not its writing', () => {
    const exercise = generateWriteDigits(new Rng(3), 1);
    expect(validateNumber(exercise, `0${exercise.answer}`)).toBe(true);
    expect(validateNumber(exercise, String(exercise.value + 1))).toBe(false);
    expect(validateNumber(exercise, '')).toBe(false);
    expect(validateNumber(exercise, `${exercise.answer}.0`)).toBe(false);
  });

  it('hints at the method first, then shows the answer with its method', () => {
    const at = (value: number): WriteDigitsExercise => ({
      ...generateWriteDigits(new Rng(1), 1),
      value,
      answer: String(value),
    });
    expect(writeDigitsHint(at(3240), 1)).toBe(
      'trois-mille · deux-cent · quarante\nUn chiffre par rang. Un rang vide, c’est 0.',
    );
    expect(writeDigitsHint(at(3247), 1)).toBe(
      'trois-mille · deux-cent · quarante-sept\n' +
        'Un chiffre par rang : milliers, centaines, dizaines, unités.',
    );
    expect(writeDigitsHint(at(3240), 2)).toBe(
      'trois-mille · deux-cent · quarante\n' +
        '3 milliers, 2 centaines, 4 dizaines, 0 unité : 3\u202f240.',
    );
    expect(writeDigitsHint(at(512), 2)).toBe(
      'cinq-cent · douze\n5 centaines, 1 dizaine, 2 unités : 512.',
    );
  });
});

describe('lire, décomposer, comparer, ranger', () => {
  const seeds = (run: (rng: Rng) => void) => {
    for (let seed = 0; seed < 1000; seed++) run(new Rng(seed));
  };

  it('reads among 3 different spellings, close to the number', () => {
    for (let level = 0; level < READ_LEVELS; level++) {
      seeds((rng) => {
        const e = generateRead(rng, level);
        expect(e.input.kind === 'choice' && new Set(e.input.options).size).toBe(3);
        expect(e.answer).toBe(numberWords(e.value));
        expect(e.statement).toBe(formatNumber(e.value));
      });
    }
  });

  it('composes from the ranks, finds a digit and counts a rank', () => {
    for (let level = 0; level < DECOMPOSE_LEVELS; level++) {
      seeds((rng) => {
        const e = generateDecompose(rng, level);
        const v = e.value;
        if (level === 0) expect(v >= 100 && v <= 999 && !String(v).includes('0')).toBe(true);
        if (level === 1) expect(v >= 1000 && hasEmptyRank(v)).toBe(true);
        if (level <= 1) expect(e.answer).toBe(String(v));
        if (level === 2) expect(e.answer).toBe(String(v).at(-1 - e.rank));
        if (level === 3) expect(e.answer).toBe(String(Math.floor(v / 10 ** e.rank)));
      });
    }
    const e = { ...generateDecompose(new Rng(1), 3), value: 3240, rank: 1, answer: '324' };
    expect(decomposeHint(e, 2)).toBe(
      'Dans 3\u202f240, il y a 324 dizaines.\n324 dizaines font 3\u202f240.',
    );
  });

  it('shows a number to decompose in several ways, one easy way in four', () => {
    for (let level = 0; level < DECOMPOSE_LEVELS; level++) {
      const shows = new Set<string>();
      const { easy, effort } = DECOMPOSE_SHOWS[level];
      let easyCount = 0;
      seeds((rng) => {
        const e = generateDecompose(rng, level);
        shows.add(e.show);
        if (easy.includes(e.show)) easyCount++;
        const digits = [...String(e.value)].map(Number);
        const ranks = () =>
          e.statement
            .split(', ')
            .map((part) => RANK_NAMES.findIndex((names) => names.some((n) => part.endsWith(n))));
        if (e.show === 'sum') {
          const terms = e.statement.split(' + ').map((t) => Number(t.replace(/\s/g, '')));
          expect(terms.reduce((a, b) => a + b, 0)).toBe(e.value);
        }
        if (e.show === 'mixed') {
          const order = ranks();
          expect(new Set(order).size).toBe(order.length);
          // Out of order whenever there are two ranks or more.
          expect(order.length === 1 || order.some((r, i) => i > 0 && r > order[i - 1])).toBe(true);
        }
        // Every rank named in order, the empty one with its 0.
        if (e.show === 'named') {
          expect(ranks()).toEqual(digits.map((_, i) => digits.length - 1 - i));
          expect(e.statement.split(', ').map((part) => Number(part.split(' ')[0]))).toEqual(digits);
        }
        if (e.show === 'blocks') {
          expect(e.figure).toEqual({
            kind: 'blocks',
            hundreds: digits[0],
            tens: digits[1],
            units: digits[2],
          });
        }
        // The table only to read a column, every digit in its cell, 0 included.
        if (e.show === 'table') {
          expect(e.ask).not.toBe('compose');
          expect(e.figure).toEqual({ kind: 'place-value', digits });
        } else if (e.show !== 'blocks') expect(e.figure).toBeUndefined();
      });
      expect([...shows].sort()).toEqual([...easy, ...effort].sort());
      expect(easyCount / 1000).toBeGreaterThan(EASY_SHOW_SHARE - 0.05);
      expect(easyCount / 1000).toBeLessThan(EASY_SHOW_SHARE + 0.05);
    }
    const at = (value: number, show: DecomposeExercise['show']): DecomposeExercise => ({
      ...generateDecompose(new Rng(1), 0),
      value,
      answer: String(value),
      show,
    });
    expect(decomposeHint(at(324, 'blocks'), 2)).toBe('3 plaques, 2 barres, 4 cubes : 324.');
    expect(decomposeHint(at(111, 'blocks'), 2)).toBe('1 plaque, 1 barre, 1 cube : 111.');
    expect(decomposeHint(at(3042, 'named'), 2)).toBe(
      '3 milliers, 0 centaine, 4 dizaines, 2 unités : 3\u202f042.',
    );
  });

  it('offers the typical mistakes among choices: another column, a tick away', () => {
    seeds((rng) => {
      const digit = generateDecompose(rng, 2);
      const offered = offerChoices(decompose, digit, rng);
      const options = offered.input.kind === 'choice' ? offered.input.options : [];
      const digits = [...String(digit.value)];
      // Distinct digits of the number first, then the common slips.
      const fromValue = options.filter((o) => digits.includes(o)).length;
      expect(fromValue).toBe(Math.min(4, new Set(digits).size));
      const read = generateLineRead(rng, 3);
      const ticks = offerChoices(lineRead, read, rng);
      for (const option of ticks.input.kind === 'choice' ? ticks.input.options : []) {
        expect((Number(option) - read.line.from) % read.line.step).toBe(0);
      }
    });
    expect(
      decomposeLures({ ...generateDecompose(new Rng(1), 1), value: 3042, ask: 'compose' }),
    ).toEqual([342]);
  });

  it('compares within the constraints of each level, with every sign', () => {
    const signs = new Set<string>();
    for (let level = 0; level < COMPARE_LEVELS; level++) {
      seeds((rng) => {
        const { a, b, answer, input } = generateCompare(rng, level);
        expect(answer).toBe(a < b ? '<' : a > b ? '>' : '=');
        expect(input).toEqual({ kind: 'compare', left: formatNumber(a), right: formatNumber(b) });
        if (level === 0) expect(Math.floor(a / 100)).not.toBe(Math.floor(b / 100));
        if (level === 1) expect(Math.floor(a / 1000)).toBe(Math.floor(b / 1000));
        if (level === 2) signs.add(answer);
      });
    }
    expect([...signs].sort()).toEqual(['<', '=', '>']);
    const at = (a: number, b: number) => ({ ...generateCompare(new Rng(1), 0), a, b });
    expect(compareHint(at(3240, 3420), 2)).toBe(
      'Premier rang différent : les centaines, 2 < 4.\n3\u202f240 < 3\u202f420.',
    );
    expect(compareHint(at(1023, 987), 2)).toBe(
      '1\u202f023 a 4 chiffres, 987 en a 3.\n1\u202f023 > 987.',
    );
  });

  it('orders 3 or 4 different numbers and points the largest or smallest', () => {
    for (let level = 0; level < ORDER_LEVELS; level++) {
      seeds((rng) => {
        const e = generateOrder(rng, level);
        expect(new Set(e.values).size).toBe(level === 0 ? 3 : 4);
        const target = e.want === 'largest' ? Math.max(...e.values) : Math.min(...e.values);
        expect(e.answer).toBe(formatNumber(target));
      });
    }
    const e = {
      ...generateOrder(new Rng(1), 0),
      values: [512, 215, 125],
      want: 'largest' as const,
    };
    expect(orderHint(e, 2)).toBe('Rangés : 125 < 215 < 512.\nLe plus grand : 512.');
  });
});

describe('droite graduée', () => {
  const RULES: ((line: NumberLine) => boolean)[] = [
    (l) => l.from === 0 && l.to === 10 && l.step === 1,
    (l) => l.from === 0 && l.to === 100 && l.step === 10,
    (l) => l.step === 1 && l.from % 10 === 0 && l.from >= 10 && l.to <= 100,
    (l) => l.step === 10 && l.from % 100 === 0 && l.from >= 100 && l.to <= 1000,
    (l) => l.step === 100 && l.from % 1000 === 0 && l.from >= 1000 && l.to <= 10_000,
  ];

  it.each(RULES.map((rule, level) => [level, rule] as const))(
    'level %i: 11 ticks, the number on an unwritten tick, on 1 000 seeds',
    (level, rule) => {
      const values = new Set<number>();
      for (let seed = 0; seed < 1000; seed++) {
        for (const generate of [generateLineRead, generateLinePlace]) {
          const e = generate(new Rng(seed), level);
          const { line, value } = e;
          expect(rule(line)).toBe(true);
          expect((line.to - line.from) / line.step).toBe(10);
          expect(line.labels).toContain(line.from);
          expect(line.labels).toContain(line.to);
          expect(value > line.from && value < line.to).toBe(true);
          expect((value - line.from) % line.step).toBe(0);
          expect(line.labels).not.toContain(value);
          expect(e.answer).toBe(String(value));
          values.add(value);
        }
      }
      expect(values.size).toBeGreaterThanOrEqual(level < 2 ? 8 : 9);
      expect(() => generateLineRead(new Rng(1), NUMBER_LINE_LEVELS)).toThrow(RangeError);
    },
  );

  it('reads with an arrow and the keypad, places with the finger', () => {
    const read = generateLineRead(new Rng(4), 3);
    expect(read.figure).toEqual({ kind: 'number-line', line: read.line, arrow: read.value });
    expect(read.input.kind).toBe('keypad');
    const place = generateLinePlace(new Rng(4), 3);
    expect(place.figure).toBeUndefined();
    expect(place.input).toEqual({ kind: 'number-line', line: place.line });
    expect(place.statement).toBe(formatNumber(place.value));
  });

  it('counts tick by tick from the closest written number', () => {
    const at = (level: number, from: number, value: number) => {
      const e = generateLineRead(new Rng(1), level);
      const step = e.line.step;
      const line = {
        ...e.line,
        from,
        to: from + 10 * step,
        labels: level < 2 ? e.line.labels : [from, from + 10 * step],
      };
      return { ...e, line, value };
    };
    expect(numberLineHint(at(0, 0, 7), 1)).toBe('Pars de 5 et avance de 1 en 1.');
    expect(numberLineHint(at(0, 0, 7), 2)).toBe('Depuis 5, 2 traits de 1 : 7.');
    expect(numberLineHint(at(3, 300, 340), 2)).toBe('Depuis 300, 4 traits de 10 : 340.');
    expect(numberLineHint(at(4, 2000, 2800), 1)).toBe(
      'Pars de 3\u202f000 et recule de 100 en 100.',
    );
    expect(numberLineHint(at(4, 2000, 2800), 2)).toBe(
      'Depuis 3\u202f000, 2 traits de 100 en arrière : 2\u202f800.',
    );
  });
});

describe('indices après une erreur (#168)', () => {
  const tried = (answer: number) => ({ answer: String(answer) });

  it('write digits and compose: the zeros of the empty ranks left out', () => {
    const write = { ...generateWriteDigits(new Rng(1), 2), value: 3042, answer: '3042' };
    expect(writeDigitsHint(write, 1, tried(342))).toBe(
      'trois-mille · quarante-deux\nIl manque un 0 : un rang vide, c’est 0.',
    );
    const thousands = { ...write, value: 3002, answer: '3002' };
    expect(writeDigitsHint(thousands, 1, tried(32))).toContain('Il manque des 0');
    const compose: DecomposeExercise = {
      ...generateDecompose(new Rng(1), 1),
      value: 3042,
      answer: '3042',
      ask: 'compose',
      show: 'named',
    };
    expect(decomposeHint(compose, 1, tried(342))).toBe(
      'Il manque un 0.\nUn chiffre par rang, dans l’ordre.',
    );
  });

  it('a digit: the one of another rank', () => {
    const e = { ...generateDecompose(new Rng(1), 2), value: 3457, rank: 2, answer: '4' };
    expect(decomposeHint({ ...e, show: 'words' }, 1, tried(5))).toBe(
      '5, c’est le chiffre des dizaines.\nCherche celui des centaines.',
    );
  });

  it('a count: the digit alone, the whole number, another rank', () => {
    const e: DecomposeExercise = {
      ...generateDecompose(new Rng(1), 3),
      value: 3457,
      rank: 1,
      answer: '345',
      show: 'words',
    };
    const method = '\nCache les chiffres à droite des dizaines.';
    expect(decomposeHint(e, 1, tried(5))).toBe(
      `5, c’est seulement le chiffre des dizaines.${method}`,
    );
    expect(decomposeHint(e, 1, tried(3457))).toBe(`Tu as recopié tout le nombre.${method}`);
    expect(decomposeHint(e, 1, tried(34))).toBe(`34, c’est le nombre de centaines.${method}`);
  });

  it('the number line: a tick or two away', () => {
    const e = {
      ...generateLineRead(new Rng(1), 0),
      line: { from: 0, to: 10, step: 1, labels: [0, 5, 10] },
      value: 7,
    };
    expect(numberLineHint(e, 1, tried(8))).toBe(
      'Tu es à 1 trait près.\nPars de 5 et avance de 1 en 1.',
    );
    expect(numberLineHint(e, 1, tried(9))).toContain('Tu es à 2 traits près.');
    expect(numberLineHint(e, 1, tried(3))).toBe(numberLineHint(e, 1));
  });

  it('every lure is a recognised mistake, on 1 000 seeds', () => {
    const notions: [Skill, (rng: Rng, level: number) => Exercise, number][] = [
      [writeDigits, generateWriteDigits, WRITE_DIGITS_LEVELS],
      [decompose, generateDecompose, DECOMPOSE_LEVELS],
      [lineRead, generateLineRead, NUMBER_LINE_LEVELS],
    ];
    for (const [skill, generate, levels] of notions) {
      for (let level = 0; level < levels; level++) {
        for (let seed = 0; seed < 1000; seed++) {
          const exercise = generate(new Rng(seed), level);
          for (const lure of skill.lures!(exercise)) {
            if (String(lure) === exercise.answer) continue;
            expect(
              skill.hint(exercise, 1, tried(lure)),
              `${exercise.statement} → ${lure}`,
            ).not.toBe(skill.hint(exercise, 1));
          }
        }
      }
    }
  });
});

describe('les mots des opérations (#178)', () => {
  const tried = (answer: string) => ({ answer });

  it('keeps every level within its constraints, on 1 000 seeds', () => {
    for (let level = 0; level < OPERATION_WORDS_LEVELS; level++) {
      const asks = new Set<string>();
      for (let seed = 0; seed < 1000; seed++) {
        const e = generateOperationWords(new Rng(seed), level);
        asks.add(e.ask);
        const { a, b } = e;
        if (e.ask === 'sum') expect(e.answer).toBe(String(a + b));
        if (e.ask === 'sum') expect(a + b).toBeLessThanOrEqual(99);
        if (e.ask === 'difference') expect(e.answer).toBe(String(a - b));
        if (e.ask === 'difference') expect(a).toBeGreaterThan(b);
        if (e.ask === 'product') expect(e.answer).toBe(String(a * b));
        if (e.ask === 'even') expect(e.answer).toBe(a % 2 === 0 ? 'pair' : 'impair');
        if (e.ask === 'multiple' && e.input.kind === 'choice') {
          if (e.input.options.length === 4) {
            const multiples = e.input.options.filter(
              (o) => Number(o.replace(/\D/g, '')) % e.of! === 0,
            );
            expect(multiples).toEqual([e.answer]);
          }
          if (e.input.options.length === 2) expect(e.answer).toBe(a % e.of! === 0 ? 'oui' : 'non');
        }
        if (e.ask === 'word') expect(e.answer).toBe(wordOf(e.operator!, e.named!));
      }
      const expected = [
        ['sum', 'difference'],
        ['sum', 'difference', 'product'],
        ['even'],
        ['multiple'],
        ['word'],
      ][level];
      expect([...asks].sort()).toEqual([...expected].sort());
    }
  });

  it('names the result of another operation', () => {
    const e = {
      ...generateOperationWords(new Rng(1), 0),
      ask: 'sum' as const,
      a: 12,
      b: 25,
      answer: '37',
    };
    expect(operationWordsHint(e, 1, tried('13'))).toBe(
      '13, c’est la différence : 25 − 12.\nPour la somme, fais une addition.',
    );
    expect(operationWordsHint(e, 1, tried('36'))).toBe(
      'La somme, c’est le résultat d’une addition.',
    );
    expect(operationWordsHint(e, 2)).toBe('12 + 25 = 37.\nLa somme est 37.');
    const product = { ...e, ask: 'product' as const, a: 6, b: 7, answer: '42' };
    expect(operationWordsHint(product, 1, tried('13'))).toBe(
      '13, c’est la somme : 6 + 7.\nPour le produit, fais une multiplication.',
    );
  });

  it('names the word chosen for another', () => {
    const e = generateOperationWords(new Rng(3), 4);
    const word = {
      ...e,
      operator: '−' as const,
      a: 60,
      b: 37,
      named: 2 as const,
      answer: 'la différence',
    };
    expect(operationWordsHint(word, 1, tried('la somme'))).toBe(
      'La somme, c’est le résultat d’une addition.\nIci, c’est une soustraction, et 23 est le résultat.',
    );
    expect(operationWordsHint(word, 2)).toBe('C’est une soustraction.\n23 est la différence.');
  });

  it('every lure is a recognised mistake, on 1 000 seeds', () => {
    for (const level of [0, 1]) {
      for (let seed = 0; seed < 1000; seed++) {
        const e = generateOperationWords(new Rng(seed), level);
        for (const lure of operationWordsLures(e)) {
          if (String(lure) === e.answer) continue;
          expect(operationWordsHint(e, 1, tried(String(lure)))).not.toBe(operationWordsHint(e, 1));
        }
      }
    }
    expect(operationWords.lures).toBe(operationWordsLures);
  });
});
