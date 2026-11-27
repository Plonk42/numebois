import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import {
  COMEBACK,
  SPACING,
  Drill,
  DRILL_RATE,
  HARD_RUN,
  fragileFacts,
  suggestedBranch,
} from '../../src/core/drill';
import { DRILL_LEAVES_PER_DAY } from '../../src/core/economy';
import { isSure, newFact, type FactProgress } from '../../src/core/facts';
import type { SkillProgress } from '../../src/core/mastery';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import type { Exercise } from '../../src/core/types';
import { DOMAINS, ORDER } from '../../src/domains';
import { blooms } from '../../src/ui/fact-tree';

const SKILLS = curriculum(DOMAINS, ORDER);
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
    const toTen = complements.facts!.groups!.find((group) => group.id === 'to-10')!.facts;
    for (const [ms, expected] of [
      [1500, toTen.length],
      [6000, 0],
    ] as const) {
      let day = 100;
      const player = session(() => day);
      const automatedOn: number[] = [];
      for (; day < 103; day++) {
        const target = { kind: 'skill', skill: complements.id, group: 'to-10' } as const;
        const drill = new Drill(player, target, new Rng(day));
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

  it('makes the parent’s branch glow, else the one with the most facts under way, never a full one', () => {
    const facts = new Map<string, FactProgress>();
    const table = (id: string) => products.facts!.groups!.find((group) => group.id === id)!.facts;
    for (const fact of table('table-2')) facts.set(fact, automated(fact));
    const underway = (fact: string) => facts.set(fact, { ...newFact(fact), tries: 2, right: 1 });
    underway('times-tables.products:7x8');
    underway('times-tables.products:6x7');
    const branch = (group: string) => ({ skill: products.id, group });
    // 6 × 7 and 7 × 8 both on the table of 7; one each on the tables of 6 and 8.
    expect(suggestedBranch([products], facts, null, 100)).toEqual(branch('table-7'));
    expect(suggestedBranch([products], facts, branch('table-9'), 100)).toEqual(branch('table-9'));
    // The parent's branch already in bloom: the best one of the same notion.
    expect(suggestedBranch([products], facts, branch('table-2'), 100)).toEqual(branch('table-7'));
    // Nothing met yet: the first branch still to grow.
    expect(suggestedBranch([products], new Map(), null, 100)).toEqual(branch('table-2'));
    const all = new Map(products.facts!.all.map((fact) => [fact, automated(fact)]));
    expect(suggestedBranch([products], all, null, 100)).toBeNull();
  });

  it('makes a branch glow only if it still gives leaves today (#143, #29)', () => {
    const facts = new Map<string, FactProgress>();
    // The table of 7 the most under way, but picked today: a branch with leaves left glows.
    for (const fact of TABLE_7)
      facts.set(fact, { ...newFact(fact), tries: 2, right: 1, paid: 100 });
    facts.set('times-tables.products:2x3', { ...newFact('times-tables.products:2x3'), tries: 1 });
    expect(suggestedBranch([products], facts, null, 100)).toMatchObject({ group: 'table-2' });
    // The drill's leaves of the day all given: none glows; the next day, again.
    facts.set('times-tables.products:2x2', { ...newFact('times-tables.products:2x2'), paid: 100 });
    expect(DRILL_LEAVES_PER_DAY).toBe(10);
    expect(suggestedBranch([products], facts, null, 100)).toBeNull();
    expect(suggestedBranch([products], facts, null, 101)).not.toBeNull();
  });

  it('feeds the facts only, never the mastery of the notion (#122)', () => {
    const player = session();
    const drill = new Drill(
      player,
      { kind: 'skill', skill: products.id, group: 'table-2' },
      new Rng(3),
    );
    const achievements = Array.from({ length: 60 }, () => {
      const { skill, exercise } = drill.ask();
      return drill.conclude(skill, exercise, true, 2000);
    }).flat();
    expect(achievements.some((a) => a.kind === 'acquired')).toBe(false);
    expect(player.progress.get(products.id)).toBeUndefined();
    const table2 = products.facts!.groups!.find((group) => group.id === 'table-2')!.facts;
    const tries = table2.reduce((sum, fact) => sum + (player.facts.get(fact)?.tries ?? 0), 0);
    expect(tries).toBe(60);
    // An acquired notion due for review keeps its review for the trail.
    const due: SkillProgress = {
      skill: complements.id,
      stage: 'acquired',
      level: 3,
      recent: [],
      box: 0,
      due: 100,
    };
    player.progress.set(complements.id, due);
    const again = new Drill(player, { kind: 'skill', skill: complements.id }, new Rng(3));
    const { skill, exercise } = again.ask();
    again.conclude(skill, exercise, false, 2000);
    expect(player.progress.get(complements.id)).toEqual(due);
  });

  it('asks a fact known by heart then missed as a hard one (#123)', () => {
    const [slipped, ...rest] = TABLE_7;
    for (let seed = 0; seed < 10; seed++) {
      const player = session();
      for (const fact of rest) player.facts.set(fact, automated(fact));
      player.facts.set(slipped, {
        ...automated(slipped),
        tries: 10,
        right: 9,
        fastDays: [],
        known: true,
      });
      const drill = new Drill(
        player,
        { kind: 'skill', skill: products.id, group: 'table-7' },
        new Rng(seed),
      );
      const counts = new Map<string, number>();
      for (let i = 0; i < 12; i++) {
        const { skill, exercise } = drill.ask();
        const fact = skill.facts!.of(exercise)!;
        counts.set(fact, (counts.get(fact) ?? 0) + 1);
        drill.conclude(skill, exercise, true, 9000);
      }
      const others = rest.map((fact) => counts.get(fact) ?? 0);
      expect(counts.get(slipped)).toBeGreaterThan(Math.max(...others));
    }
    // In the Carnet, the branch stays in bloom and Plume never makes it glow.
    const facts = new Map(TABLE_7.map((fact) => [fact, automated(fact)]));
    facts.set(slipped, { ...automated(slipped), fastDays: [], known: true });
    const table7 = products.facts!.groups!.find((group) => group.id === 'table-7')!;
    expect(blooms(table7, facts)).toBe(true);
    expect(suggestedBranch([products], facts, null, 100)).not.toEqual({
      skill: products.id,
      group: 'table-7',
    });
  });

  it('waits before asking a fact again, round after round (#149)', () => {
    const sums = SKILLS.find((skill) => skill.id === 'mental-math.sums')!;
    for (let seed = 0; seed < 200; seed++) {
      const player = session();
      for (let round = 0; round < 3; round++) {
        const drill = new Drill(
          player,
          { kind: 'skill', skill: sums.id, group: 'to-10' },
          new Rng(seed * 10 + round),
        );
        const asked: string[] = [];
        for (let i = 0; i < 20; i++) {
          const { skill, exercise } = drill.ask();
          const fact = skill.facts!.of(exercise)!;
          expect(asked.slice(-SPACING)).not.toContain(fact);
          asked.push(fact);
          drill.conclude(skill, exercise, true, 1700);
        }
      }
    }
  });

  it('asks first the facts that still give their leaf today, up to the cap of the day (#152, #29)', () => {
    const sums = SKILLS.find((skill) => skill.id === 'mental-math.sums')!;
    const toTen = sums.facts!.groups!.find((group) => group.id === 'to-10')!.facts;
    for (let seed = 0; seed < 50; seed++) {
      const player = session();
      const round = (skill: string, group: string, rng: number) => {
        const drill = new Drill(player, { kind: 'skill', skill, group }, new Rng(rng));
        let leaves = 0;
        for (let i = 0; i < 20; i++) {
          const { skill, exercise } = drill.ask();
          drill.conclude(skill, exercise, true, 1700);
          leaves += drill.earned;
        }
        return leaves;
      };
      // The table of 7, 9 facts: all picked in one round.
      expect(round(products.id, 'table-7', seed)).toBe(TABLE_7.length);
      expect(TABLE_7.every((fact) => player.facts.get(fact)?.paid === 100)).toBe(true);
      // Then the cap of the day: one more leaf, whatever the branch.
      expect(round(sums.id, 'to-10', seed + 1)).toBe(DRILL_LEAVES_PER_DAY - TABLE_7.length);
      expect(toTen.filter((fact) => player.facts.get(fact)?.paid === 100)).toHaveLength(1);
    }
  });

  it('marks the answer that picks the last leaf of today on the branch, once (#150)', () => {
    const player = session();
    let picked = 0;
    for (let round = 0; round < 3; round++) {
      const drill = new Drill(
        player,
        { kind: 'skill', skill: products.id, group: 'table-7' },
        new Rng(round),
      );
      for (let i = 0; i < 20; i++) {
        const { skill, exercise } = drill.ask();
        drill.conclude(skill, exercise, true, 1700);
        if (drill.picked) picked++;
      }
    }
    expect(picked).toBe(1);
    const whole = new Drill(player, { kind: 'skill', skill: products.id }, new Rng(9));
    const { skill, exercise } = whole.ask();
    whole.conclude(skill, exercise, true, 1700);
    expect(whole.picked).toBe(false);
  });

  it('plays only notions with facts, known by heart', () => {
    const drill = new Drill(session(), { kind: 'skill', skill: 'mental-math.add' }, new Rng(5));
    expect(() => drill.ask()).toThrow('notion sans faits');
  });

  it('gives a leaf for a fact not known by heart yet, once a day, none for a known one (#125)', () => {
    let today = 100;
    const player = session(() => today);
    /** 40 right answers on the table of 7: the leaves, and the facts asked. */
    const round = () => {
      const drill = new Drill(
        player,
        { kind: 'skill', skill: products.id, group: 'table-7' },
        new Rng(today),
      );
      let leaves = 0;
      const asked = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const { skill, exercise } = drill.ask();
        asked.add(skill.facts!.of(exercise)!);
        drill.conclude(skill, exercise, true, 9000);
        leaves += drill.earned;
      }
      return { leaves, asked: asked.size };
    };
    // Fewer leaves than questions: a trail pays at least one per right answer.
    const first = round();
    expect(first.leaves).toBe(first.asked);
    expect(first.leaves).toBeLessThanOrEqual(TABLE_7.length);
    expect(round().leaves).toBe(0);
    today++;
    const next = round();
    expect(next.leaves).toBe(next.asked);
    expect(next.leaves).toBeGreaterThan(0);
    // Known by heart: nothing more, even another day.
    for (const fact of TABLE_7) player.facts.set(fact, automated(fact));
    today++;
    expect(round().leaves).toBe(0);
  });
});
