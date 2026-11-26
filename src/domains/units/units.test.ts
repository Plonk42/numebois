import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import {
  COMPARE_LENGTHS_LEVELS,
  compareLengthsHint,
  generateCompareLengths,
  lengthText,
  millimetres,
  type Written,
} from './compare';
import {
  MAGNITUDE_LEVELS,
  MONEY_LEVELS,
  amountText,
  generateMagnitude,
  generateMoney,
} from './everyday';
import { relationFacts } from './facts';
import {
  CLASS_LENGTHS,
  CONVERT_LEVELS,
  RELATIONS_LEVELS,
  TABLES,
  UNIT_RELATIONS,
  generateConvert,
  generateRelation,
} from './generators';

const SEEDS = 1000;
const levels = (count: number) => Array.from({ length: count }, (_, level) => level);

describe('les relations entre unités', () => {
  it.each(levels(RELATIONS_LEVELS))('level %i: 1 000 seeds, a relation by heart', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateRelation(new Rng(seed), level);
      const { factor } = exercise.relation;
      expect(exercise.answer).toBe(String(level === 0 ? factor : 1));
      expect(relationFacts.all).toContain(relationFacts.of(exercise));
    }
  });

  it('declares a fact per relation, in a group each, drilled both ways', () => {
    expect(relationFacts.all).toHaveLength(UNIT_RELATIONS.length);
    const grouped = relationFacts.groups!.flatMap((group) => group.facts);
    expect([...grouped].sort()).toEqual([...relationFacts.all].sort());
    for (const fact of relationFacts.all) {
      expect(relationFacts.of(relationFacts.exercise(fact, new Rng(2)))).toBe(fact);
    }
  });
});

describe('convertir', () => {
  it.each(levels(CONVERT_LEVELS))(
    'level %i: 1 000 seeds, the table and the answer agree',
    (level) => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = generateConvert(new Rng(seed), level);
        const { pair, big, small, asked, figure } = exercise;
        const units: readonly string[] = TABLES[pair.family];
        const factor = 10 ** (units.indexOf(pair.small) - units.indexOf(pair.big));
        expect(small).toBeLessThan(factor);
        const total = big * factor + small;
        expect(Number(exercise.answer)).toBe({ total, big, small }[asked]);
        expect(exercise.statement.split('?')).toHaveLength(2);
        if (level === 4) {
          expect(figure).toBeUndefined();
          continue;
        }
        if (figure?.kind !== 'conversion') throw new Error('figure');
        // The table of the class, m | dm | cm | mm, unless the km is involved.
        const km = pair.family === 'length' && pair.big === 'km';
        expect(figure.units).toEqual(pair.family === 'length' && !km ? CLASS_LENGTHS : units);
        // Read from the table: the digits down to the smaller unit make the total.
        const end = figure.units.indexOf(pair.small);
        const read = Number(
          figure.digits
            .slice(0, end + 1)
            .map((d) => d ?? 0)
            .join(''),
        );
        expect(read).toBe(total);
        expect(figure.marks).toContain(
          figure.units.indexOf(asked === 'big' ? pair.big : pair.small),
        );
        if (level === 0) expect(small).toBe(0);
        if (level === 1) expect(pair.family).toBe('length');
        if (level === 2) expect(pair.family).not.toBe('length');
        if (level === 3) expect(asked).toBe('small');
        if (level < 3) expect(asked).toBe('total');
        // Into the larger unit, exact: 230 cm = 23 dm (#161).
        if (level === 5) expect(asked === 'big' && small === 0).toBe(true);
        if (level >= 6) expect(['m-mm', 'dm-mm', 'dm-cm']).toContain(`${pair.big}-${pair.small}`);
        if (level === 6) expect(asked).toBe('total');
        if (level === 7) expect(asked !== 'total' && small > 0).toBe(true);
      }
    },
  );
});

