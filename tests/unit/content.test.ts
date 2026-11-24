import { describe, expect, it } from 'vitest';
import { OFFERED_CHOICES, offerChoices } from '../../src/core/choices';
import { exerciseErrors } from '../../src/core/content';
import { questErrors, registryErrors, skillsById } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import type { Domain, Quest, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import { QUESTS } from '../../src/quests';
import { BIOMES } from '../../src/scene/biomes';
import { BIOME_IDS } from '../../src/scene/description';

/** Each decor in turn: word problems tell of it. */
const contextOf = (seed: number) => ({
  vocabulary: BIOMES[BIOME_IDS[seed % BIOME_IDS.length]].vocabulary,
});

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
    const facts = {
      all: ['a.x:1', 'b.y:2'],
      of: () => null,
      exercise: () => {
        throw new Error('unused');
      },
      seconds: 3,
      groups: [
        { id: 'g', name: 'G', facts: ['a.x:1', 'a.x:3'] },
        { id: 'g', name: 'G', facts: [] },
      ],
    };
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
      'a.x : groupe de faits en double',
      'a.x : groupe g, fait inconnu a.x:3',
      'a.x : groupe g vide',
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

  it('detects answers outside the widget, long or unkind texts and undeclared facts', () => {
    const exercise = {
      skill: 'a.x',
      level: 0,
      instruction: 'Choisis. Puis choisis encore une fois.',
      statement: Array(26).fill('gland').join(' '),
      input: { kind: 'choice' as const, options: ['1', '1', '2', '3', '4'] },
      answer: '5',
    };
    const notion: Skill = {
      ...skill('a.x'),
      validate: () => true,
      hint: (_, attempt) =>
        attempt === 1 ? 'Ce n’est pas faux.' : 'Un. Deux. Trois. Ce sont quatre phrases.',
      drill: true,
      facts: {
        all: ['a.x:1'],
        of: () => 'a.x:2',
        exercise: () => exercise,
        seconds: 3,
      },
    };
    expect(exerciseErrors(notion, exercise, 1)).toEqual([
      'niveau 0 au lieu de 1',
      'réponse « 5 » hors du widget choice',
      'choix en double',
      '5 choix (2 à 4)',
      'consigne : 2 phrases : Choisis. Puis choisis encore une fois.',
      `énoncé de 26 mots : ${exercise.statement}`,
      "indice 1 : mot d'échec : Ce n’est pas faux.",
      'indice 2 : 4 phrases : Un. Deux. Trois. Ce sont quatre phrases.',
      'fait non déclaré : a.x:2',
    ]);
    const keypad = { ...exercise, input: { kind: 'keypad' as const, maxDigits: 2 }, answer: '123' };
    expect(exerciseErrors(notion, keypad, 0)).toContain('réponse « 123 » hors du widget keypad');
    const long = 'Compte les glands un par un.\n'.repeat(5).trim();
    expect(exerciseErrors({ ...notion, hint: () => long }, keypad, 0)).toContain(
      `indice 1 : ${long.length} caractères : ${long}`,
    );
  });

  for (const [id, notion] of skillsById(DOMAINS)) {
    describe(id, () => {
      for (let level = 0; level < notion.levels; level++) {
        it(`level ${level}: exact answers, fitting the widget, short and kind texts, on 1 000 seeds`, () => {
          for (let seed = 0; seed < 1000; seed++) {
            const exercise = notion.generate(new Rng(seed), level, contextOf(seed));
            const errors = exerciseErrors(notion, exercise, level);
            if (errors.length > 0) expect(errors, `graine ${seed}`).toEqual([]);
            // The same question offered among choices, as the trail sometimes does.
            if (exercise.input.kind !== 'keypad') continue;
            const offered = offerChoices(notion, exercise, new Rng(seed));
            const choices = offered.input.kind === 'choice' ? offered.input.options : [];
            const wrongs = exerciseErrors(notion, offered, level);
            if (wrongs.length > 0 || choices.length !== OFFERED_CHOICES) {
              expect({ wrongs, choices: choices.length }, `graine ${seed}, choix`).toEqual({
                wrongs: [],
                choices: OFFERED_CHOICES,
              });
            }
          }
        });
      }
      if (notion.facts) {
        it('reaches every declared fact', () => {
          const reached = new Set<string | null>();
          for (let level = 0; level < notion.levels; level++) {
            for (let seed = 0; seed < 1000; seed++) {
              reached.add(notion.facts!.of(notion.generate(new Rng(seed), level, contextOf(seed))));
            }
          }
          for (const fact of notion.facts!.all) expect(reached).toContain(fact);
        });

        it('asks each declared fact in a drill', () => {
          for (const fact of notion.facts!.all) {
            for (let seed = 0; seed < 10; seed++) {
              const exercise = notion.facts!.exercise(fact, new Rng(seed));
              expect(notion.facts!.of(exercise)).toBe(fact);
              expect(exerciseErrors(notion, exercise, exercise.level), fact).toEqual([]);
            }
          }
        });
      }
    });
  }
});
