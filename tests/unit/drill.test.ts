import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { COMEBACK, Drill, DRILL_RATE, HARD_RUN, fragileFacts } from '../../src/core/drill';
import { isSure, newFact, type FactProgress } from '../../src/core/facts';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import type { Exercise } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';

const SKILLS = curriculum(DOMAINS);
const products = SKILLS.find((skill) => skill.id === 'times-tables.products')!;
const complements = SKILLS.find((skill) => skill.id === 'mental-math.complements')!;
const TABLE_7 = products.facts!.groups!.find((group) => group.id === 'table-7')!.facts;

function session(day = () => 100): Session {
  return new Session(SKILLS, new Rng(1), day, () => CLEARING);
}

const automated = (fact: string): FactProgress => ({
  ...newFact(fact),
  tries: 3,
  right: 3,
  fastDays: [1, 2, 3],
});

describe('drill', () => {
  it('asks a missed question again 2 or 3 questions later', () => {
    const gaps = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const drill = new Drill(
        session(),
        { kind: 'skill', skill: products.id, group: 'table-7' },
        new Rng(seed),
      );
      const asked: Exercise[] = [];
      for (let i = 0; i < 12; i++) {
        const { skill, exercise } = drill.ask();
        expect(TABLE_7).toContain(skill.facts!.of(exercise));
        asked.push(exercise);
        drill.conclude(skill, exercise, i !== 5, 2000);
      }
      gaps.add(asked.indexOf(asked[5], 6) - 5);
    }
    expect([...gaps].sort()).toEqual([...COMEBACK]);
  });

  it('mixes sure facts in to keep about 80 % right', () => {
    // A child who knows the sure facts, half of the hard ones, and most of a missed one
    // when it comes back (the answer was just shown).
    const rates: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const player = session();
      for (const fact of TABLE_7.slice(0, 4)) player.facts.set(fact, automated(fact));
      const drill = new Drill(
        player,
        { kind: 'skill', skill: products.id, group: 'table-7' },
        new Rng(seed),
      );
      const child = new Rng(1000 + seed);
      const missed = new Set<Exercise>();
      for (let i = 0; i < 200; i++) {
        const { skill, exercise } = drill.ask();
        const sure = isSure(player.facts.get(skill.facts!.of(exercise)!));
        const right = sure || child.chance(missed.has(exercise) ? 0.8 : 0.5);
        if (!right) missed.add(exercise);
        drill.conclude(skill, exercise, right, 2000);
      }
      rates.push(drill.results.filter(Boolean).length / drill.results.length);
    }
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    expect(mean).toBeGreaterThan(DRILL_RATE - 0.04);
    expect(mean).toBeLessThan(DRILL_RATE + 0.04);
  });

  it('never asks more than two hard facts in a row while sure ones remain', () => {
    const player = session();
    for (const fact of TABLE_7.slice(0, 3)) player.facts.set(fact, automated(fact));
    const drill = new Drill(
      player,
      { kind: 'skill', skill: products.id, group: 'table-7' },
      new Rng(4),
    );
    let run = 0;
    for (let i = 0; i < 60; i++) {
      const { skill, exercise } = drill.ask();
      run = isSure(player.facts.get(skill.facts!.of(exercise)!)) ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(HARD_RUN);
      drill.conclude(skill, exercise, true, 2000);
    }
  });

  it('automates a fact after 3 fast right answers on different days, never with slow ones', () => {
    for (const [ms, expected] of [
      [1500, complements.facts!.all.length],
      [6000, 0],
    ] as const) {
      let day = 100;
      const player = session(() => day);
      const automatedOn: number[] = [];
      for (; day < 103; day++) {
        const drill = new Drill(player, { kind: 'skill', skill: complements.id }, new Rng(day));
        for (let i = 0; i < 60; i++) {
          const { skill, exercise } = drill.ask();
          for (const achievement of drill.conclude(skill, exercise, true, ms)) {
            if (achievement.kind === 'automated') automatedOn.push(day);
          }
        }
      }
      expect(automatedOn).toHaveLength(expected);
      expect(automatedOn.every((on) => on === 102)).toBe(true);
    }
  });

  it('offers the facts met and not automated as fragile, least automated first', () => {
    const [a, b, c, d] = TABLE_7;
    const player = session();
    player.facts.set(a, { ...newFact(a), tries: 4, right: 3, fastDays: [1] });
    player.facts.set(b, { ...newFact(b), tries: 4, right: 1 });
    player.facts.set(c, automated(c));
    expect(fragileFacts(SKILLS, player.facts).map(({ fact }) => fact)).toEqual([b, a]);
    const drill = new Drill(player, { kind: 'fragile' }, new Rng(2));
    const asked = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { skill, exercise } = drill.ask();
      asked.add(skill.facts!.of(exercise)!);
      drill.conclude(skill, exercise, true, 2000);
    }
    expect(asked).toEqual(new Set([a, b, c]));
    expect(asked).not.toContain(d);
  });

  it('feeds the mastery and the review of the notion', () => {
    const player = session();
    player.progress.set(complements.id, {
      skill: complements.id,
      stage: 'acquired',
      level: complements.levels - 1,
      recent: [],
      box: 0,
      due: 100,
    });
    const drill = new Drill(player, { kind: 'skill', skill: complements.id }, new Rng(3));
    const { skill, exercise } = drill.ask();
    drill.conclude(skill, exercise, true, 2000);
    expect(player.progress.get(complements.id)).toMatchObject({ stage: 'maintenance', box: 1 });
  });

  it('mixes easier questions in a notion without facts', () => {
    const add = SKILLS.find((skill) => skill.id === 'mental-math.add')!;
    const top = add.levels - 1;
    const player = session();
    player.progress.set(add.id, {
      skill: add.id,
      stage: 'anchored',
      level: top,
      recent: [],
      box: 0,
      due: null,
    });
    const drill = new Drill(player, { kind: 'skill', skill: add.id }, new Rng(5));
    const levels = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const { skill, exercise } = drill.ask();
      expect(skill.validate(exercise, exercise.answer)).toBe(true);
      levels.add(exercise.level);
      drill.conclude(skill, exercise, true, 2000);
    }
    expect(levels).toEqual(new Set([top - 1, top]));
  });
});
