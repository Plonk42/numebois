import { CLEARING } from './helpers';
import { describe, expect, it } from 'vitest';
import { nearNumbers, offerChoices } from '../../src/core/choices';
import { curriculum } from '../../src/core/registry';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { TRAIL_QUESTIONS } from '../../src/core/trail';
import { DOMAINS } from '../../src/domains';

const SKILLS = curriculum(DOMAINS);

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
    });
    expect(session.conclude(complements, exercise, true, 900, false)).toEqual([
      { kind: 'acquired', skill: complements.id },
      { kind: 'automated', fact },
    ]);
    expect(session.conclude(complements, exercise, true, 900, false)).toEqual([]);
  });
});
