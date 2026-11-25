import { describe, expect, it } from 'vitest';
import {
  AUTOMATED_DAYS,
  allAutomated,
  isAutomated,
  isFragile,
  isKnown,
  isSlipping,
  isSure,
  newFact,
  recordFact,
  type FactProgress,
} from '../../src/core/facts';
import {
  REVIEW_DAYS,
  isAcquired,
  isDue,
  masteryRate,
  newProgress,
  record,
  type SkillProgress,
} from '../../src/core/mastery';

function play(progress: SkillProgress, answers: string, day: number, levels: number) {
  let p = progress;
  for (const mark of answers) p = record(p, { right: mark === '+', day }, levels);
  return p;
}

/** A notion of 2 levels, acquired on day 0. */
function acquired(): SkillProgress {
  const p = play(newProgress('a.x'), '+++' + '+++++', 0, 2);
  expect(p.stage).toBe('acquired');
  return p;
}

describe('cycle de vie d’une notion', () => {
  it('starts in discovery and learns from the first answer', () => {
    const p = newProgress('a.x');
    expect(p.stage).toBe('discovery');
    expect(masteryRate(p)).toBe(0);
    expect(record(p, { right: false, day: 0 }, 3).stage).toBe('learning');
  });

  it('opens the next level after 3 right first answers in a row, at that level', () => {
    let p = play(newProgress('a.x'), '++-++', 0, 3);
    expect(p.level).toBe(0);
    p = play(p, '+', 0, 3);
    expect(p.level).toBe(1);
    p = play(p, '++', 0, 3);
    expect(p.level).toBe(1);
  });

  it('goes back one level after 3 missed answers at that level, never below 0', () => {
    let p = play(newProgress('a.x'), '+++', 0, 3);
    p = play(p, '---', 0, 3);
    expect(p.level).toBe(0);
    p = play(p, '---', 0, 3);
    expect(p.level).toBe(0);
    expect(p.stage).toBe('learning');
  });

  it('is acquired with 4 of the last 5 answers right at the last level', () => {
    let p = play(newProgress('a.x'), '+++' + '++-+', 0, 2);
    expect(p.stage).toBe('learning');
    p = play(p, '+', 0, 2);
    expect(p.stage).toBe('acquired');
    expect(isAcquired(p)).toBe(true);
    expect(p.due).toBe(1);
  });

  it('needs the whole window at 80 % to be acquired', () => {
    const p = play(newProgress('a.x'), '---+-' + '+++++', 0, 1);
    expect(p.stage).toBe('learning');
    expect(masteryRate(p)).toBe(0.6);
  });

  it('is reviewed after 1, 3, 7, 21 then 60 days, then anchored', () => {
    let p = acquired();
    let day = 0;
    for (const wait of REVIEW_DAYS) {
      expect(isDue(p, day + wait - 1)).toBe(false);
      day += wait;
      expect(isDue(p, day)).toBe(true);
      // Answers before the due day do not count as a review.
      p = play(p, '+', day - 1, 2);
      p = play(p, '+', day, 2);
    }
    expect(p.stage).toBe('anchored');
    expect(p.due).toBeNull();
  });

  it('counts one review per day', () => {
    const p = play(acquired(), '+++', 1, 2);
    expect(p.box).toBe(1);
    expect(p.due).toBe(1 + REVIEW_DAYS[1]);
  });

  it('starts the reviews again from tomorrow after a missed review, without losing the notion', () => {
    let p = play(acquired(), '+', 1, 2);
    p = play(p, '+', 4, 2);
    expect(p.box).toBe(2);
    p = play(p, '-', 11, 2);
    expect(p).toMatchObject({ stage: 'maintenance', box: 0, due: 12 });
  });

  it('goes back to learning when the answers fall under 50 %', () => {
    const p = play(acquired(), '-----', 1, 2);
    expect(p.stage).toBe('maintenance');
    expect(play(p, '-', 1, 2)).toMatchObject({ stage: 'learning', due: null, box: 0 });
  });
});

describe('automatisation des faits', () => {
  const answer = (right: boolean, ms: number, day: number) => ({ right, ms, day });
  const fact = (answers: [boolean, number, number][]) =>
    answers.reduce<FactProgress>(
      (p, [r, ms, d]) => recordFact(p, answer(r, ms, d), 3),
      newFact('a.x:1'),
    );

  it('is automated after right fast first answers on 3 different days', () => {
    expect(AUTOMATED_DAYS).toBe(3);
    const twoDays = fact([
      [true, 1000, 0],
      [true, 1000, 0],
      [true, 2900, 1],
    ]);
    expect(isAutomated(twoDays)).toBe(false);
    expect(isAutomated(recordFact(twoDays, answer(true, 3000, 5), 3))).toBe(true);
  });

  it('ignores slow right answers and restarts after a mistake', () => {
    const slow = fact([
      [true, 1000, 0],
      [true, 5000, 1],
      [true, 1000, 2],
    ]);
    expect(slow.fastDays).toEqual([0, 2]);
    const missed = recordFact(slow, answer(false, 1000, 3), 3);
    expect(missed.fastDays).toEqual([]);
    expect(missed).toMatchObject({ tries: 4, right: 3, times: [1000, 5000, 1000, 1000] });
  });

  it('keeps a fact known by heart after a mistake, to consolidate (#123)', () => {
    const known = fact([
      [true, 1000, 0],
      [true, 1000, 1],
      [true, 1000, 2],
    ]);
    expect(known.known).toBe(true);
    const missed = recordFact(known, answer(false, 1000, 3), 3);
    expect(missed).toMatchObject({ fastDays: [], known: true });
    expect(isKnown(missed)).toBe(true);
    expect(isAutomated(missed)).toBe(false);
    expect(isSlipping(missed)).toBe(true);
    expect(isFragile(missed)).toBe(true);
    expect(isSure(missed)).toBe(false);
    // Saves written before #123: an automated fact without the flag.
    const older = { ...known };
    delete older.known;
    expect(isKnown(older)).toBe(true);
    expect(isSlipping(older)).toBe(false);
  });

  it('finds fragile facts and automated notions', () => {
    const fragile = fact([
      [false, 4000, 0],
      [true, 4000, 0],
    ]);
    expect(isFragile(fragile)).toBe(true);
    const sure = fact([
      [true, 1000, 0],
      [true, 1000, 1],
      [true, 1000, 2],
    ]);
    expect(isFragile(sure)).toBe(false);
    const progress = new Map([['a.x:1', sure]]);
    expect(allAutomated(['a.x:1'], progress)).toBe(true);
    expect(allAutomated(['a.x:1', 'a.x:2'], progress)).toBe(false);
    expect(allAutomated([], progress)).toBe(false);
  });
});