describe('comparer des longueurs (#162)', () => {
  it('reads lengths written in several units', () => {
    expect(
      millimetres([
        [4, 'm'],
        [876, 'mm'],
      ]),
    ).toBe(4876);
    expect(
      lengthText([
        [6, 'm'],
        [67, 'cm'],
      ]),
    ).toBe('6\u00a0m 67\u00a0cm');
  });

  it.each(levels(COMPARE_LENGTHS_LEVELS))('level %i: 1 000 seeds, the sign is right', (level) => {
    const signs = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateCompareLengths(new Rng(seed), level);
      const [a, b] = exercise.sides.map(millimetres);
      expect(a > 0 && b > 0).toBe(true);
      if (level === 2) {
        const { input } = exercise;
        if (input.kind !== 'choice') throw new Error(input.kind);
        expect(new Set(input.options).size).toBe(4);
        expect(input.options).toContain(exercise.answer);
        expect(exercise.statement).toContain(lengthText(exercise.sides[0]));
        // The right one is equal, written otherwise; no other choice is.
        expect(a).toBe(b);
        expect(lengthText(exercise.sides[1])).toBe(exercise.answer);
        expect(lengthText(exercise.sides[0])).not.toBe(exercise.answer);
        continue;
      }
      expect(exercise.input).toMatchObject({
        kind: 'compare',
        left: lengthText(exercise.sides[0]),
        right: lengthText(exercise.sides[1]),
      });
      const sign = a < b ? '<' : a > b ? '>' : '=';
      expect(exercise.answer).toBe(sign);
      signs.add(sign);
      const units = exercise.sides.map((side) => side.map(([, unit]) => unit));
      if (level < 3) expect(units.flat()).toHaveLength(2);
      expect(units[0].concat(units[1]).every((u) => ['m', 'dm', 'cm', 'mm'].includes(u))).toBe(
        true,
      );
      if (level === 0) expect(Math.max(a, b) / Math.min(a, b)).toBeGreaterThanOrEqual(2);
      if (level === 1 || level === 3) expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.5);
      if (level === 3) expect(exercise.sides.some((side) => side.length === 2)).toBe(true);
      for (const attempt of [1, 2] as const) {
        expect(compareLengthsHint(exercise, attempt).split('\n').length).toBeLessThanOrEqual(3);
      }
    }
    expect(signs.size).toBe(level === 2 ? 0 : level === 0 ? 2 : 3);
  });

  it('never offers a second length equal to the one given', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateCompareLengths(new Rng(seed), 2);
      const { input } = exercise;
      if (input.kind !== 'choice') throw new Error(input.kind);
      const given = millimetres(exercise.sides[0]);
      const equal = input.options.filter((option) => millimetres(parseLength(option)) === given);
      expect(equal).toEqual([exercise.answer]);
    }
  });
});

/** « 3 dm 4 cm » read back. */
function parseLength(text: string): Written {
  return [...text.matchAll(/([\d\u202f]+)\u00a0(mm|dm|cm|m)/g)].map(
    ([, n, unit]) => [Number(n.replace('\u202f', '')), unit] as const,
  );
}

describe('la monnaie et les ordres de grandeur', () => {
  it('writes amounts as at school', () => {
    expect(amountText(370)).toBe('3\u00a0€ 70\u00a0c');
    expect(amountText(1200)).toBe('12\u00a0€');
    expect(amountText(70)).toBe('70\u00a0c');
  });

  it.each(levels(MONEY_LEVELS))('level %i: 1 000 seeds, the amount counted', (level) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateMoney(new Rng(seed), level);
      const { cents, figure, input } = exercise;
      if (figure?.kind === 'money') expect(figure.cents.reduce((s, n) => s + n, 0)).toBe(cents);
      if (level === 0) expect(Number(exercise.answer) * 100).toBe(cents);
      else {
        if (input.kind !== 'choice') throw new Error(input.kind);
        expect(input.options).toContain(amountText(cents));
      }
      if (level === 2) expect(cents > 0 && cents < 1000).toBe(true);
    }
  });

  it.each(levels(MAGNITUDE_LEVELS))('level %i: the unit that fits among its family', (level) => {
    const units = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = generateMagnitude(new Rng(seed), level);
      if (exercise.input.kind !== 'choice') throw new Error(exercise.input.kind);
      const { options } = exercise.input;
      expect(options).toContain(exercise.answer);
      expect(options.length).toBeLessThanOrEqual(4);
      units.add(exercise.thing.unit);
      if (level > 0) continue;
      // Lengths (#163): mm, cm, dm, m, and the km only for a distance, instead of the mm.
      const offered = options.map((option) => option.split('\u00a0')[1]);
      const km = exercise.thing.unit === 'km';
      expect(offered).toEqual(km ? ['cm', 'dm', 'm', 'km'] : ['mm', 'cm', 'dm', 'm']);
    }
    if (level === 0) expect(units).toEqual(new Set(['mm', 'cm', 'dm', 'm', 'km']));
  });
});
