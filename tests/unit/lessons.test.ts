import { describe, expect, it } from 'vitest';
import { lessonAfter, lessonBefore, type LessonState } from '../../src/core/lessons';
import { newProgress, type SkillProgress } from '../../src/core/mastery';
import type { Lesson } from '../../src/core/types';

const lesson = (id: string, skill = 'd.a'): Lesson => ({
  id: `${skill}/${id}`,
  skill,
  title: id,
  steps: [{ kind: 'explain', text: 'Regarde.' }],
});
const FIRST = lesson('first');
const SECOND = lesson('second');
const OTHER = lesson('other', 'd.b');

const state = (seen: Lesson[] = [], used = false): LessonState => ({
  lessons: [FIRST, SECOND, OTHER],
  seen: new Set(seen.map((l) => l.id)),
  used,
});

/** A notion answered in this order, right or not. */
function answered(...rights: boolean[]): SkillProgress {
  return {
    ...newProgress('d.a'),
    stage: 'learning',
    recent: rights.map((right) => ({ level: 0, right, day: 1 })),
  };
}

describe('astuces au bon moment (#51)', () => {
  it('plays the astuce of a notion before its very first question, once', () => {
    expect(lessonBefore('d.a', undefined, state())).toEqual({ kind: 'impose', lesson: FIRST });
    expect(lessonBefore('d.a', newProgress('d.a'), state())).toEqual({
      kind: 'impose',
      lesson: FIRST,
    });
    // Never imposed twice: the next one not seen, then nothing.
    expect(lessonBefore('d.a', undefined, state([FIRST]))?.lesson).toBe(SECOND);
    expect(lessonBefore('d.a', undefined, state([FIRST, SECOND]))).toBeNull();
    // A notion already met (even without answers kept), one without astuce.
    expect(lessonBefore('d.a', answered(true), state())).toBeNull();
    expect(lessonBefore('d.a', answered(), state())).toBeNull();
    expect(lessonBefore('d.c', undefined, state())).toBeNull();
  });

  it('offers it after 3 mistakes among the last 5 answers of the notion', () => {
    expect(lessonAfter('d.a', answered(true, false, true, false, true), state())).toBeNull();
    expect(lessonAfter('d.a', answered(false, true, false, true, false), state())).toEqual({
      kind: 'offer',
      lesson: FIRST,
    });
    // Older mistakes do not count.
    expect(
      lessonAfter('d.a', answered(false, false, false, true, true, true, false, true), state()),
    ).toBeNull();
    // Seen already: offered again, the one not seen first.
    expect(lessonAfter('d.a', answered(false, false, false), state([FIRST]))?.lesson).toBe(SECOND);
    expect(lessonAfter('d.a', answered(false, false, false), state([FIRST, SECOND]))?.lesson).toBe(
      FIRST,
    );
    expect(lessonAfter('d.c', answered(false, false, false), state())).toBeNull();
  });

  it('keeps an astuce of higher levels for them (#176)', () => {
    const LATER = { ...lesson('later'), fromLevel: 6 };
    const states = (seen: Lesson[]): LessonState => ({
      lessons: [FIRST, LATER],
      seen: new Set(seen.map((l) => l.id)),
      used: false,
    });
    const at = (level: number) => ({ ...answered(false, false, false), level });
    expect(lessonAfter('d.a', at(2), states([FIRST]))?.lesson).toBe(FIRST);
    expect(lessonAfter('d.a', at(6), states([FIRST]))?.lesson).toBe(LATER);
    expect(lessonBefore('d.a', undefined, states([FIRST]))).toBeNull();
  });

  it('brings at most one astuce a session', () => {
    expect(lessonBefore('d.a', undefined, state([], true))).toBeNull();
    expect(lessonAfter('d.a', answered(false, false, false), state([], true))).toBeNull();
  });
});
