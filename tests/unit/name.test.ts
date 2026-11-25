import { describe, expect, it } from 'vitest';
import { cleanName, MAX_NAME_LENGTH, named } from '../../src/core/name';

describe('prénom de l’enfant (#138)', () => {
  it('keeps letters, single spaces, hyphens and apostrophes, with a capital first', () => {
    expect(cleanName('  zébulon  ')).toBe('Zébulon');
    expect(cleanName('Anne-Zoé')).toBe('Anne-Zoé');
    expect(cleanName('jean   paul')).toBe('Jean paul');
    expect(cleanName('d’Artagnan')).toBe('D’Artagnan');
    expect(cleanName('<script>alert(1)</script>')).toBe('Script alert script');
    expect(cleanName('Tom 🦊 2')).toBe('Tom');
    expect(cleanName(" -'- ")).toBe('');
    expect(cleanName('')).toBe('');
  });

  it('bounds the name, without a space or a hyphen at its end', () => {
    expect([...cleanName('a'.repeat(50))]).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName(`${'b'.repeat(MAX_NAME_LENGTH - 1)} c`)).toBe(
      `B${'b'.repeat(MAX_NAME_LENGTH - 2)}`,
    );
  });

  it('puts the name before the final mark, on one line with it', () => {
    expect(named('Sentier terminé !', 'Zébulon')).toBe('Sentier terminé, Zébulon\u00a0!');
    expect(named('Bonjour !', 'Zébulon')).toBe('Bonjour, Zébulon\u00a0!');
    expect(named('Prêt ?', 'Zébulon')).toBe('Prêt, Zébulon\u00a0?');
    expect(named('Bonjour', 'Zébulon')).toBe('Bonjour, Zébulon');
    expect(named('Bravo !', 'Anne-Zoé de la Tour')).toBe(
      'Bravo, Anne-\u2060Zoé\u00a0de\u00a0la\u00a0Tour\u00a0!',
    );
    expect(named('Sentier terminé !', '')).toBe('Sentier terminé !');
  });
});
