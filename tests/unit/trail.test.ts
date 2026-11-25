import { describe, expect, it } from 'vitest';
import { newProgress, type SkillProgress, type Stage } from '../../src/core/mastery';
import { Rng } from '../../src/core/rng';
import { changeSetting, defaultSetting, type SkillMode } from '../../src/core/settings';
import {
  MAX_ACTIVE,
  TRAIL_QUESTIONS,
  composeTrail,
  revisit,
  stepLevel,
  type TrailInput,
} from '../../src/core/trail';
import type { Skill } from '../../src/core/types';

function skill(id: string, prerequisites: string[] = []): Skill {
  return {
    id,
    name: id,
    prerequisites,
    levels: 3,
    generate: () => {
      throw new Error('unused');
    },
    validate: () => false,
    hint: () => '',
  };
}

const SKILLS = [skill('d.a'), skill('d.b'), skill('d.c'), skill('d.d'), skill('d.e', ['d.a'])];

function at(id: string, stage: Stage, extra: Partial<SkillProgress> = {}): [string, SkillProgress] {
  return [id, { ...newProgress(id), stage, level: 1, ...extra }];
}

function trail(progress: [string, SkillProgress][], extra: Partial<TrailInput> = {}) {
  return composeTrail({
    skills: SKILLS,
    progress: new Map(progress),
    day: 10,
    length: 'normal',
    recentRate: null,
    slowing: false,
    settings: new Map(),
    rng: new Rng(1),
    ...extra,
  });
}

describe('sentier', () => {
  it('opens the first notion on the very first trail', () => {
    const steps = trail([]);
    expect(steps).toHaveLength(TRAIL_QUESTIONS.normal);
    expect(new Set(steps.map((s) => s.skill))).toEqual(new Set(['d.a']));
    expect(steps.map((s) => s.role)).toEqual([
      'warmup',
      'warmup',
      'new',
      ...Array(6).fill('core'),
      'finish',
    ]);
    expect(steps.at(-1)!.easy).toBe(true);
  });

  it('opens one new notion at a time, only with its prerequisites acquired', () => {
    const steps = trail([at('d.a', 'learning'), at('d.b', 'acquired', { due: 20 })]);
    expect(steps.filter((s) => s.role === 'new')).toEqual([
      { skill: 'd.c', role: 'new', easy: false },
    ]);
    const opened = trail([
      at('d.a', 'anchored', { due: null }),
      at('d.b', 'learning'),
      at('d.c', 'learning'),
    ]);
    expect(opened.find((s) => s.role === 'new')?.skill).toBe('d.d');
  });

  it('keeps at most 3 notions in progress', () => {
    const steps = trail([at('d.a', 'learning'), at('d.b', 'learning'), at('d.c', 'learning')]);
    expect(steps.some((s) => s.role === 'new')).toBe(false);
    expect(new Set(steps.filter((s) => s.role === 'core').map((s) => s.skill)).size).toBe(3);
  });

  it('caps the reviews at 25 %, oldest first, the others wait', () => {
    const steps = trail([
      at('d.a', 'maintenance', { due: 9 }),
      at('d.b', 'maintenance', { due: 4 }),
      at('d.c', 'acquired', { due: 7 }),
      at('d.d', 'maintenance', { due: 11 }),
      at('d.e', 'learning'),
    ]);
    expect(steps.filter((s) => s.role === 'review').map((s) => s.skill)).toEqual(['d.b', 'd.c']);
    expect(steps).toHaveLength(TRAIL_QUESTIONS.normal);
  });

  it('is easier, without novelty, under 70 % of right answers', () => {
    const steps = trail([at('d.a', 'learning'), at('d.b', 'acquired', { due: 30 })], {
      recentRate: 0.6,
    });
    expect(steps.filter((s) => s.role === 'warmup')).toHaveLength(3);
    expect(steps.some((s) => s.role === 'new')).toBe(false);
    expect(steps.filter((s) => s.role === 'core').every((s) => s.easy)).toBe(true);
  });

  it('is shorter when the answers slow down', () => {
    expect(trail([], { slowing: true })).toHaveLength(TRAIL_QUESTIONS.short);
    expect(trail([], { length: 'short' })).toHaveLength(TRAIL_QUESTIONS.short);
  });

  it('keeps the acquired notions alive when there is nothing new', () => {
    const all = SKILLS.map((s) => at(s.id, 'anchored', { due: null }));
    const steps = trail(all);
    expect(steps).toHaveLength(TRAIL_QUESTIONS.normal);
    expect(steps.some((s) => s.role === 'new' || s.role === 'review')).toBe(false);
  });

  it('respects its limits whatever the progress (500 random states)', () => {
    const stages: Stage[] = ['discovery', 'learning', 'acquired', 'maintenance', 'anchored'];
    for (let seed = 0; seed < 500; seed++) {
      const rng = new Rng(seed);
      const progress = SKILLS.map((s) =>
        at(s.id, rng.pick(stages), { level: rng.int(0, 2), due: rng.int(5, 15) }),
      );
      for (const length of ['short', 'normal'] as const) {
        const steps = trail(progress, { length, recentRate: rng.pick([null, 0.5, 0.9]), rng });
        const size = TRAIL_QUESTIONS[length];
        expect(steps).toHaveLength(size);
        expect(steps.filter((s) => s.role === 'review').length).toBeLessThanOrEqual(size / 4);
        expect(steps.filter((s) => s.role === 'new').length).toBeLessThanOrEqual(1);
        const inProgress = steps.filter((s) => s.role === 'core' || s.role === 'new');
        expect(new Set(inProgress.map((s) => s.skill)).size).toBeLessThanOrEqual(MAX_ACTIVE);
        expect(steps.at(-1)).toMatchObject({ role: 'finish', easy: true });
      }
    }
  });

  it('brings a close question back later, keeping its size', () => {
    const steps = trail([at('d.a', 'learning'), at('d.b', 'learning')]);
    const again = revisit(steps, 2);
    expect(again).toHaveLength(steps.length);
    expect(again.findIndex((s) => s.role === 'again')).toBeGreaterThanOrEqual(4);
    expect(again.find((s) => s.role === 'again')!.skill).toBe(steps[2].skill);
    expect(revisit(steps, steps.length - 2)).toEqual(steps);
  });

  it('asks easy steps one level below', () => {
    const progress = { ...newProgress('d.a'), level: 2 };
    const all = defaultSetting(SKILLS[0]);
    expect(stepLevel({ skill: 'd.a', role: 'warmup', easy: true }, progress, all)).toBe(1);
    expect(stepLevel({ skill: 'd.a', role: 'core', easy: false }, progress, all)).toBe(2);
    expect(stepLevel({ skill: 'd.a', role: 'warmup', easy: true }, undefined, all)).toBe(0);
    // Within the levels the parent chose.
    const middle = { ...all, minLevel: 1, maxLevel: 1 };
    expect(stepLevel({ skill: 'd.a', role: 'core', easy: false }, progress, middle)).toBe(1);
    expect(stepLevel({ skill: 'd.a', role: 'warmup', easy: true }, undefined, middle)).toBe(1);
  });
});

