import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { isAcquired, REVIEW_DAYS } from '../../src/core/mastery';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { MAX_ACTIVE, REVIEW_SHARE, TRAIL_QUESTIONS } from '../../src/core/trail';
import type { Domain, Exercise, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';

const DAYS = 182;

/** A domain of `count` chained notions with 3 levels, standing for the modules to come. */
function syntheticDomain(index: number, count: number): Domain {
  const id = `future${index}`;
  const skills = Array.from({ length: count }, (_, i): Skill => {
    const skill = `${id}.n${i}`;
    return {
      id: skill,
      name: skill,
      prerequisites: i === 0 ? [] : [`${id}.n${i - 1}`],
      levels: 3,
      generate: (rng: Rng, level: number): Exercise => {
        const a = rng.int(1, 99);
        return {
          skill,
          level,
          instruction: 'Calcule.',
          statement: `${a} + ${level}`,
          input: { kind: 'keypad', maxDigits: 3 },
          answer: String(a + level),
        };
      },
      validate: (exercise, answer) => exercise.answer === answer,
      hint: () => 'Compte.',
    };
  });
  return { id, name: id, skills };
}

/**
 * Six months of a virtual child right 80 % of the time at first try, who skips about one day
 * in seven and sometimes plays two trails: what each trail asks and what is left aside.
 */
function sixMonths(domains: readonly Domain[]) {
  const skills = curriculum(domains);
  const rng = new Rng(7);
  const child = rng.fork('child');
  let day = 0;
  const session = new Session(
    skills,
    rng.fork('trail'),
    () => day,
    () => CLEARING,
  );
  const lastSeen = new Map<string, number>();
  const trails: { stones: number; inProgress: number; reviews: number }[] = [];
  let forgotten = 0;
  for (day = 1; day <= DAYS; day++) {
    if (child.chance(0.15)) continue;
    for (let trail = child.chance(0.3) ? 2 : 1; trail > 0; trail--) {
      for (const skill of skills) {
        if (!isAcquired(session.progress.get(skill.id))) continue;
        forgotten = Math.max(forgotten, day - lastSeen.get(skill.id)!);
      }
      session.startTrail();
      const steps = session.trail;
      trails.push({
        stones: session.stones,
        inProgress: new Set(
          steps.filter((s) => s.role === 'core' || s.role === 'new').map((s) => s.skill),
        ).size,
        reviews: steps.filter((s) => s.role === 'review').length,
      });
      let previous: Exercise | undefined;
      do {
        const { skill, exercise } = session.ask(previous);
        const right = child.chance(0.8);
        session.conclude(
          skill,
          exercise,
          right,
          child.int(1500, 6000),
          !right && child.chance(0.5),
        );
        lastSeen.set(skill.id, day);
        previous = exercise;
      } while (session.advance());
    }
  }
  const acquired = skills.filter((skill) => isAcquired(session.progress.get(skill.id))).length;
  return { trails, forgotten, acquired, notions: skills.length };
}

describe('six mois de jeu', () => {
  const futures = Array.from({ length: 15 }, (_, i) => syntheticDomain(i, 6));
  it.each([
    { name: 'the current registry', domains: DOMAINS },
    { name: 'a registry of about 100 notions', domains: [...DOMAINS, ...futures] },
  ])(
    '$name: same trail size, 3 notions in progress, reviews under 25 %, nothing forgotten',
    ({ domains }) => {
      const { trails, forgotten, acquired, notions } = sixMonths(domains);
      expect(trails.length).toBeGreaterThan(DAYS);
      const size = TRAIL_QUESTIONS.normal;
      for (const trail of trails) {
        expect(trail.stones).toBe(size);
        expect(trail.inProgress).toBeLessThanOrEqual(MAX_ACTIVE);
        expect(trail.reviews).toBeLessThanOrEqual(Math.floor(size * REVIEW_SHARE));
      }
      // An acquired notion comes back at least as often as its longest review interval.
      expect(forgotten).toBeLessThanOrEqual(REVIEW_DAYS.at(-1)!);
      // The content keeps opening: most of today's notions, half of 100, in six months.
      expect(acquired, `${acquired} sur ${notions}`).toBeGreaterThanOrEqual(
        0.8 * Math.min(notions, 60),
      );
    },
  );
});
