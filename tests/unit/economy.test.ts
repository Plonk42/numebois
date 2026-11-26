import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import {
  effort,
  LEAVES_PER_ELEMENT,
  leavesPerElement,
  QUESTION_SECONDS,
  questionSeconds,
  SEEDS_PER_ANIMAL,
  SEEDS_PER_CHALLENGE,
  SEEDS_PER_GRAND,
  SEEDS_PER_NIGHT,
  SEEDS_PER_RARE,
  SEEDS_PER_SEASON,
  seedsOf,
} from '../../src/core/economy';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { changeSetting } from '../../src/core/settings';
import { TRAIL_QUESTIONS } from '../../src/core/trail';
import type { SkillId } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import { MAX_ELEMENTS, stageFor } from '../../src/scene/description';

/**
 * Time of play, from the owner's session in the child's place (#128): 8.4 s per question in
 * the trail for an adult, about 12 s for the child (`QUESTION_SECONDS`), more on the long
 * notions (#153); rewards, pouring and shop around a trail.
 */
const AROUND_TRAIL_S = 60;
/** Minutes of play in a day: a new day brings the squirrel's gift (#126). */
const DAY_MIN = 20;
/** Golden seeds a painting asks: 5 animals, 3 seasons, the night, 2 rare elements, the great one. */
const SEED_CATALOG =
  5 * SEEDS_PER_ANIMAL +
  3 * SEEDS_PER_SEASON +
  SEEDS_PER_NIGHT +
  2 * SEEDS_PER_RARE +
  SEEDS_PER_GRAND;

interface Painting {
  minutes: number;
  /** Elements bought after each trail. */
  bought: number[];
  seeds: number;
  /** Seconds of questions of each trail. */
  trails: number[];
}

/**
 * A child right 80 % of the time at first try (60 % at the second), playing trails and
 * buying an element as soon as the reserve allows, painting after painting; the parent may
 * put a notion in focus.
 */
function play(
  seed: number,
  paintings: number,
  length: 'short' | 'normal' = 'normal',
  focus?: SkillId,
): Painting[] {
  const rng = new Rng(seed);
  const child = rng.fork('child');
  let day = 1;
  let today = 0;
  const skills = curriculum(DOMAINS);
  const session = new Session(
    skills,
    rng.fork('trail'),
    () => day,
    () => CLEARING,
    length,
  );
  if (focus) {
    const skill = skills.find((s) => s.id === focus)!;
    session.settings = changeSetting(session.settings, skill, { mode: 'focus', until: 1000 });
  }
  let leaves = 0;
  const done: Painting[] = [];
  for (let p = 0; p < paintings; p++) {
    const painting: Painting = { minutes: 0, bought: [], seeds: 0, trails: [] };
    let placed = 0;
    while (placed < MAX_ELEMENTS) {
      session.startTrail();
      let previous;
      let seconds = 0;
      do {
        const { skill, exercise } = session.ask(previous);
        const right = child.chance(0.8);
        const second = !right && child.chance(0.6);
        if (right || second) leaves += session.worth;
        const achieved = session.conclude(skill, exercise, right, 4000, !right && !second);
        painting.seeds += seedsOf(achieved, skill, exercise.level);
        previous = exercise;
        seconds += questionSeconds(skill, exercise.level);
      } while (session.advance());
      const minutes = (seconds + AROUND_TRAIL_S) / 60;
      painting.trails.push(seconds);
      painting.minutes += minutes;
      let bought = 0;
      while (placed < MAX_ELEMENTS && leaves >= leavesPerElement(stageFor(placed))) {
        leaves -= leavesPerElement(stageFor(placed));
        placed++;
        bought++;
      }
      painting.bought.push(bought);
      today += minutes;
      if (today >= DAY_MIN) {
        day++;
        today = 0;
        painting.seeds += SEEDS_PER_CHALLENGE;
      }
    }
    done.push(painting);
  }
  return done;
}

