import { CHOICE_SHARE, offerChoices } from './choices';
import { isAutomated, recordFact, newFact, type FactProgress } from './facts';
import { isAcquired, newProgress, record, type SkillProgress } from './mastery';
import {
  addAttempt,
  formatKey,
  type Attempt,
  type ChallengeFormat,
  type ChallengeRecord,
} from './records';
import type { Rng } from './rng';
import { composeTrail, revisit, stepLevel, type TrailLength, type TrailStep } from './trail';
import type { Exercise, ExerciseContext, FactId, Skill, SkillId } from './types';

/** Answers of the last trails used for the success rate. */
const HISTORY = 30;
/** Easy questions added at most when the last one ended with the answer shown. */
const MAX_EXTRA = 2;

/** Something learnt with an answer: each brings golden seeds. */
export type Achievement =
  { kind: 'acquired'; skill: SkillId } | { kind: 'automated'; fact: FactId };

/**
 * The trails of a player, one after the other: composes them, asks their questions and
 * records the answers in the progress of the notions and facts. `today` is the day number.
 */
export class Session {
  readonly progress = new Map<SkillId, SkillProgress>();
  readonly facts = new Map<FactId, FactProgress>();
  /** Challenges played, by notion and format (`records.ts`). */
  readonly records = new Map<string, ChallengeRecord>();
  trail: TrailStep[] = [];
  index = 0;
  /** Stones of the path: the size of the trail when it was composed. */
  stones = 0;
  /** Right first answers of the trail in progress. */
  results: boolean[] = [];
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
    const level = stepLevel(this.step, this.progress.get(skill.id));
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

  /** Records an answer, of a trail or a drill, in the progress of its notion and fact. */
  learn(skill: Skill, exercise: Exercise, right: boolean, ms: number): Achievement[] {
    const achievements: Achievement[] = [];
    const day = this.today();
    const progress = this.progress.get(skill.id) ?? newProgress(skill.id);
    const recorded = record(progress, { right, day }, skill.levels);
    this.progress.set(skill.id, recorded);
    if (!isAcquired(progress) && isAcquired(recorded)) {
      achievements.push({ kind: 'acquired', skill: skill.id });
    }
    // A choice is recognised, not recalled: it never automates a fact.
    const fact = exercise.input.kind === 'choice' ? null : skill.facts?.of(exercise);
    if (fact) {
      const before = this.facts.get(fact) ?? newFact(fact);
      const after = recordFact(before, { right, ms, day }, skill.facts!.seconds);
      this.facts.set(fact, after);
      if (!isAutomated(before) && isAutomated(after))
        achievements.push({ kind: 'automated', fact });
    }
    return achievements;
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
}
