import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { BIOMES } from '../../scene/biomes';
import {
  DIVIDE_LEVELS,
  SHARE_LEVELS,
  generateDivide,
  generateShare,
  type ShareExercise,
} from './generators';
import { divideHint, divideLures, shareHint, shareLures } from './hints';

const tried = (answer: number) => ({ answer: String(answer) });

describe('partager et grouper (#175)', () => {
  it('keeps every level within its constraints, in every decor, on 1 000 seeds', () => {
    const maxima = [20, 20, 30, 50];
    for (const biome of Object.values(BIOMES)) {
      const context = { vocabulary: biome.vocabulary };
      for (let level = 0; level < SHARE_LEVELS; level++) {
        const asks = new Set<string>();
        for (let seed = 0; seed < 1000; seed++) {
          const e = generateShare(new Rng(seed), level, context);
          asks.add(e.ask);
          expect(e.total).toBe(e.groups * e.per);
          expect(e.total).toBeLessThanOrEqual(maxima[level]);
          expect(e.answer).toBe(String(e.ask === 'share' ? e.per : e.groups));
          expect(e.statement).toContain(`${e.total} ${e.item.many}`);
          if (level < 3) {
            expect(e.figure).toEqual({
              kind: 'share',
              items: e.total,
              groups: e.ask === 'share' ? e.groups : 0,
            });
          } else expect(e.figure).toBeUndefined();
        }
        expect([...asks].sort()).toEqual(
          level === 0 ? ['share'] : level === 1 ? ['group'] : ['group', 'share'],
        );
      }
    }
  });

  it('names a subtraction, a multiplication or a product that misses the total', () => {
    const context = { vocabulary: BIOMES.clearing.vocabulary };
    const e: ShareExercise = {
      ...generateShare(new Rng(1), 0, context),
      ask: 'share',
      total: 18,
      groups: 3,
      per: 6,
      answer: '6',
    };
    expect(shareHint(e, 1, tried(15))).toContain('15, c’est 18 − 3 : une soustraction.');
    expect(shareHint(e, 1, tried(5))).toContain('3 × 5 = 15, pas 18.');
    expect(shareHint(e, 1, tried(54))).toContain('54, c’est 18 × 3 : une multiplication.');
    expect(shareHint(e, 2)).toContain('3 × 6 = 18, donc 18 ÷ 3 = 6.');
  });

  it('every lure is a recognised mistake, on 1 000 seeds', () => {
    const context = { vocabulary: BIOMES.clearing.vocabulary };
    for (let level = 0; level < SHARE_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const e = generateShare(new Rng(seed), level, context);
        for (const lure of shareLures(e)) {
          if (String(lure) === e.answer) continue;
          expect(shareHint(e, 1, tried(lure)), `${e.statement} → ${lure}`).not.toBe(
            shareHint(e, 1),
          );
        }
      }
    }
  });
});

describe('diviser (#175)', () => {
  it('keeps every level within its constraints, on 1 000 seeds', () => {
    for (let level = 0; level < DIVIDE_LEVELS; level++) {
      for (let seed = 0; seed < 1000; seed++) {
        const e = generateDivide(new Rng(seed), level);
        expect(e.dividend).toBe(e.divisor * e.quotient);
        expect(e.answer).toBe(String(e.quotient));
        expect(e.statement.split('?')).toHaveLength(2);
        expect(e.statement).toContain(`${e.dividend}\u00a0÷\u00a0${e.divisor} = ?`);
        expect(e.statement.includes('×')).toBe(level === 0 || level === 3);
        if (level === 1) expect([2, 5, 10]).toContain(e.divisor);
        if (level === 3) expect(e.quotient).toBeGreaterThan(10);
        else expect(e.quotient).toBeLessThanOrEqual(10);
      }
    }
  });

  it('checks a wrong quotient with the table', () => {
    const e = {
      ...generateDivide(new Rng(1), 2),
      dividend: 42,
      divisor: 7,
      quotient: 6,
      answer: '6',
    };
    expect(divideHint(e, 1, tried(5))).toBe(
      '7 × 5 = 35, pas 42.\nCherche 7 × ? = 42 dans la table de 7.',
    );
    expect(divideHint(e, 1, tried(35))).toContain('35, c’est 42 − 7 : une soustraction.');
    expect(divideHint(e, 2)).toBe('7 × 6 = 42, donc 42 ÷ 7 = 6.');
    for (const lure of divideLures(e))
      expect(divideHint(e, 1, tried(lure))).not.toBe(divideHint(e, 1));
  });
});