describe('economy (#29)', () => {
  const paintings = [1, 2, 3].flatMap((seed) => play(seed, 3));

  it('completes a painting in about 40 minutes of trails', () => {
    const minutes = paintings.map((p) => p.minutes);
    const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    expect(mean).toBeGreaterThanOrEqual(35);
    expect(mean).toBeLessThanOrEqual(45);
    for (const m of minutes) expect(m).toBeGreaterThan(30);
    for (const m of minutes) expect(m).toBeLessThan(50);
  });

  it('grows the landscape by 1 or 2 elements a trail, from the very first one', () => {
    for (const p of [1, 2, 3].map((seed) => play(seed, 1)[0])) {
      expect(p.bought[0]).toBeGreaterThanOrEqual(1);
      expect(p.bought[0]).toBeLessThanOrEqual(2);
      const mean = MAX_ELEMENTS / p.bought.length;
      expect(mean).toBeGreaterThanOrEqual(1);
      expect(mean).toBeLessThanOrEqual(2);
    }
  });

  it('pays most of the golden seeds a painting asks', () => {
    expect(SEED_CATALOG).toBe(22);
    const seeds = paintings.map((p) => p.seeds);
    expect(seeds.reduce((a, b) => a + b, 0) / seeds.length).toBeGreaterThanOrEqual(
      SEED_CATALOG * 0.8,
    );
    for (const s of seeds) expect(s).toBeGreaterThanOrEqual(SEED_CATALOG * 0.55);
  });

  it('buys an element after a short trail on the first half of the stages', () => {
    const [first] = play(4, 1, 'short');
    expect(LEAVES_PER_ELEMENT).toBe(leavesPerElement(0));
    // About 11 trails to the stage 6, a little over one each.
    const half = first.bought.slice(0, 11);
    expect(half.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(11);
  });
});

describe('effort of the long notions (#153)', () => {
  it('pays a minute of a long notion at least as much as a minute of a quick one', () => {
    for (const skill of curriculum(DOMAINS)) {
      for (let level = 0; level < skill.levels; level++) {
        const perSecond = effort(skill, level) / questionSeconds(skill, level);
        expect(perSecond, `${skill.id} ${level}`).toBeGreaterThanOrEqual(1 / QUESTION_SECONDS);
      }
    }
  });

  it('pays the golden seeds of a long notion by its effort, a fact by one', () => {
    const add = curriculum(DOMAINS).find((s) => s.id === 'column-arithmetic.add')!;
    expect(seedsOf([{ kind: 'level', skill: add.id, level: 5 }], add, 4)).toBe(effort(add, 4));
    expect(effort(add, 4)).toBeGreaterThan(1);
    expect(seedsOf([{ kind: 'automated', fact: 'x' }], add, 4)).toBe(1);
  });

  // A notion in focus pays less once acquired, quick or long: compared with a quick one.
  const meanMinutes = (paintings: Painting[]) =>
    paintings.reduce((sum, p) => sum + p.minutes, 0) / paintings.length;
  const inFocus = (focus: SkillId) => [1, 2].flatMap((seed) => play(seed, 2, 'normal', focus));
  const quick = meanMinutes(inFocus('mental-math.add'));

  it.each([
    'column-arithmetic.add',
    'column-arithmetic.multiply',
    'measures.measure',
    'time.durations',
    'word-problems.add-subtract',
  ])('keeps the trail and the painting in their time with %s in focus', (focus) => {
    const paintings = inFocus(focus);
    // The notions around the focus differ: 10 % of margin.
    expect(meanMinutes(paintings)).toBeLessThanOrEqual(quick * 1.1);
    // About the time of the quick questions; at worst a warmup, a question, a finish and one
    // more after a mistake, all long.
    const trails = paintings.flatMap((p) => p.trails);
    const budget = TRAIL_QUESTIONS.normal * QUESTION_SECONDS;
    expect(trails.reduce((a, b) => a + b, 0) / trails.length).toBeLessThanOrEqual(budget * 1.25);
    for (const seconds of trails) expect(seconds).toBeLessThanOrEqual(budget * 2.5);
  });
});
