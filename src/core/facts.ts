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
  /** Automated once: the child keeps it by heart, even after a mistake (#123). */
  known?: true;
  /** Day the drill last gave a leaf for it: once a day at most (#125). */
  paid?: number;
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
  const after = {
    ...progress,
    tries: progress.tries + 1,
    right: progress.right + (answer.right ? 1 : 0),
    fastDays,
    times: [...progress.times, answer.ms].slice(-TIMES),
  };
  return isKnown(after) ? { ...after, known: true } : after;
}

/** For the engine: automated now, lost by a mistake until it is again. */
export function isAutomated(progress: FactProgress | undefined): boolean {
  return progress !== undefined && progress.fastDays.length >= AUTOMATED_DAYS;
}

/** For the child: automated once, by heart for good (Carnet, golden seed). */
export function isKnown(progress: FactProgress | undefined): boolean {
  return progress?.known === true || isAutomated(progress);
}

/** Known by heart once, then missed: to consolidate. */
export function isSlipping(progress: FactProgress | undefined): boolean {
  return isKnown(progress) && !isAutomated(progress);
}

/** The drill still gives a leaf for it today: not known by heart, not paid yet (#125). */
export function paysToday(progress: FactProgress | undefined, day: number): boolean {
  return !isKnown(progress) && progress?.paid !== day;
}

/** Seen, not automated, and often missed or slipping: for the parent dashboard. */
export function isFragile(progress: FactProgress): boolean {
  return (
    progress.tries > 0 &&
    !isAutomated(progress) &&
    (isSlipping(progress) || progress.right / progress.tries < FRAGILE_RATE)
  );
}

/** Tries, and their rate of right first answers, that make a fact sure. */
const SURE_TRIES = 3;
const SURE_RATE = 0.9;

/** A fact the child nearly always knows: the drill mixes it with the hard ones. */
export function isSure(progress: FactProgress | undefined): boolean {
  if (progress === undefined) return false;
  return (
    isAutomated(progress) ||
    (!isSlipping(progress) &&
      progress.tries >= SURE_TRIES &&
      progress.right / progress.tries >= SURE_RATE)
  );
}

/** A notion with facts is automated when all its facts are. */
export function allAutomated(
  facts: readonly FactId[],
  progress: ReadonlyMap<FactId, FactProgress>,
): boolean {
  return facts.length > 0 && facts.every((fact) => isAutomated(progress.get(fact)));
}
