import { isAcquired, isDue, type SkillProgress } from './mastery';
import type { Rng } from './rng';
import type { Skill, SkillId } from './types';

export type TrailLength = 'short' | 'normal';
/** Questions of a trail: about 5 or 10 minutes, whatever the content. */
export const TRAIL_QUESTIONS: Record<TrailLength, number> = { short: 6, normal: 10 };
/** Notions in progress at the same time. */
export const MAX_ACTIVE = 3;
/** Share of reviews in a trail; the surplus waits for the next one. */
export const REVIEW_SHARE = 0.25;
/** Under this rate of right first answers: no novelty, easier questions. */
export const LOW_RATE = 0.7;

/**
 * warmup: easy start; core: the notions in progress; review: spaced review of an acquired
 * notion; new: first question of a new notion; again: a question close to a missed one;
 * finish: an easy end, to finish on a success.
 */
export type StepRole = 'warmup' | 'core' | 'review' | 'new' | 'again' | 'finish';

export interface TrailStep {
  skill: SkillId;
  role: StepRole;
  /** One level below the notion's current level. */
  easy: boolean;
}

export interface TrailInput {
  /** Every notion, in the order of the curriculum. */
  skills: readonly Skill[];
  progress: ReadonlyMap<SkillId, SkillProgress>;
  day: number;
  length: TrailLength;
  /** Right first answers in the last sessions, null before the first one. */
  recentRate: number | null;
  /** Response times clearly longer than usual: the trail is shortened. */
  slowing: boolean;
  rng: Rng;
}

/** The trail of a session: fixed size, at most 3 notions in progress and one novelty. */
export function composeTrail(input: TrailInput): TrailStep[] {
  const { skills, progress, day, rng } = input;
  const size = TRAIL_QUESTIONS[input.slowing ? 'short' : input.length];
  const struggling = input.recentRate !== null && input.recentRate < LOW_RATE;
  const stage = (skill: Skill) => progress.get(skill.id)?.stage ?? 'discovery';

  const active = skills.filter((skill) => stage(skill) === 'learning').slice(0, MAX_ACTIVE);
  const novelty =
    struggling || active.length >= MAX_ACTIVE
      ? undefined
      : skills.find(
          (skill) =>
            stage(skill) === 'discovery' &&
            skill.prerequisites.every((id) => isAcquired(progress.get(id))),
        );
  if (novelty) active.push(novelty);
  const acquired = skills.filter((skill) => isAcquired(progress.get(skill.id)));
  const reviews = acquired
    .filter((skill) => isDue(progress.get(skill.id)!, day))
    .sort((a, b) => progress.get(a.id)!.due! - progress.get(b.id)!.due!)
    .slice(0, Math.floor(size * REVIEW_SHARE));
  // Everything acquired and nothing new to open: keep 3 acquired notions alive.
  const practised = active.length > 0 ? active : shuffled(acquired, rng).slice(0, MAX_ACTIVE);
  if (practised.length === 0) throw new Error('aucune notion à jouer');

  const known = practised.filter((skill) => skill !== novelty);
  const easyPool = [acquired, known, practised].find((pool) => pool.length > 0)!;
  const easy = (role: StepRole): TrailStep => ({ skill: rng.pick(easyPool).id, role, easy: true });
  const warmup = Array.from({ length: struggling ? 3 : 2 }, () => easy('warmup'));
  const coreCount = size - warmup.length - reviews.length - 1;
  const start = rng.int(0, practised.length - 1);
  const core: TrailStep[] = Array.from({ length: coreCount }, (_, i) => ({
    skill: practised[(start + i) % practised.length].id,
    role: 'core',
    easy: struggling,
  }));
  if (novelty) {
    const own = core.findIndex((step) => step.skill === novelty.id);
    core.splice(own >= 0 ? own : core.length - 1, 1);
    core.unshift({ skill: novelty.id, role: 'new', easy: false });
  }
  // Reviews spread among the core questions.
  reviews.forEach((skill, i) => {
    const at = Math.round(((i + 1) * core.length) / (reviews.length + 1));
    core.splice(at, 0, { skill: skill.id, role: 'review', easy: false });
  });
  return [...warmup, ...core, easy('finish')];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The level to ask for a step, from the notion's progress at that time. */
export function stepLevel(step: TrailStep, progress: SkillProgress | undefined): number {
  const level = progress?.level ?? 0;
  return step.easy ? Math.max(0, level - 1) : level;
}

/**
 * After a missed question, a close one comes back a little later: it replaces a later core
 * or warmup question, so the trail keeps its size. Unchanged when there is no room.
 */
export function revisit(trail: readonly TrailStep[], index: number): TrailStep[] {
  const later = trail.findIndex(
    (step, i) => i >= index + 2 && i < trail.length - 1 && step.role === 'core',
  );
  if (later < 0) return [...trail];
  const next = [...trail];
  next[later] = { skill: trail[index].skill, role: 'again', easy: false };
  return next;
}
