import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { nearNumbers, offerChoices } from '../../src/core/choices';
import {
  LEAVES_PER_ELEMENT,
  LEAVES_PER_RIGHT_ANSWER,
  leavesPerElement,
} from '../../src/core/economy';
import { bestLevel, newProgress, type SkillProgress } from '../../src/core/mastery';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session, type Achievement } from '../../src/core/session';
import { defaultSetting } from '../../src/core/settings';
import { atRecord, TRAIL_QUESTIONS, type StepRole } from '../../src/core/trail';
import { DOMAINS, ORDER } from '../../src/domains';
import { LAST_STAGE } from '../../src/scene/description';

const SKILLS = curriculum(DOMAINS, ORDER);

/** Plays the trail in progress; `right(i)` tells whether question i is right first time. */
function play(session: Session, right: (i: number) => boolean = () => true): string[] {
  const asked: string[] = [];
  let previous;
  do {
    const { skill, exercise } = session.ask(previous);
    expect(skill.validate(exercise, exercise.answer)).toBe(true);
    const ok = right(asked.length);
    asked.push(skill.id);
    session.conclude(skill, exercise, ok, 2000, !ok);
    previous = exercise;
  } while (session.advance());
  return asked;
}

describe('session', () => {
  it('plays whole trails and opens a new notion once the first is under way', () => {
    const session = new Session(
      SKILLS,
      new Rng(3),
      () => 100,
      () => CLEARING,
    );
    session.startTrail();
    expect(new Set(play(session))).toEqual(new Set(['numbers.write-digits']));
    expect(session.progress.get('numbers.write-digits')?.level).toBe(3);
    session.startTrail();
    expect(session.trail.find((step) => step.role === 'new')?.skill).toBe('mental-math.sums');
    expect(play(session)).toHaveLength(TRAIL_QUESTIONS.normal);
  });

  it('ends on a success: one more easy question after a missed last one, on the last stone', () => {
    const session = new Session(
      SKILLS,
      new Rng(5),
      () => 100,
      () => CLEARING,
    );
    session.startTrail();
    const last = TRAIL_QUESTIONS.normal - 1;
    const asked = play(session, (i) => i !== last);
    expect(asked).toHaveLength(TRAIL_QUESTIONS.normal + 1);
    expect(session.stones).toBe(TRAIL_QUESTIONS.normal);
    expect(session.stone).toBe(TRAIL_QUESTIONS.normal - 1);
    expect(session.trail.at(-1)).toMatchObject({ role: 'finish', easy: true });
  });

  it('records the facts of fact notions', () => {
    const session = new Session(
      SKILLS,
      new Rng(1),
      () => 100,
      () => CLEARING,
    );
    const complements = SKILLS.find((skill) => skill.id === 'mental-math.complements')!;
    const exercise = complements.generate(new Rng(1), 0, CLEARING);
    session.conclude(complements, exercise, true, 1500, false);
    const fact = complements.facts!.of(exercise)!;
    expect(session.facts.get(fact)).toMatchObject({ tries: 1, right: 1, fastDays: [100] });
    // Among choices, the answer counts for the notion, never for the fact.
    const offered = offerChoices(complements, exercise, new Rng(2));
    expect(offered.input.kind).toBe('choice');
    session.conclude(complements, offered, true, 900, false);
    expect(session.facts.get(fact)).toMatchObject({ tries: 1 });
    expect(session.progress.get(complements.id)?.recent).toHaveLength(2);
  });

  it('offers about one keypad question in three among choices, never the first one', () => {
    const counts = { first: 0, offered: 0, keypad: 0 };
    for (let seed = 0; seed < 60; seed++) {
      const session = new Session(
        SKILLS,
        new Rng(seed),
        () => 100,
        () => CLEARING,
      );
      session.startTrail();
      let previous;
      do {
        const { skill, exercise } = session.ask(previous);
        if (session.index === 0) counts.first += exercise.input.kind === 'choice' ? 1 : 0;
        else if (exercise.input.kind === 'choice') counts.offered++;
        else counts.keypad++;
        session.conclude(skill, exercise, true, 2000, false);
        previous = exercise;
      } while (session.advance());
    }
    expect(counts.first).toBe(0);
    const share = counts.offered / (counts.offered + counts.keypad);
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.42);
  });

  it('offers plausible lures: a neighbouring table, a carry, ten off', () => {
    const products = SKILLS.find((skill) => skill.id === 'times-tables.products')!;
    const exercise = { ...products.generate(new Rng(1), 0, CLEARING), a: 7, b: 8, answer: '56' };
    const offered = offerChoices(products, exercise, new Rng(5));
    const options = offered.input.kind === 'choice' ? offered.input.options : [];
    expect(options).toContain('56');
    expect(new Set(options).size).toBe(4);
    // Three of 49, 63, 48, 64 and 15.
    expect(options.filter((o) => ['49', '63', '48', '64', '15'].includes(o))).toHaveLength(3);
    // As many digits (35 is not), then a rank too far.
    expect(nearNumbers(305)).toEqual([306, 304, 315, 295, 405, 205, 350, 3050, 30.5]);
    expect(nearNumbers(4).filter((n) => n > 9)).toEqual([40]);
  });

  it('gives the golden seed of a fact once, even if it is missed then automated again (#123)', () => {
    let today = 100;
    const session = new Session(
      SKILLS,
      new Rng(1),
      () => today,
      () => CLEARING,
    );
    const complements = SKILLS.find((skill) => skill.id === 'mental-math.complements')!;
    const exercise = complements.generate(new Rng(1), 0, CLEARING);
    const fact = complements.facts!.of(exercise)!;
    const learnt = (right: boolean) =>
      session.learn(complements, exercise, right, 900).filter((a) => a.kind === 'automated');
    expect([0, 1, 2, 3].flatMap(() => (today++, learnt(true)))).toHaveLength(1);
    expect(learnt(false)).toEqual([]);
    expect(session.facts.get(fact)).toMatchObject({ fastDays: [], known: true });
    expect([0, 1, 2, 3].flatMap(() => (today++, learnt(true)))).toEqual([]);
  });

  it('reports a notion acquired and a fact automated, once', () => {
    const session = new Session(
      SKILLS,
      new Rng(1),
      () => 100,
      () => CLEARING,
    );
    const complements = SKILLS.find((skill) => skill.id === 'mental-math.complements')!;
    const top = complements.levels - 1;
    // A fact of the first level; the answer counts at the notion's level all the same.
    const exercise = complements.generate(new Rng(1), 0, CLEARING);
    const fact = complements.facts!.of(exercise)!;
    session.restore({
      progress: [
        {
          skill: complements.id,
          stage: 'learning',
          level: top,
          recent: Array.from({ length: 4 }, () => ({ level: top, right: true, day: 99 })),
          box: 0,
          due: null,
        },
      ],
      facts: [{ fact, tries: 2, right: 2, fastDays: [98, 99], times: [900, 900] }],
      history: [],
      records: [],
      settings: [],
      automation: 1,
      longChallenges: false,
      plays: [],
    });
    expect(session.conclude(complements, exercise, true, 900, false)).toEqual([
      { kind: 'acquired', skill: complements.id },
      { kind: 'automated', fact },
    ]);
    expect(session.conclude(complements, exercise, true, 900, false)).toEqual([]);
  });
});

