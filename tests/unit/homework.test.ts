import { describe, expect, it } from 'vitest';
import { challengeAsked, lessonAsked, NO_REQUESTS } from '../../src/core/homework';
import { Rng } from '../../src/core/rng';
import { Session } from '../../src/core/session';
import { changeSetting, endFocus } from '../../src/core/settings';
import type { Lesson, Skill } from '../../src/core/types';
import { DOMAINS } from '../../src/domains';
import { curriculum } from '../../src/core/registry';
import { CLEARING } from './helpers';

const SKILLS = curriculum(DOMAINS);
const byId = (id: string) => SKILLS.find((skill) => skill.id === id)!;
const TABLES = byId('times-tables.products');
const NINE = byId('mental-math.nine-eleven');
const LESSON: Lesson = DOMAINS.flatMap((d) => d.lessons ?? [])[0];

describe('devoirs de la semaine (#54)', () => {
  it('keeps a focus to its last day, back to auto the day after, levels kept', () => {
    const settings = changeSetting(new Map(), TABLES, { mode: 'focus', until: 300, maxLevel: 2 });
    expect(settings.get(TABLES.id)).toMatchObject({ mode: 'focus', until: 300 });
    expect(endFocus(settings, 300).get(TABLES.id)?.mode).toBe('focus');
    expect(endFocus(settings, 301).get(TABLES.id)).toEqual({
      skill: TABLES.id,
      mode: 'auto',
      minLevel: 0,
      maxLevel: 2,
    });
    // A focus for good, or another mode, never ends.
    const forGood = changeSetting(settings, NINE, { mode: 'focus' });
    expect(endFocus(forGood, 999).get(NINE.id)?.mode).toBe('focus');
    expect(changeSetting(settings, TABLES, { mode: 'open' }).get(TABLES.id)?.until).toBeUndefined();
  });

  it('ends the focus when the next trail of the day after is drawn', () => {
    let day = 300;
    const session = new Session(
      SKILLS,
      new Rng(1),
      () => day,
      () => CLEARING,
    );
    session.settings = changeSetting(new Map(), NINE, { mode: 'focus', until: 300 });
    session.startTrail();
    expect(session.trail.filter((step) => step.skill === NINE.id).length).toBeGreaterThanOrEqual(
      session.trail.length / 2,
    );
    day = 301;
    session.startTrail();
    expect(session.settings.get(NINE.id)?.mode).toBe('auto');
  });

  it('offers the astuce and the challenge asked for once, at the next trail', () => {
    const asked = { lesson: LESSON.id, challenge: TABLES.id };
    const first = lessonAsked(asked, [LESSON]);
    expect(first.lesson).toBe(LESSON);
    expect(lessonAsked(first.requests, [LESSON]).lesson).toBeNull();
    expect(lessonAsked({ ...NO_REQUESTS, lesson: 'gone/away' }, [LESSON])).toEqual({
      lesson: null,
      requests: NO_REQUESTS,
    });
    // The notion has no challenge yet (not acquired): the squirrel waits for a later trail.
    expect(challengeAsked(asked, []).skill).toBeNull();
    expect(challengeAsked(asked, []).requests).toBe(asked);
    const offered = challengeAsked(asked, [TABLES as Skill]);
    expect(offered.skill).toBe(TABLES);
    expect(challengeAsked(offered.requests, [TABLES]).skill).toBeNull();
  });
});
