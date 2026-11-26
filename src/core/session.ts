import { CHOICE_SHARE, offerChoices } from './choices';
import { effort, LEAVES_AT_RECORD, LEAVES_PER_RIGHT_ANSWER } from './economy';
import { isKnown, recordFact, newFact, type FactProgress } from './facts';
import { bestLevel, isAcquired, newProgress, record, type SkillProgress } from './mastery';
import {
  addAttempt,
  formatKey,
  type Attempt,
  type ChallengeFormat,
  type ChallengeRecord,
} from './records';
import type { Rng } from './rng';
import { clampLevel, endFocus, settingOf, type SkillSetting } from './settings';
import {
  atRecord,
  composeTrail,
  revisit,
  stepLevel,
  type TrailLength,
  type TrailStep,
} from './trail';
import type { Exercise, ExerciseContext, FactId, Skill, SkillId } from './types';

/** Answers of the last trails used for the success rate. */
const HISTORY = 30;
/** Easy questions added at most when the last one ended with the answer shown. */
const MAX_EXTRA = 2;
/** Plays kept for the parent dashboard. */
const PLAYS = 60;

/** A trail, a drill or a challenge played, for the parent dashboard (#47). */
export interface Play {
  day: number;
  kind: 'trail' | 'drill' | 'challenge';
  /** Questions answered, and right at the first try. */
  questions: number;
  right: number;
  /** Time spent, the pauses taken away. */
  ms: number;
}

/** Something learnt with an answer: each brings golden seeds. */
export type Achievement =
  | { kind: 'acquired'; skill: SkillId }
  | { kind: 'automated'; fact: FactId }
  /** A level of the notion reached for the first time (#141). */
  | { kind: 'level'; skill: SkillId; level: number };

/**
 * The trails of a player, one after the other: composes them, asks their questions and
 * records the answers in the progress of the notions and facts. `today` is the day number.
 */
export class Session {
  readonly progress = new Map<SkillId, SkillProgress>();
  readonly facts = new Map<FactId, FactProgress>();
  /** Challenges played, by notion and format (`records.ts`). */
  readonly records = new Map<string, ChallengeRecord>();
  /** The parent's settings of the notions (#47). */
  settings = new Map<SkillId, SkillSetting>();
  /** Factor on the time of a fast answer for a fact to count towards automation (#47). */
  automation = 1;
  /** The parent opened the long challenges: the basket of 1 min 30 and the race of 20 (#132). */
  longChallenges = false;
  /** The last plays, oldest first. */
  plays: Play[] = [];
  trail: TrailStep[] = [];
  index = 0;
  /** Stones of the path: the size of the trail when it was composed. */
  stones = 0;
  /** Right first answers of the trail in progress. */
  results: boolean[] = [];
  /** Leaves a right answer to the question asked earns: more at the notion's record (#141). */
  worth = LEAVES_PER_RIGHT_ANSWER;
  private readonly byId: Map<SkillId, Skill>;
  private history: boolean[] = [];
  private extra = 0;

  constructor(
    readonly skills: readonly Skill[],
    private readonly rng: Rng,
    readonly today: () => number,
    /** The decor of the painting in progress, when a question is asked. */
    readonly context: () => ExerciseContext,
    public length: TrailLength = 'normal',
  ) {
    this.byId = new Map(skills.map((skill) => [skill.id, skill]));
  }

  startTrail(): void {
    // The homework of last week is over: its notions join the usual review.
    this.settings = endFocus(this.settings, this.today());
    this.trail = composeTrail({
      skills: this.skills,
      progress: this.progress,
      day: this.today(),
      length: this.length,
      recentRate:
        this.history.length === 0
          ? null
          : this.history.filter(Boolean).length / this.history.length,
      slowing: false,
      settings: this.settings,
      rng: this.rng,
    });
    this.index = 0;
    this.stones = this.trail.length;
    this.results = [];
    this.extra = 0;
  }

  get step(): TrailStep {
    return this.trail[this.index];
  }

  /**
   * A question for the current step, different from the previous one. After the first one, a
   * keypad question is sometimes offered among choices, on a generator of its own: the
   * questions themselves stay the same.
   */
  ask(previous?: Exercise): { skill: Skill; exercise: Exercise } {
    const skill = this.byId.get(this.step.skill)!;
    const progress = this.progress.get(skill.id);
    const setting = settingOf(this.settings, skill);
    const level = stepLevel(this.step, progress, setting);
    this.worth =
      effort(skill, level) *
      (atRecord(this.step, level, progress, setting) ? LEAVES_AT_RECORD : LEAVES_PER_RIGHT_ANSWER);
    // The statement alone may not change (« Quelle heure est-il ? » under a clock).
    const same = (exercise: Exercise) =>
      exercise.statement === previous?.statement && exercise.answer === previous.answer;
    let exercise = skill.generate(this.rng, level, this.context());
    for (let i = 0; i < 20 && same(exercise); i++) {
      exercise = skill.generate(this.rng, level, this.context());
    }
    const offer = this.rng.fork('choices');
    if (this.index > 0 && offer.chance(CHOICE_SHARE))
      exercise = offerChoices(skill, exercise, offer);
    return { skill, exercise };
  }

