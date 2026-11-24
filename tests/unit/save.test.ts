import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { DOMAINS } from '../../src/domains';
import { SAVE_SCHEMA_VERSION, parseSave, practiceSave, serializeSave } from '../../src/save/save';
import { newPainting, stageFor } from '../../src/scene/description';

const SKILLS = DOMAINS.flatMap((domain) => domain.skills);
const PAINTING = {
  ...newPainting(42, 'autumn', 'clearing'),
  stage: stageFor(2),
  elements: [
    { slot: 0, day: 199 },
    { slot: 2, day: 200 },
  ],
};
const JOURNAL = { started: 198, acquired: ['numbers.write-digits'], automated: [] };

/** A session that has played two trails. */
function played(): Session {
  const session = new Session(
    SKILLS,
    new Rng(2),
    () => 200,
    () => CLEARING,
  );
  for (let trail = 0; trail < 2; trail++) {
    session.startTrail();
    let i = 0;
    do {
      const { skill, exercise } = session.ask();
      session.conclude(skill, exercise, i % 3 !== 0, 1500, i % 3 === 0);
      i++;
    } while (session.advance());
  }
  return session;
}

describe('sauvegarde', () => {
  it('survives an export and an import', () => {
    const session = played();
    const json = serializeSave(
      {
        ...session.snapshot(),
        leaves: 3,
        seeds: 1,
        trailLength: 'short',
        painting: PAINTING,
        journal: JOURNAL,
      },
      new Date('2026-11-23T10:00:00Z'),
    );
    const parsed = parseSave(json, SKILLS);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({
      version: SAVE_SCHEMA_VERSION,
      savedAt: '2026-11-23T10:00:00.000Z',
      leaves: 3,
      seeds: 1,
      trailLength: 'short',
      painting: PAINTING,
      journal: JOURNAL,
    });
    const restored = new Session(
      SKILLS,
      new Rng(9),
      () => 200,
      () => CLEARING,
    );
    restored.restore(parsed.data);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.progress.size).toBeGreaterThan(0);
  });

  it('ignores notions and facts it does not know', () => {
    const session = played();
    const snapshot = session.snapshot();
    const json = serializeSave(
      {
        ...snapshot,
        progress: [...snapshot.progress, { ...snapshot.progress[0], skill: 'gone.skill' }],
        facts: [{ fact: 'gone.skill:1', tries: 1, right: 1, fastDays: [1], times: [900] }],
        leaves: 0,
        seeds: 0,
        trailLength: 'normal',
        painting: PAINTING,
        journal: JOURNAL,
      },
      new Date(),
    );
    const parsed = parseSave(json, SKILLS);
    expect(parsed.ok && parsed.data.progress.map((p) => p.skill)).toEqual(
      snapshot.progress.map((p) => p.skill),
    );
    expect(parsed.ok && parsed.data.facts).toEqual([]);
  });

  it('keeps the challenges played, and opens a save written before them', () => {
    const session = played();
    const basket = { kind: 'basket', seconds: 30 } as const;
    session.addAttempt('mental-math.add', basket, { day: 200, score: 12, rate: 0.8, level: 4 });
    const data = {
      ...session.snapshot(),
      leaves: 0,
      seeds: 0,
      trailLength: 'normal' as const,
      painting: PAINTING,
      journal: JOURNAL,
    };
    const parsed = parseSave(serializeSave(data, new Date()), SKILLS);
    expect(parsed.ok && parsed.data.records).toEqual([
      {
        skill: 'mental-math.add',
        format: 'basket-30',
        attempts: [{ day: 200, score: 12, rate: 0.8, level: 4 }],
      },
    ]);
    const before = JSON.parse(serializeSave(data, new Date())) as Record<string, unknown>;
    delete before.records;
    const old = parseSave(JSON.stringify(before), SKILLS);
    expect(old.ok && old.data.records).toEqual([]);
  });

  it.each([
    ['not JSON', '{', 'pas une sauvegarde'],
    ['another file', '[1, 2]', 'pas une sauvegarde'],
    ['a newer version', JSON.stringify({ version: SAVE_SCHEMA_VERSION + 1 }), 'plus récente'],
    ['an older version', JSON.stringify({ version: 0 }), 'ancienne version'],
    ['missing data', JSON.stringify({ version: SAVE_SCHEMA_VERSION, leaves: 1 }), 'abîmée'],
  ])('refuses %s with a reason', (_, json, reason) => {
    const parsed = parseSave(json, SKILLS);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.reason).toContain(reason);
  });

  it('refuses a damaged progress, painting or journal', () => {
    const save = (progress: never[], painting: object, journal: object = JOURNAL) =>
      serializeSave(
        {
          progress,
          facts: [],
          history: [],
          records: [],
          leaves: 0,
          seeds: 0,
          trailLength: 'normal',
          painting: painting as typeof PAINTING,
          journal: journal as typeof JOURNAL,
        },
        new Date(),
      );
    expect(parseSave(save([], PAINTING), SKILLS).ok).toBe(true);
    const lost = { skill: 'mental-math.add', stage: 'lost' } as never;
    expect(parseSave(save([lost], PAINTING), SKILLS).ok).toBe(false);
    const twice = { ...PAINTING, elements: [...PAINTING.elements, { slot: 0, day: 201 }] };
    expect(parseSave(save([], twice), SKILLS).ok).toBe(false);
    expect(parseSave(save([], { ...PAINTING, stage: 12 }), SKILLS).ok).toBe(false);
    expect(parseSave(save([], PAINTING, { ...JOURNAL, started: 1.5 }), SKILLS).ok).toBe(false);
    expect(parseSave(save([], PAINTING, { ...JOURNAL, acquired: [3] }), SKILLS).ok).toBe(false);
  });

  it('practises one notion from a level: the trail asks only it, at that level', () => {
    const compare = SKILLS.find((skill) => skill.id === 'numbers.compare')!;
    const practice = practiceSave(compare, 2, PAINTING, 200, { leaves: 0, seeds: 0 });
    expect(practice.ok && practice.data.progress).toEqual([
      { skill: compare.id, stage: 'learning', level: 2, recent: [], box: 0, due: null },
    ]);
    const session = new Session(
      [compare],
      new Rng(1),
      () => 200,
      () => CLEARING,
    );
    if (practice.ok) session.restore(practice.data);
    session.startTrail();
    expect(new Set(session.trail.map((step) => step.skill))).toEqual(new Set([compare.id]));
    expect(session.trail.find((step) => step.role === 'core')).toBeDefined();
    for (const level of [Number.NaN, -1, 99]) {
      const clamped = practiceSave(compare, level, PAINTING, 200, { leaves: 0, seeds: 0 });
      expect(clamped.ok && clamped.data.progress[0].level).toBe(
        level === 99 ? compare.levels - 1 : 0,
      );
    }
  });

  it('opens the sandbox as a new game, with the reserve given', () => {
    const sandbox = practiceSave(null, 3, PAINTING, 200, { leaves: 40, seeds: 5 });
    expect(sandbox.ok && sandbox.data).toMatchObject({ leaves: 40, seeds: 5, progress: [] });
  });
});
