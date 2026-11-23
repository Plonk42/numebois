import { describe, expect, it } from 'vitest';
import { ExprError, evaluate } from '../../src/core/expr';

describe('expr', () => {
  it.each([
    ['2 + 3 × 4', 14],
    ['(2 + 3) * 4', 20],
    ['24 ÷ 6 − 1', 3],
    ['10 - 4 - 3', 3],
    ['−5 + 8', 3],
    ['2.5 * 2', 5],
    ['glands + 2 × paniers', 30],
  ])('%s = %d', (source, value) => {
    expect(evaluate(source, { glands: 20, paniers: 5 })).toBe(value);
  });

  it.each([
    'alert(1)',
    'glands.length',
    'constructor',
    '__proto__',
    'toString',
    '1; 2',
    '[1]',
    '"a"',
    '`a`',
    '2 ** 3',
    '1 +',
    '(1 + 2',
    '1 + 2)',
    '4 / 0',
    'a = 1',
    '1e3',
    'x',
    '',
    '1'.repeat(201),
  ])('refuses %s', (source) => {
    expect(() => evaluate(source, { glands: 20 })).toThrow(ExprError);
  });

  it('refuses a non numeric variable', () => {
    expect(() => evaluate('a', { a: Number.NaN })).toThrow(ExprError);
    expect(() => evaluate('a', { a: '1' } as unknown as Record<string, number>)).toThrow(ExprError);
  });
});