describe('payer l’effort (#141)', () => {
  const newSession = () =>
    new Session(
      SKILLS,
      new Rng(4),
      () => 100,
      () => CLEARING,
    );

  /** Plays a trail: the leaves its right answers earn per question, and the levels reached. */
  function earn(session: Session, right: boolean) {
    session.startTrail();
    let leaves = 0;
    let questions = 0;
    const levels: Achievement[] = [];
    let previous;
    do {
      const { skill, exercise } = session.ask(previous);
      questions++;
      if (right) leaves += session.worth;
      const achievements = session.conclude(skill, exercise, right, 2000, !right);
      levels.push(...achievements.filter((a) => a.kind === 'level'));
      previous = exercise;
    } while (session.advance());
    return { perQuestion: leaves / questions, levels };
  }

  it('pays a trail spoilt on purpose less than a trail at the child’s level, and no seed', () => {
    const honest = newSession();
    const sly = newSession();
    for (let i = 0; i < 3; i++) {
      earn(honest, true);
      earn(sly, true);
    }
    // Mistakes on purpose until the trail gets easier.
    earn(sly, false);
    earn(sly, false);
    const best = new Map([...sly.progress].map(([id, progress]) => [id, bestLevel(progress)]));
    const spoilt = earn(sly, true);
    expect(sly.trail.filter((step) => step.role === 'warmup')).toHaveLength(3);
    const fair = earn(honest, true);
    // Only a notion opened meanwhile climbs its first level, as at the child's level.
    for (const level of spoilt.levels) {
      expect(level).toMatchObject({ level: 1 });
      if (level.kind === 'level') expect(best.get(level.skill) ?? 0).toBe(0);
    }
    expect(spoilt.perQuestion).toBe(LEAVES_PER_RIGHT_ANSWER);
    expect(fair.perQuestion).toBeGreaterThan(spoilt.perQuestion);
  });

  it('gives a golden seed for each level reached, once, even after going down and up', () => {
    const session = newSession();
    const complements = SKILLS.find((skill) => skill.id === 'mental-math.complements')!;
    const exercise = complements.generate(new Rng(1), 0, CLEARING);
    const levels = [true, true, true, false, false, false, true, true, true, true, true, true]
      .flatMap((right) => session.learn(complements, exercise, right, 900))
      .filter((a) => a.kind === 'level');
    expect(levels).toEqual([
      { kind: 'level', skill: complements.id, level: 1 },
      { kind: 'level', skill: complements.id, level: 2 },
    ]);
    expect(session.progress.get(complements.id)).toMatchObject({ level: 2, best: 2 });
  });

  it('pays double at the record only, and asks more for an element as the painting grows', () => {
    const setting = defaultSetting(SKILLS[0]);
    const learning = { ...newProgress('a'), stage: 'learning', level: 2, best: 3 } as const;
    const at = (role: StepRole, level: number, progress: SkillProgress = learning, easy = false) =>
      atRecord({ skill: 'a', role, easy }, level, progress, setting);
    expect(at('core', 3, { ...learning, level: 3 })).toBe(true);
    expect(at('core', 2)).toBe(false);
    expect(at('new', 0, newProgress('a'))).toBe(true);
    expect(at('warmup', 3)).toBe(false);
    expect(at('finish', 3)).toBe(false);
    expect(at('core', 3, learning, true)).toBe(false);
    const acquired = { ...learning, stage: 'acquired', level: 3 } as const;
    expect(at('review', 3, acquired)).toBe(true);
    expect(at('core', 3, acquired)).toBe(false);
    expect(leavesPerElement(0)).toBe(LEAVES_PER_ELEMENT);
    expect(leavesPerElement(LAST_STAGE)).toBeGreaterThan(leavesPerElement(6));
  });
});
