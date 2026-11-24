import { isAcquired, type SkillProgress } from './mastery';
import { type Attempt, type ChallengeFormat } from './records';
import type { Rng } from './rng';
import type { Achievement, Session } from './session';
import type { Exercise, Skill, SkillId } from './types';

/** Draws to avoid asking the same question twice in a row. */
const REDRAWS = 20;

/** The notions a challenge can be played on: marked `challenge`, and acquired. */
export function challengeable(
  skills: readonly Skill[],
  progress: ReadonlyMap<SkillId, SkillProgress>,
): Skill[] {
  return skills.filter((skill) => skill.challenge && isAcquired(progress.get(skill.id)));
}

/**
 * A timed challenge on a notion, kind and without pressure: a mistake costs no time, the
 * clock stops while the game is hidden or the answer is shown (`pause`), and the answers go to
 * the progress of the session like any other. `now` is the clock in milliseconds.
 */
export class Challenge {
  /** Right answers, in order. */
  readonly results: boolean[] = [];
  private started: number | null = null;
  private paused: number | null = null;
  private pausedMs = 0;
  private previous: Exercise | null = null;

  constructor(
    private readonly session: Session,
    readonly skill: Skill,
    readonly format: ChallengeFormat,
    readonly level: number,
    private readonly rng: Rng,
    private readonly now: () => number,
  ) {}

  start(): void {
    this.started ??= this.now();
  }

  /** Time played, pauses left out. */
  elapsed(): number {
    if (this.started === null) return 0;
    const end = this.paused ?? this.now();
    return end - this.started - this.pausedMs;
  }

  pause(): void {
    if (this.started !== null && this.paused === null) this.paused = this.now();
  }

  resume(): void {
    if (this.paused === null) return;
    this.pausedMs += this.now() - this.paused;
    this.paused = null;
  }

  /** The basket's time is up, or the race's questions are all answered right. */
  get over(): boolean {
    if (this.format.kind === 'basket') return this.elapsed() >= this.format.seconds * 1000;
    return this.results.filter(Boolean).length >= this.format.questions;
  }

  /** Time left in the basket, in milliseconds. */
  remaining(): number {
    if (this.format.kind !== 'basket') return 0;
    return Math.max(0, this.format.seconds * 1000 - this.elapsed());
  }

  ask(): Exercise {
    this.start();
    const draw = () => this.skill.generate(this.rng, this.level, this.session.context());
    let exercise = draw();
    for (let i = 0; i < REDRAWS && this.same(exercise); i++) exercise = draw();
    this.previous = exercise;
    return exercise;
  }

  private same(exercise: Exercise): boolean {
    return (
      exercise.statement === this.previous?.statement && exercise.answer === this.previous.answer
    );
  }

  /** One answer: right or not, `ms` until it came. */
  conclude(exercise: Exercise, right: boolean, ms: number): Achievement[] {
    this.results.push(right);
    return this.session.learn(this.skill, exercise, right, ms);
  }

  /** The challenge as played: acorns in the basket, or the race's time. */
  attempt(day: number): Attempt {
    const right = this.results.filter(Boolean).length;
    return {
      day,
      score: this.format.kind === 'basket' ? right : Math.round(this.elapsed()),
      rate: this.results.length === 0 ? 0 : right / this.results.length,
      level: this.level,
    };
  }
}
