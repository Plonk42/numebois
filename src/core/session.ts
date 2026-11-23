import { recordFact, newFact, type FactProgress } from './facts';
import { newProgress, record, type SkillProgress } from './mastery';
import type { Rng } from './rng';
import { composeTrail, revisit, stepLevel, type TrailLength, type TrailStep } from './trail';
import type { Exercise, FactId, Skill, SkillId } from './types';

/** Answers of the last trails used for the success rate. */
const HISTORY = 30;
/** Easy questions added at most when the last one ended with the answer shown. */
const MAX_EXTRA = 2;

/**
 * The trails of a player, one after the other: composes them, asks their questions and
 * records the answers in the progress of the notions and facts. `today` is the day number.
 */
export class Session {
  readonly progress = new Map<SkillId, SkillProgress>();
  readonly facts = new Map<FactId, FactProgress>();
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
    private readonly skills: readonly Skill[],
    private readonly rng: Rng,
    private readonly today: () => number,
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

  /** A question for the current step, different from the previous one. */
  ask(previous?: Exercise): { skill: Skill; exercise: Exercise } {
    const skill = this.byId.get(this.step.skill)!;
    const level = stepLevel(this.step, this.progress.get(skill.id));
    let exercise = skill.generate(this.rng, level);
    for (let i = 0; i < 20 && exercise.statement === previous?.statement; i++) {
      exercise = skill.generate(this.rng, level);
    }
    return { skill, exercise };
  }

  /**
   * The question is over: `right` at the first try or not, `ms` until the first answer,
   * `revealed` when the answer was shown (a close question comes back later).
   */
  conclude(skill: Skill, exercise: Exercise, right: boolean, ms: number, revealed: boolean): void {
    const day = this.today();
    const progress = this.progress.get(skill.id) ?? newProgress(skill.id);
    this.progress.set(skill.id, record(progress, { right, day }, skill.levels));
    const fact = skill.facts?.of(exercise);
    if (fact) {
      const before = this.facts.get(fact) ?? newFact(fact);
      this.facts.set(fact, recordFact(before, { right, ms, day }, skill.facts!.seconds));
    }
    this.results.push(right);
    if (revealed) this.trail = revisit(this.trail, this.index);
    if (revealed && this.index === this.trail.length - 1 && this.extra < MAX_EXTRA) {
      // Always finish on a success: one more easy question.
      this.trail.push({ ...this.trail[this.index], role: 'finish', easy: true });
      this.extra++;
    }
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
}
