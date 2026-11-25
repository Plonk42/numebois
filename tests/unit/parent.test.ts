import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { changeSetting } from '../../src/core/settings';
import { DOMAINS } from '../../src/domains';
import { readParentPart } from '../../src/save/parent';
import { parseSave, serializeSave } from '../../src/save/save';
import { newPainting } from '../../src/scene/description';
import { CLEARING } from './helpers';

const SKILLS = DOMAINS.flatMap((domain) => domain.skills);
const byId = (id: string) => SKILLS.find((skill) => skill.id === id)!;
const TABLES = SKILLS.find((skill) => skill.facts?.groups)!;

function session(): Session {
  return new Session(
    SKILLS,
    new Rng(3),
    () => 300,
    () => CLEARING,
  );
}

describe('tableau de bord parent (#47)', () => {
  it('keeps the settings, the automation, the plays and the recommendation in the save', () => {
    const played = session();
    played.settings = changeSetting(new Map(), TABLES, { mode: 'focus', maxLevel: 1 });
    played.automation = 1.5;
    played.longChallenges = true;
    played.addPlay({ day: 300, kind: 'trail', questions: 10, right: 8, ms: 240_000 });
    const group = TABLES.facts!.groups![0].id;
    const json = serializeSave(
      {
        ...played.snapshot(),
        leaves: 0,
        seeds: 0,
        trailLength: 'normal',
        painting: newPainting(1, 'summer', 'clearing'),
        journal: { started: 300, acquired: [], automated: [] },
        recommended: { skill: TABLES.id, group },
        name: 'Zébulon',
      },
      new Date(),
    );
    const parsed = parseSave(json, SKILLS);
    expect(parsed.ok && parsed.data).toMatchObject({
      settings: [{ skill: TABLES.id, mode: 'focus', minLevel: 0, maxLevel: 1 }],
      automation: 1.5,
      longChallenges: true,
      plays: [{ day: 300, kind: 'trail', questions: 10, right: 8, ms: 240_000 }],
      recommended: { skill: TABLES.id, group },
      name: 'Zébulon',
    });
    const restored = session();
    restored.restore(parsed.ok ? parsed.data : played.snapshot());
    expect(restored.snapshot()).toEqual(played.snapshot());
  });

  it('reads a save written before it with its defaults, and forgets what is gone', () => {
    expect(readParentPart({}, SKILLS)).toEqual({
      settings: [],
      automation: 1,
      longChallenges: false,
      plays: [],
      recommended: null,
      name: '',
    });
    const top = TABLES.levels - 1;
    expect(
      readParentPart(
        {
          settings: [
            { skill: 'gone.skill', mode: 'focus', minLevel: 0, maxLevel: 0 },
            { skill: TABLES.id, mode: 'open', minLevel: 0, maxLevel: top + 4 },
          ],
          recommended: { skill: TABLES.id, group: 'gone' },
          name: '  <b>zébulon</b> 42 de la forêt enchantée ',
        },
        SKILLS,
      ),
    ).toMatchObject({
      settings: [{ skill: TABLES.id, mode: 'open', minLevel: 0, maxLevel: top }],
      recommended: null,
      // Text only, bounded.
      name: 'B zébulon b de la fo',
    });
    for (const broken of [
      { settings: [{ skill: TABLES.id, mode: 'sometimes', minLevel: 0, maxLevel: 0 }] },
      { settings: 'focus' },
      { automation: 3 },
      { longChallenges: 'yes' },
      { name: 7 },
      { plays: [{ day: 1, kind: 'trail', questions: 2, right: 3, ms: 0 }] },
    ]) {
      expect(readParentPart(broken, SKILLS), JSON.stringify(broken)).toBeNull();
    }
  });

  it('keeps a notion within the levels the parent chose, as it learns', () => {
    const learner = session();
    const add = byId('mental-math.add');
    learner.settings = changeSetting(new Map(), add, { minLevel: 1, maxLevel: 2 });
    const rng = new Rng(4);
    const levels: number[] = [];
    for (let i = 0; i < 40; i++) {
      const exercise = add.generate(rng, 1, CLEARING);
      learner.learn(add, exercise, i % 7 !== 6, 3000);
      levels.push(learner.progress.get(add.id)!.level);
    }
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...levels)).toBe(2);
    // Acquired at the top of its range: the class is there.
    expect(learner.progress.get(add.id)!.stage).not.toBe('learning');
  });

  it('keeps the last plays only', () => {
    const player = session();
    for (let i = 0; i < 70; i++) {
      player.addPlay({ day: i, kind: 'drill', questions: 1, right: 1, ms: 1000 });
    }
    expect(player.plays).toHaveLength(60);
    expect(player.plays[0].day).toBe(10);
  });
});
