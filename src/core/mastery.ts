import type { SkillId } from './types';

/** Days before each review, Leitner boxes (plan, « Pour l'enfant », point 2). */
export const REVIEW_DAYS = [1, 3, 7, 21, 60] as const;
/** Answers kept for the mastery rate. */
export const WINDOW = 10;
/** Right first answers in a row that open the next internal level. */
export const LEVEL_UP = 3;
/** Answers at the last level, and their rate, to acquire a notion. */
export const ACQUIRE_ANSWERS = 5;
export const ACQUIRE_RATE = 0.8;
/** Below this rate over the window, an acquired notion goes back to learning. */
export const RELEARN_RATE = 0.5;

/**
 * Discovery (never answered), learning, acquired (waiting for its first review),
 * maintenance (spaced reviews), anchored (the last review passed). « Automatisée » comes
 * from the facts (`facts.ts`).
 */
export type Stage = 'discovery' | 'learning' | 'acquired' | 'maintenance' | 'anchored';

export interface Answer {
  level: number;
  /** Right at the first try. */
  right: boolean;
  /** Day number given by the caller's clock. */
  day: number;
}

export interface SkillProgress {
  skill: SkillId;
  stage: Stage;
  /** Current internal level. */
  level: number;
  /** Last answers, oldest first, at most `WINDOW`. */
  recent: Answer[];
  /** Leitner box, index in `REVIEW_DAYS`. */
  box: number;
  /** Day of the next review, once acquired and until anchored. */
  due: number | null;
}

export function newProgress(skill: SkillId): SkillProgress {
  return { skill, stage: 'discovery', level: 0, recent: [], box: 0, due: null };
}

/** Right first answers over the last `WINDOW` answers, 0 without answers. */
export function masteryRate(progress: SkillProgress): number {
  const { recent } = progress;
  return recent.length === 0 ? 0 : recent.filter((a) => a.right).length / recent.length;
}

export function isDue(progress: SkillProgress, day: number): boolean {
  return progress.due !== null && day >= progress.due;
}

/** Acquired at least once: in review or anchored. */
export function isAcquired(progress: SkillProgress | undefined): boolean {
  return progress !== undefined && ['acquired', 'maintenance', 'anchored'].includes(progress.stage);
}

/** The progress after one answer of the child; `levels` is the notion's level count. */
export function record(
  progress: SkillProgress,
  answer: { right: boolean; day: number },
  levels: number,
): SkillProgress {
  const reviewing = isDue(progress, answer.day);
  const next: SkillProgress = {
    ...progress,
    recent: [...progress.recent, { level: progress.level, ...answer }].slice(-WINDOW),
  };
  if (next.stage === 'discovery') next.stage = 'learning';
  if (next.stage === 'learning') return learn(next, answer.day, levels);
  if (next.recent.length > WINDOW / 2 && masteryRate(next) < RELEARN_RATE) {
    return { ...next, stage: 'learning', box: 0, due: null };
  }
  if (!reviewing) return next;
  if (!answer.right)
    return { ...next, stage: 'maintenance', box: 0, due: answer.day + REVIEW_DAYS[0] };
  const box = next.box + 1;
  if (box >= REVIEW_DAYS.length) return { ...next, stage: 'anchored', box, due: null };
  return { ...next, stage: 'maintenance', box, due: answer.day + REVIEW_DAYS[box] };
}

function learn(progress: SkillProgress, day: number, levels: number): SkillProgress {
  const atLevel = progress.recent.filter((a) => a.level === progress.level);
  const last = atLevel.slice(-LEVEL_UP);
  const top = progress.level >= levels - 1;
  if (!top && last.length === LEVEL_UP && last.every((a) => a.right)) {
    return { ...progress, level: progress.level + 1 };
  }
  if (progress.level > 0 && last.length === LEVEL_UP && last.every((a) => !a.right)) {
    return { ...progress, level: progress.level - 1 };
  }
  const lastAtTop = atLevel.slice(-ACQUIRE_ANSWERS);
  if (
    top &&
    lastAtTop.length === ACQUIRE_ANSWERS &&
    lastAtTop.filter((a) => a.right).length >= ACQUIRE_RATE * ACQUIRE_ANSWERS &&
    masteryRate(progress) >= ACQUIRE_RATE
  ) {
    return { ...progress, stage: 'acquired', box: 0, due: day + REVIEW_DAYS[0] };
  }
  return progress;
}
