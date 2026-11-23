import { describe, expect, it } from 'vitest';
import { questErrors, registryErrors, skillsById } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import type { Domain, Quest, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import { QUESTS } from '../../src/quests';

/** Never a word of failure (child-ux instructions). */
const FAILURE_WORDS =
  /(?<!\p{L})(faux|fausse|erreurs?|rat[ée]e?s?|perdue?s?|échecs?|nulle?)(?!\p{L})/iu;

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

  it('detects facts without drill, long lessons and lessons on unknown notions', () => {
    const facts = { all: ['a.x:1', 'b.y:2'], of: () => null, seconds: 3 };
    const errors = registryErrors([
      {
        id: 'a',
        name: 'A',
        skills: [{ ...skill('a.x'), facts }],
        lessons: [
          {
            id: 'a.x/long',
            skill: 'a.x',
            title: 'L',
            steps: Array(7).fill({ kind: 'check', count: 2 }),
          },
          { id: 'a.z/lost', skill: 'a.z', title: 'L', steps: [{ kind: 'check', count: 2 }] },
        ],
      },
    ]);
    expect(errors).toEqual([
      'a.x : des faits sans rafale',
      "b.y:2 n'est pas préfixé par a.x:",
      'a.x/long : 7 étapes (1 à 6)',
      'a.z/lost : notion inconnue a.z',
    ]);
  });

  it('has valid quests', () => {
    expect(questErrors(QUESTS, DOMAINS)).toEqual([]);
  });

  it('detects quests too big, with too many new notions or unknown references', () => {
    const quest: Quest = {
      id: '2026-11-30',
      title: 'Q',
      until: '2026-11-23',
      skills: [
        { id: 'mental-math.add', isNew: true },
        { id: 'mental-math.subtract', isNew: true },
        { id: 'mental-math.complements', isNew: true, level: 9 },
        ...Array.from({ length: 12 }, () => ({ id: 'mental-math.add' })),
        { id: 'nowhere.x' },
      ],
      lessons: ['mental-math.add/nothing'],
    };
    expect(questErrors([quest], DOMAINS)).toEqual([
      'quête 2026-11-30 : période invalide',
      'quête 2026-11-30 : 3 notions nouvelles',
      'quête 2026-11-30 : 17 éléments',
      'quête 2026-11-30 : niveau 9 invalide pour mental-math.complements',
      'quête 2026-11-30 : notion inconnue nowhere.x',
      'quête 2026-11-30 : astuce inconnue mental-math.add/nothing',
    ]);
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
              expect(text).not.toMatch(FAILURE_WORDS);
            }
            const fact = notion.facts?.of(exercise);
            if (fact != null) expect(notion.facts!.all).toContain(fact);
          }
        });
      }
      if (notion.facts) {
        it('reaches every declared fact', () => {
          const reached = new Set<string | null>();
          for (let level = 0; level < notion.levels; level++) {
            for (let seed = 0; seed < 1000; seed++) {
              reached.add(notion.facts!.of(notion.generate(new Rng(seed), level)));
            }
          }
          for (const fact of notion.facts!.all) expect(reached).toContain(fact);
        });
      }
    });
  }
});
