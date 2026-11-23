import { describe, expect, it } from 'vitest';
import { registryErrors, skillsById } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import type { Domain, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';

/** Words of each sentence (lines and . ! ? end a sentence; « · » and « : » are not words). */
function sentenceLengths(text: string): number[] {
  return text
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word)).length)
    .filter((length) => length > 0);
}

function skill(id: string, prerequisites: string[] = []): Skill {
  return {
    id,
    name: id,
    prerequisites,
    levels: 1,
    generate: () => {
      throw new Error('unused');
    },
    validate: () => false,
    hint: () => '',
  };
}

describe('registre', () => {
  it('is valid', () => {
    expect(registryErrors(DOMAINS)).toEqual([]);
  });

  it('detects duplicates, unknown prerequisites, cycles and unprefixed identifiers', () => {
    const broken: Domain[] = [
      {
        id: 'a',
        name: 'A',
        skills: [skill('a.x', ['a.z']), skill('a.y', ['a.x']), skill('a.z', ['a.y', 'a.missing'])],
      },
      { id: 'b', name: 'B', skills: [skill('b.y'), skill('b.y'), skill('z.w')] },
    ];
    const errors = registryErrors(broken);
    expect(errors).toContain('notion en double : b.y');
    expect(errors).toContain('a.z : prérequis inconnu a.missing');
    expect(errors).toContain("z.w n'est pas préfixée par b.");
    expect(errors.some((error) => error.startsWith('boucle de prérequis'))).toBe(true);
  });

  for (const [id, notion] of skillsById(DOMAINS)) {
    describe(id, () => {
      for (let level = 0; level < notion.levels; level++) {
        it(`level ${level}: exact answers and short hints on 1 000 seeds`, () => {
          for (let seed = 0; seed < 1000; seed++) {
            const exercise = notion.generate(new Rng(seed), level);
            expect(exercise.skill).toBe(id);
            expect(exercise.level).toBe(level);
            expect(notion.validate(exercise, exercise.answer)).toBe(true);
            if (exercise.input.kind === 'keypad') {
              expect(exercise.answer).toMatch(new RegExp(`^\\d{1,${exercise.input.maxDigits}}$`));
            } else {
              expect(exercise.input.options).toContain(exercise.answer);
            }
            for (const text of [
              exercise.instruction,
              notion.hint(exercise, 1),
              notion.hint(exercise, 2),
            ]) {
              expect(Math.max(...sentenceLengths(text)), text).toBeLessThanOrEqual(12);
            }
          }
        });
      }
    });
  }
});
