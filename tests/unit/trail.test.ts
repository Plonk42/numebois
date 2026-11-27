import { describe, expect, it } from 'vitest';
import { QUESTION_SECONDS, questionSeconds } from '../../src/core/economy';
import { newProgress, type SkillProgress, type Stage } from '../../src/core/mastery';
import { Rng } from '../../src/core/rng';
import { changeSetting, defaultSetting, type SkillMode } from '../../src/core/settings';
import {
  MAX_ACTIVE,
  MAX_LEARNING,
  TRAIL_QUESTIONS,
  composeTrail,
  revisit,
  stepLevel,
  type TrailInput,
  type TrailStep,
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

  it('asks at most 3 notions in progress in a trail, and opens others meanwhile', () => {
    const steps = trail([at('d.a', 'learning'), at('d.b', 'learning'), at('d.c', 'learning')]);
    expect(steps.find((s) => s.role === 'new')?.skill).toBe('d.d');
    const asked = steps.filter((s) => s.role === 'core' || s.role === 'new').map((s) => s.skill);
    expect(new Set(asked).size).toBe(MAX_ACTIVE);
  });

  it('lets up to 8 notions in progress take turns, seen longest ago first, one per domain', () => {
    const skills = ['a.1', 'a.2', 'b.1', 'c.1', 'd.1', 'e.1', 'f.1', 'g.1', 'h.1'].map((id) =>
      skill(id),
    );
    const seen = (id: string, day: number, answers = 1) =>
      at(id, 'learning', {
        recent: Array.from({ length: answers }, () => ({ level: 1, right: true, day })),
      });
    const progress = [
      seen('a.1', 1),
      seen('a.2', 1),
      seen('b.1', 1, 2),
      seen('c.1', 2),
      ...['d.1', 'e.1', 'f.1', 'g.1'].map((id) => seen(id, 9)),
    ];
    expect(progress).toHaveLength(MAX_LEARNING);
    const steps = trail(progress, { skills });
    expect(steps.some((s) => s.role === 'new')).toBe(false);
    const core = steps.filter((s) => s.role === 'core').map((s) => s.skill);
    expect(new Set(core)).toEqual(new Set(['a.1', 'b.1', 'c.1']));
    expect(trail(progress.slice(0, -1), { skills }).find((s) => s.role === 'new')?.skill).toBe(
      'g.1',
    );
    // During a focus, nothing opens while 3 are in progress.
    const focus = changeSetting(new Map(), skills[4], { mode: 'focus' });
    const focused = trail(progress.slice(0, 3), { skills, settings: focus });
    expect(focused.some((s) => s.role === 'new')).toBe(false);
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

  it('is shorter with long questions, in the time of the quick ones (#153)', () => {
    const long = { ...SKILLS[0], questionSeconds: [36, 36, 36] };
    const skills = [long, ...SKILLS.slice(1)];
    const steps = trail([at('d.a', 'learning'), at('d.b', 'acquired', { due: 30 })], { skills });
    const seconds = (s: TrailStep) =>
      questionSeconds(
        skills.find((k) => k.id === s.skill)!,
        1,
      );
    expect(steps.length).toBeLessThan(TRAIL_QUESTIONS.normal);
    expect(steps.reduce((sum, s) => sum + seconds(s), 0)).toBeLessThanOrEqual(
      TRAIL_QUESTIONS.normal * QUESTION_SECONDS,
    );
    expect(steps.filter((s) => s.role === 'core').map((s) => s.skill)).toContain('d.a');
    expect(steps.at(-1)).toMatchObject({ role: 'finish', easy: true });
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

  it('gives at least half of the trail to the notions in focus, 3 at most in each', () => {
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
    // As many as the parent wants: they share the trails, 3 at most in each, seen longest ago first.
    const four = set([
      ['d.a', 'focus'],
      ['d.b', 'focus'],
      ['d.c', 'focus'],
      ['d.d', 'focus'],
    ]);
    expect([...four.values()].filter((s) => s.mode === 'focus')).toHaveLength(4);
    const seen = (id: string, day: number) =>
      at(id, 'learning', { recent: [{ level: 1, right: true, day }] });
    const shared = trail([seen('d.a', 9), seen('d.b', 3), seen('d.c', 5), seen('d.d', 7)], {
      settings: four,
    });
    expect(new Set(shared.map((s) => s.skill))).toEqual(new Set(['d.b', 'd.c', 'd.d']));
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
