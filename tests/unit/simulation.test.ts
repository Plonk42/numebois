import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { questionSeconds, QUESTION_SECONDS } from '../../src/core/economy';
import { isAcquired, REVIEW_DAYS } from '../../src/core/mastery';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { MAX_ACTIVE, REVIEW_SHARE, TRAIL_QUESTIONS } from '../../src/core/trail';
import { changeSetting } from '../../src/core/settings';
import type { Domain, Exercise, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';

const DAYS = 182;
/** Seconds of questions of a normal trail of quick questions. */
const BUDGET = TRAIL_QUESTIONS.normal * QUESTION_SECONDS;

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
function sixMonths(domains: readonly Domain[], withHomework: boolean) {
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
  const trails: { stones: number; seconds: number; inProgress: number; reviews: number }[] = [];
  let forgotten = 0;
  let homework: Skill | null = null;
  let homeworkQuestions = 0;
  for (day = 1; day <= DAYS; day++) {
    // The homework of the week (#54): a notion worked in class, so in progress here, in focus
    // until next week's eve.
    if (withHomework && day % 7 === 1) {
      const met = skills.filter((skill) => session.progress.get(skill.id)?.stage === 'learning');
      if (met.length > 0) {
        homework = child.pick(met);
        session.settings = changeSetting(session.settings, homework, {
          mode: 'focus',
          until: day + 6,
        });
      }
    }
    if (child.chance(0.15)) continue;
    // The time of one or two trails of quick questions (#153).
    for (
      let left = (child.chance(0.3) ? 2 : 1) * BUDGET;
      left > 0;
      left -= trails.at(-1)!.seconds
    ) {
      for (const skill of skills) {
        if (!isAcquired(session.progress.get(skill.id))) continue;
        forgotten = Math.max(forgotten, day - lastSeen.get(skill.id)!);
      }
      session.startTrail();
      const steps = session.trail;
      trails.push({
        stones: session.stones,
        seconds: 0,
        // In progress: not acquired yet (a homework notion acquired is reviewed).
        inProgress: new Set(
          steps
            .filter((s) => s.role === 'core' || s.role === 'new')
            .filter((s) => !isAcquired(session.progress.get(s.skill)))
            .map((s) => s.skill),
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
        trails.at(-1)!.seconds += questionSeconds(skill, exercise.level);
        if (skill === homework && session.settings.get(skill.id)?.mode === 'focus') {
          homeworkQuestions++;
        }
        previous = exercise;
      } while (session.advance());
    }
  }
  const acquired = skills.filter((skill) => isAcquired(session.progress.get(skill.id))).length;
  return { trails, forgotten, acquired, notions: skills.length, homeworkQuestions };
}

describe('six mois de jeu', () => {
  // The registry grows towards about 100 notions with domains of 6 to come.
  const real = DOMAINS.reduce((sum, domain) => sum + domain.skills.length, 0);
  const futures = Array.from({ length: Math.round((100 - real) / 6) }, (_, i) =>
    syntheticDomain(i, 6),
  );
  // A long notion takes more time to learn, in trails of the same time (#153): fewer open.
  it.each([
    { name: 'the current registry', domains: DOMAINS, homework: false, opens: 0.8 },
    {
      name: 'a registry of about 100 notions',
      domains: [...DOMAINS, ...futures],
      homework: false,
      opens: 0.75,
    },
    // Half of the trail goes to the homework of the week: fewer notions open (#54).
    {
      name: 'the current registry, homework every week',
      domains: DOMAINS,
      homework: true,
      opens: 0.6,
    },
    {
      name: 'about 100 notions, homework every week',
      domains: [...DOMAINS, ...futures],
      homework: true,
      opens: 0.35,
    },
  ])(
    '$name: same trail time, 3 notions in progress, reviews under 25 %, nothing forgotten',
    ({ domains, homework, opens }) => {
      const { trails, forgotten, acquired, notions, homeworkQuestions } = sixMonths(
        domains,
        homework,
      );
      expect(trails.length).toBeGreaterThan(DAYS);
      // The homework of each week comes often: half of most trails of its week.
      if (homework) {
        expect(homeworkQuestions).toBeGreaterThan((trails.length * TRAIL_QUESTIONS.normal) / 4);
      }
      const size = TRAIL_QUESTIONS.normal;
      // Fewer stones when the questions are long (#153); at worst a warmup, a question, a
      // finish and one more after a mistake, all long.
      const seconds = trails.map((trail) => trail.seconds);
      expect(seconds.reduce((a, b) => a + b, 0) / seconds.length).toBeLessThanOrEqual(BUDGET * 1.1);
      for (const trail of trails) {
        expect(trail.stones).toBeLessThanOrEqual(size);
        expect(trail.seconds).toBeLessThanOrEqual(BUDGET * 2.5);
        expect(trail.inProgress).toBeLessThanOrEqual(MAX_ACTIVE);
        expect(trail.reviews).toBeLessThanOrEqual(Math.floor(size * REVIEW_SHARE));
      }
      // An acquired notion comes back at least as often as its longest review interval.
      expect(forgotten).toBeLessThanOrEqual(REVIEW_DAYS.at(-1)!);
      // The content keeps opening: most of today's notions, half of 100, in six months.
      expect(acquired, `${acquired} sur ${notions}`).toBeGreaterThanOrEqual(
        opens * Math.min(notions, 60),
      );
    },
  );
});
