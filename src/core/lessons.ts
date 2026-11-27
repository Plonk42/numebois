import type { SkillProgress } from './mastery';
import type { Lesson, SkillId } from './types';

/** A notion that resists: this many mistakes among its last answers. */
export const STRUGGLE_MISTAKES = 3;
export const STRUGGLE_ANSWERS = 5;

/**
 * When an astuce of Plume comes (#51): played at once when its notion opens (`impose`), or
 * offered, always refusable, when the notion resists or the parent asked for it (`offer`).
 */
export type LessonMoment = { kind: 'impose' | 'offer'; lesson: Lesson };

export interface LessonState {
  /** The astuces the game knows. */
  lessons: readonly Lesson[];
  /** Seen to the end: in the Carnet. */
  seen: ReadonlySet<string>;
  /** One already came, or was offered, in this session: at most one a session. */
  used: boolean;
}

/**
 * The astuce of a notion at its level: the first one not seen yet, or else the first one. An
 * astuce for higher levels (`fromLevel`) waits for them.
 */
function lessonOf(skill: SkillId, { lessons, seen }: LessonState, level: number): Lesson | null {
  const own = lessons.filter(
    (lesson) => lesson.skill === skill && (lesson.fromLevel ?? 0) <= level,
  );
  return own.find((lesson) => !seen.has(lesson.id)) ?? own[0] ?? null;
}

/**
 * Before a question of the trail: a notion still to discover brings its astuce first, played
 * at once, but only one never seen: never imposed twice.
 */
export function lessonBefore(
  skill: SkillId,
  progress: SkillProgress | undefined,
  state: LessonState,
): LessonMoment | null {
  if (state.used || (progress && progress.stage !== 'discovery')) return null;
  const lesson = lessonOf(skill, state, progress?.level ?? 0);
  return lesson && !state.seen.has(lesson.id) ? { kind: 'impose', lesson } : null;
}

/** After an answer: 3 mistakes among the last 5 answers of the notion offer its astuce. */
export function lessonAfter(
  skill: SkillId,
  progress: SkillProgress | undefined,
  state: LessonState,
): LessonMoment | null {
  if (state.used) return null;
  const last = progress?.recent.slice(-STRUGGLE_ANSWERS) ?? [];
  if (last.filter((answer) => !answer.right).length < STRUGGLE_MISTAKES) return null;
  const lesson = lessonOf(skill, state, progress?.level ?? 0);
  return lesson && { kind: 'offer', lesson };
}