  /**
   * The question is over: `right` at the first try or not, `ms` until the first answer,
   * `revealed` when the answer was shown (a close question comes back later). Returns what
   * the answer achieved: the notion acquired, the fact automated.
   */
  conclude(
    skill: Skill,
    exercise: Exercise,
    right: boolean,
    ms: number,
    revealed: boolean,
  ): Achievement[] {
    const achievements = this.learn(skill, exercise, right, ms);
    this.results.push(right);
    if (revealed) this.trail = revisit(this.trail, this.index);
    if (revealed && this.index === this.trail.length - 1 && this.extra < MAX_EXTRA) {
      // Always finish on a success: one more easy question.
      this.trail.push({ ...this.trail[this.index], role: 'finish', easy: true });
      this.extra++;
    }
    return achievements;
  }

  /** Records a trail answer in the mastery of its notion (stage, level, reviews), then its fact. */
  learn(skill: Skill, exercise: Exercise, right: boolean, ms: number): Achievement[] {
    const achievements: Achievement[] = [];
    // The level moves within the parent's range only.
    const setting = settingOf(this.settings, skill);
    const before = this.progress.get(skill.id) ?? newProgress(skill.id);
    const progress = { ...before, level: clampLevel(before.level, setting) };
    const recorded = record(progress, { right, day: this.today() }, setting.maxLevel + 1);
    const level = clampLevel(recorded.level, setting);
    const best = bestLevel(before);
    this.progress.set(skill.id, { ...recorded, level, best: Math.max(best, level) });
    // A level climbed by the child for the first time, never one the parent's range gave.
    if (recorded.level > progress.level && level > best) {
      achievements.push({ kind: 'level', skill: skill.id, level });
    }
    if (!isAcquired(progress) && isAcquired(recorded)) {
      achievements.push({ kind: 'acquired', skill: skill.id });
    }
    return [...achievements, ...this.practise(skill, exercise, right, ms)];
  }

  /**
   * Records an answer in its fact only (by heart, response time): a drill or a challenge never
   * moves a notion, whose mastery plays out on the trail (#122).
   */
  practise(skill: Skill, exercise: Exercise, right: boolean, ms: number): Achievement[] {
    // A choice is recognised, not recalled: it never automates a fact.
    const fact = exercise.input.kind === 'choice' ? null : skill.facts?.of(exercise);
    if (!fact) return [];
    const seen = this.facts.get(fact) ?? newFact(fact);
    const day = this.today();
    const after = recordFact(seen, { right, ms, day }, skill.facts!.seconds * this.automation);
    this.facts.set(fact, after);
    return !isKnown(seen) && isKnown(after) ? [{ kind: 'automated', fact }] : [];
  }

  /** A trail, a drill or a challenge is over: the parent dashboard keeps it. */
  addPlay(play: Play): void {
    this.plays = [...this.plays, play].slice(-PLAYS);
  }

  /** Moves to the next step; false when the trail is over. */
  advance(): boolean {
    if (this.index + 1 < this.trail.length) {
      this.index++;
      return true;
    }
    this.history = [...this.history, ...this.results].slice(-HISTORY);
    return false;
  }

  /** The stone in progress, the extra questions staying on the last one. */
  get stone(): number {
    return Math.min(this.index, this.stones - 1);
  }

  /** What a save keeps: the trail in progress starts again. */
  snapshot(): SessionSnapshot {
    return {
      progress: [...this.progress.values()],
      facts: [...this.facts.values()],
      history: [...this.history],
      records: [...this.records.values()],
      settings: [...this.settings.values()],
      automation: this.automation,
      longChallenges: this.longChallenges,
      plays: [...this.plays],
    };
  }

  restore(snapshot: SessionSnapshot): void {
    this.progress.clear();
    for (const p of snapshot.progress) this.progress.set(p.skill, p);
    this.facts.clear();
    for (const f of snapshot.facts) this.facts.set(f.fact, f);
    this.history = snapshot.history.slice(-HISTORY);
    this.records.clear();
    for (const r of snapshot.records) this.records.set(recordKey(r.skill, r.format), r);
    this.settings = new Map(snapshot.settings.map((s) => [s.skill, s]));
    this.automation = snapshot.automation;
    this.longChallenges = snapshot.longChallenges;
    this.plays = snapshot.plays.slice(-PLAYS);
  }

  /** The attempts of a notion's challenge in a format, the oldest first. */
  attempts(skill: SkillId, format: ChallengeFormat): Attempt[] {
    return this.records.get(recordKey(skill, formatKey(format)))?.attempts ?? [];
  }

  addAttempt(skill: SkillId, format: ChallengeFormat, attempt: Attempt): void {
    const key = formatKey(format);
    const record = this.records.get(recordKey(skill, key)) ?? { skill, format: key, attempts: [] };
    this.records.set(recordKey(skill, key), addAttempt(record, attempt));
  }
}

const recordKey = (skill: SkillId, format: string) => `${skill}|${format}`;

export interface SessionSnapshot {
  progress: SkillProgress[];
  facts: FactProgress[];
  /** Right first answers of the last trails. */
  history: boolean[];
  /** The challenges played, per notion and format. */
  records: ChallengeRecord[];
  /** The parent's settings: notions not on auto or not on their whole range. */
  settings: SkillSetting[];
  automation: number;
  longChallenges: boolean;
  plays: Play[];
}
