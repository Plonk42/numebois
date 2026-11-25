import type { SkillId } from './types';

/**
 * The formats of a challenge: the acorn basket fills during 30, 60 or 90 seconds; the leaf
 * race runs 10 or 20 questions against a ghost leaf replaying the best time.
 */
export type ChallengeFormat =
  { kind: 'basket'; seconds: 30 | 60 | 90 } | { kind: 'race'; questions: 10 | 20 };

/** One challenge played: its score (right answers in the basket, milliseconds in the race). */
export interface Attempt {
  day: number;
  score: number;
  /** Right answers over the answers. */
  rate: number;
  level: number;
}

/** The attempts of a notion in a format, the oldest first. */
export interface ChallengeRecord {
  skill: SkillId;
  /** `formatKey` of the format. */
  format: string;
  attempts: Attempt[];
}

/** Attempts kept per notion and format: enough for the median, the trend and the best. */
export const KEPT_ATTEMPTS = 10;
/** The goal and the trend look at the last attempts. */
export const RECENT_ATTEMPTS = 3;
/** Under this rate of right answers, the next challenge is easier. */
export const GUARD_RATE = 0.5;
/** The race's goal: this much faster than the recent median. */
const RACE_STEP_MS = 1000;
/** A goal never asks for more than one answer in this time (#127). */
export const GOAL_MS_PER_QUESTION = 1500;

export function formatKey(format: ChallengeFormat): string {
  return format.kind === 'basket' ? `basket-${format.seconds}` : `race-${format.questions}`;
}

/** A basket is better fuller, a race faster. */
export function better(format: ChallengeFormat, a: number, b: number): boolean {
  return format.kind === 'basket' ? a > b : a < b;
}

export function bestOf(format: ChallengeFormat, attempts: readonly Attempt[]): Attempt | null {
  return attempts.reduce<Attempt | null>(
    (best, attempt) => (best && !better(format, attempt.score, best.score) ? best : attempt),
    null,
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Just above the recent median (one more acorn, a second faster), never a distant record nor
 * faster than one answer in `GOAL_MS_PER_QUESTION`, unless the median already is; null before
 * the first attempt.
 */
export function goal(format: ChallengeFormat, attempts: readonly Attempt[]): number | null {
  if (attempts.length === 0) return null;
  const recent = median(attempts.slice(-RECENT_ATTEMPTS).map((attempt) => attempt.score));
  if (format.kind === 'basket') {
    const most = Math.floor((format.seconds * 1000) / GOAL_MS_PER_QUESTION);
    return Math.max(Math.floor(recent), Math.min(most, Math.floor(recent) + 1));
  }
  const least = format.questions * GOAL_MS_PER_QUESTION;
  return Math.min(Math.round(recent), Math.max(least, Math.round(recent) - RACE_STEP_MS));
}

export type Trend = 'better' | 'steady' | 'lower';

/** The last attempts, from the first to the last of them; null with fewer than 2. */
export function trend(format: ChallengeFormat, attempts: readonly Attempt[]): Trend | null {
  const recent = attempts.slice(-RECENT_ATTEMPTS);
  if (recent.length < 2) return null;
  const first = recent[0].score;
  const last = recent.at(-1)!.score;
  if (better(format, last, first)) return 'better';
  return better(format, first, last) ? 'lower' : 'steady';
}

export function addAttempt(record: ChallengeRecord, attempt: Attempt): ChallengeRecord {
  return { ...record, attempts: [...record.attempts, attempt].slice(-KEPT_ATTEMPTS) };
}

/** No challenge played yet on this day: the squirrel's gift waits for it (#126). */
export function firstOfDay(records: Iterable<ChallengeRecord>, day: number): boolean {
  for (const record of records) if (record.attempts.some((a) => a.day === day)) return false;
  return true;
}

/**
 * Why the end is a good one, from the best news down: the first try, a record, the goal
 * reached, better than the last time, or simply played. Never a failure.
 */
export type Ending = 'first' | 'record' | 'goal' | 'better' | 'played';

export function ending(
  format: ChallengeFormat,
  before: readonly Attempt[],
  attempt: Attempt,
): Ending {
  if (before.length === 0) return 'first';
  const best = bestOf(format, before)!;
  if (better(format, attempt.score, best.score)) return 'record';
  const target = goal(format, before)!;
  if (!better(format, target, attempt.score)) return 'goal';
  if (better(format, attempt.score, before.at(-1)!.score)) return 'better';
  return 'played';
}

/** The guard: after a challenge under 50 % right, the next one is a level easier. */
export function challengeLevel(level: number, attempts: readonly Attempt[]): number {
  const last = attempts.at(-1);
  if (!last || last.rate >= GUARD_RATE) return level;
  return Math.max(0, Math.min(level, last.level) - 1);
}
