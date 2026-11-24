import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { Challenge, challengeable } from '../../src/core/challenge';
import { curriculum } from '../../src/core/registry';
import {
  addAttempt,
  challengeLevel,
  ending,
  goal,
  KEPT_ATTEMPTS,
  trend,
  type Attempt,
  type ChallengeFormat,
} from '../../src/core/records';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { DOMAINS } from '../../src/domains';

const SKILLS = curriculum(DOMAINS);
const products = SKILLS.find((skill) => skill.id === 'times-tables.products')!;
const BASKET: ChallengeFormat = { kind: 'basket', seconds: 30 };
const RACE: ChallengeFormat = { kind: 'race', questions: 10 };

const attempts = (...scores: number[]): Attempt[] =>
  scores.map((score, day) => ({ day, score, rate: 1, level: 3 }));

function player(): Session {
  const session = new Session(
    SKILLS,
    new Rng(1),
    () => 100,
    () => CLEARING,
  );
  session.progress.set(products.id, {
    skill: products.id,
    stage: 'acquired',
    level: products.levels - 1,
    recent: [],
    box: 0,
    due: 101,
  });
  return session;
}

describe('challenges', () => {
  it('are offered on acquired notions marked « challenge » only', () => {
    const session = player();
    const ids = challengeable(SKILLS, session.progress).map((skill) => skill.id);
    expect(ids).toEqual([products.id]);
  });

  it('fill the basket for 30 s, pauses left out, a mistake costing no time', () => {
    let now = 0;
    const session = player();
    const challenge = new Challenge(session, products, BASKET, 4, new Rng(2), () => now);
    let i = 0;
    while (!challenge.over) {
      const exercise = challenge.ask();
      now += 2000;
      challenge.conclude(exercise, i % 4 !== 3, 2000);
      // The game hidden for 5 s: the time stops.
      if (i === 5) {
        challenge.pause();
        now += 5000;
        challenge.resume();
      }
      i++;
    }
    expect(now).toBe(35_000);
    expect(challenge.results).toHaveLength(15);
    expect(challenge.remaining()).toBe(0);
    expect(challenge.attempt(100)).toEqual({ day: 100, score: 12, rate: 12 / 15, level: 4 });
    // The answers count for the notion like any other.
    expect(session.progress.get(products.id)!.recent).toHaveLength(10);
  });

  it('run the race over its questions, its time without the pauses', () => {
    let now = 1000;
    const challenge = new Challenge(player(), products, RACE, 4, new Rng(3), () => now);
    for (let i = 0; i < 10; i++) {
      expect(challenge.over).toBe(false);
      const exercise = challenge.ask();
      now += 1500;
      challenge.pause();
      now += 900;
      challenge.resume();
      challenge.conclude(exercise, true, 1500);
    }
    expect(challenge.over).toBe(true);
    expect(challenge.attempt(100).score).toBe(15_000);
  });

  it('move the race on right answers only: a mistake neither advances nor ends it', () => {
    const challenge = new Challenge(player(), products, RACE, 4, new Rng(3), () => 0);
    for (let i = 0; i < 11; i++) challenge.conclude(challenge.ask(), i % 5 !== 4, 1000);
    expect(challenge.over).toBe(false);
    challenge.conclude(challenge.ask(), true, 1000);
    expect(challenge.over).toBe(true);
    expect(challenge.attempt(100).rate).toBeCloseTo(10 / 12);
  });

  it('aim just above the recent median', () => {
    expect(goal(BASKET, [])).toBeNull();
    expect(goal(BASKET, attempts(4, 20, 9, 11, 10))).toBe(11);
    expect(goal(RACE, attempts(30_000, 24_000, 26_000))).toBe(25_000);
  });

  it('follow the trend of the last 3 attempts', () => {
    expect(trend(BASKET, attempts(9))).toBeNull();
    expect(trend(BASKET, attempts(3, 9, 10, 12))).toBe('better');
    expect(trend(BASKET, attempts(10, 12, 10))).toBe('steady');
    expect(trend(RACE, attempts(20_000, 22_000, 25_000))).toBe('lower');
  });

  it('always end on good news', () => {
    const before = attempts(9, 11, 10);
    const at = (score: number): Attempt => ({ day: 9, score, rate: 1, level: 3 });
    expect(ending(BASKET, [], at(3))).toBe('first');
    expect(ending(BASKET, before, at(12))).toBe('record');
    expect(ending(BASKET, attempts(14, 9, 10), at(11))).toBe('goal');
    expect(ending(BASKET, attempts(14, 12, 5), at(8))).toBe('better');
    expect(ending(BASKET, before, at(4))).toBe('played');
    expect(ending(RACE, attempts(20_000), at(19_000))).toBe('record');
  });

  it('get easier after a challenge under 50 % right', () => {
    expect(challengeLevel(4, [])).toBe(4);
    expect(challengeLevel(4, [{ day: 1, score: 3, rate: 0.6, level: 4 }])).toBe(4);
    expect(challengeLevel(4, [{ day: 1, score: 3, rate: 0.4, level: 4 }])).toBe(3);
    expect(challengeLevel(4, [{ day: 1, score: 3, rate: 0.4, level: 0 }])).toBe(0);
  });

  it('keep the last attempts only', () => {
    let record = { skill: products.id, format: 'basket-30', attempts: [] as Attempt[] };
    for (const attempt of attempts(...Array.from({ length: 14 }, (_, i) => i))) {
      record = addAttempt(record, attempt);
    }
    expect(record.attempts).toHaveLength(KEPT_ATTEMPTS);
    expect(record.attempts[0].score).toBe(4);
  });
});