describe('réglages du parent (#47)', () => {
  const set = (entries: [string, SkillMode][]) => {
    let settings = new Map();
    for (const [id, mode] of entries) {
      settings = changeSetting(
        settings,
        SKILLS.find((s) => s.id === id)!,
        { mode },
      );
    }
    return settings;
  };
  const seeds = Array.from({ length: 50 }, (_, i) => i);

  it('never offers a closed notion, neither new nor in review', () => {
    for (const seed of seeds) {
      const steps = trail([at('d.a', 'acquired', { due: 5 }), at('d.b', 'learning')], {
        settings: set([
          ['d.a', 'closed'],
          ['d.c', 'closed'],
        ]),
        rng: new Rng(seed),
      });
      expect(steps.map((s) => s.skill)).not.toContain('d.a');
      expect(steps.map((s) => s.skill)).not.toContain('d.c');
    }
  });

  it('brings an open notion at once, without its prerequisites', () => {
    const steps = trail([], { settings: set([['d.e', 'open']]) });
    expect(steps.filter((s) => s.role === 'new')).toEqual([
      { skill: 'd.e', role: 'new', easy: false },
    ]);
  });

  it('gives at least half of the trail to the notions in focus, two at most', () => {
    const progress = [
      at('d.a', 'learning'),
      at('d.b', 'learning'),
      at('d.c', 'acquired', { due: 5 }),
      at('d.d', 'acquired', { due: 5 }),
    ];
    for (const seed of seeds) {
      for (const length of ['short', 'normal'] as const) {
        const focus = trail(progress, {
          settings: set([['d.d', 'focus']]),
          rng: new Rng(seed),
          length,
        });
        const own = focus.filter((s) => s.skill === 'd.d').length;
        expect(own).toBeGreaterThanOrEqual(Math.ceil(focus.length / 2));
        expect(focus).toHaveLength(TRAIL_QUESTIONS[length]);
      }
    }
    // A third one takes the place of the oldest.
    const three = set([
      ['d.a', 'focus'],
      ['d.b', 'focus'],
      ['d.c', 'focus'],
    ]);
    expect([...three.values()].filter((s) => s.mode === 'focus').map((s) => s.skill)).toEqual([
      'd.b',
      'd.c',
    ]);
    // A notion in focus starts even before its prerequisites.
    expect(trail([], { settings: set([['d.e', 'focus']]) }).map((s) => s.skill)).toContain('d.e');
  });

  it('keeps the range ordered and within the levels of the notion', () => {
    const d = SKILLS[0];
    let settings = changeSetting(new Map(), d, { minLevel: 2 });
    expect(settings.get('d.a')).toMatchObject({ minLevel: 2, maxLevel: 2 });
    settings = changeSetting(settings, d, { maxLevel: 0 });
    expect(settings.get('d.a')).toMatchObject({ minLevel: 0, maxLevel: 0 });
    settings = changeSetting(settings, d, { maxLevel: 9 });
    // Back to auto on the whole range: nothing kept.
    expect(settings.has('d.a')).toBe(false);
  });
});
