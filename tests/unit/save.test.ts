import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { DOMAINS } from '../../src/domains';
import { SAVE_SCHEMA_VERSION, parseSave, serializeSave } from '../../src/save/save';

const SKILLS = DOMAINS.flatMap((domain) => domain.skills);

/** A session that has played two trails. */
function played(): Session {
  const session = new Session(SKILLS, new Rng(2), () => 200);
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
      { ...session.snapshot(), leaves: 3, seeds: 1, trailLength: 'short' },
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
    });
    const restored = new Session(SKILLS, new Rng(9), () => 200);
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
      },
      new Date(),
    );
    const parsed = parseSave(json, SKILLS);
    expect(parsed.ok && parsed.data.progress.map((p) => p.skill)).toEqual(
      snapshot.progress.map((p) => p.skill),
    );
    expect(parsed.ok && parsed.data.facts).toEqual([]);
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

  it('refuses a damaged progress', () => {
    const json = serializeSave(
      {
        progress: [{ skill: 'mental-math.add', stage: 'lost' } as never],
        facts: [],
        history: [],
        leaves: 0,
        seeds: 0,
        trailLength: 'normal',
      },
      new Date(),
    );
    expect(parseSave(json, SKILLS).ok).toBe(false);
  });
});
