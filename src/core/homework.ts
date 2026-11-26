import type { Lesson, Skill, SkillId } from './types';

/**
 * What the parent asked for the next trail (#54): an astuce Plume offers when it starts, a
 * challenge the squirrel offers when it ends. Each is offered once, always refusable.
 */
export interface Requests {
  lesson: string | null;
  challenge: SkillId | null;
}

export const NO_REQUESTS: Requests = { lesson: null, challenge: null };

/** At the start of a trail: the astuce asked for, if the game knows it; asked once. */
export function lessonAsked(
  requests: Requests,
  lessons: readonly Lesson[],
): { lesson: Lesson | null; requests: Requests } {
  if (requests.lesson === null) return { lesson: null, requests };
  const lesson = lessons.find((l) => l.id === requests.lesson) ?? null;
  return { lesson, requests: { ...requests, lesson: null } };
}

/**
 * After a trail: the challenge asked for, on a notion that has one now (acquired); asked once.
 * Not yet acquired, it waits for a later trail.
 */
export function challengeAsked(
  requests: Requests,
  challenges: readonly Skill[],
): { skill: Skill | null; requests: Requests } {
  const skill = challenges.find((s) => s.id === requests.challenge) ?? null;
  if (!skill) return { skill: null, requests };
  return { skill, requests: { ...requests, challenge: null } };
}
