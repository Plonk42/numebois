import type { FactId } from './types';

/** Fast right first answers, on different days, for a fact to be automated. */
export const AUTOMATED_DAYS = 3;
/** Response times kept for the parent dashboard. */
const TIMES = 5;
/** Under this rate, a fact that is not automated is fragile. */
const FRAGILE_RATE = 0.7;

export interface FactProgress {
  fact: FactId;
  tries: number;
  /** Right at the first try. */
  right: number;
  /** Distinct days with a right first answer under the notion's threshold, last ones. */
  fastDays: number[];
  /** Last response times, in milliseconds. */
  times: number[];
}

export function newFact(fact: FactId): FactProgress {
  return { fact, tries: 0, right: 0, fastDays: [], times: [] };
}

/** A slow right answer neither helps nor hurts; a mistake starts the automation again. */
export function recordFact(
  progress: FactProgress,
  answer: { right: boolean; ms: number; day: number },
  seconds: number,
): FactProgress {
  const fast = answer.right && answer.ms <= seconds * 1000;
  let fastDays = progress.fastDays;
  if (!answer.right) fastDays = [];
  else if (fast && !fastDays.includes(answer.day)) {
    fastDays = [...fastDays, answer.day].slice(-AUTOMATED_DAYS);
  }
  return {
    ...progress,
    tries: progress.tries + 1,
    right: progress.right + (answer.right ? 1 : 0),
    fastDays,
    times: [...progress.times, answer.ms].slice(-TIMES),
  };
}

export function isAutomated(progress: FactProgress | undefined): boolean {
  return progress !== undefined && progress.fastDays.length >= AUTOMATED_DAYS;
}

/** Seen, not automated, and often missed: for the parent dashboard. */
export function isFragile(progress: FactProgress): boolean {
  return (
    progress.tries > 0 && !isAutomated(progress) && progress.right / progress.tries < FRAGILE_RATE
  );
}

/** A notion with facts is automated when all its facts are. */
export function allAutomated(
  facts: readonly FactId[],
  progress: ReadonlyMap<FactId, FactProgress>,
): boolean {
  return facts.length > 0 && facts.every((fact) => isAutomated(progress.get(fact)));
}
