import { QUESTION_SECONDS, questionSeconds } from './economy';
import { bestLevel, isAcquired, isDue, type SkillProgress } from './mastery';
import type { Rng } from './rng';
import {
  clampLevel,
  MAX_FOCUS,
  modeOf,
  settingOf,
  type Settings,
  type SkillSetting,
} from './settings';
import type { Skill, SkillId } from './types';

export type TrailLength = 'short' | 'normal';
/**
 * Questions of a trail, quick ones: long questions make it shorter, to keep its time (#153).
 */
export const TRAIL_QUESTIONS: Record<TrailLength, number> = { short: 6, normal: 10 };
/** Notions in progress in one trail. */
export const MAX_ACTIVE = 3;
/**
 * Notions in progress at the same time: they take turns from trail to trail, so the child works
 * a little of everything, often, rather than weeks on the same ones (owner, 2026-11-27).
 */
export const MAX_LEARNING = 8;
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
  /** The parent's settings of the notions (#47); absent ones are on auto. */
  settings: Settings;
  rng: Rng;
}

/**
 * The trail of a session: the time of a fixed number of quick questions, at most 3 notions in
 * progress and one novelty. The parent's settings come first: a closed notion never comes, an
 * open one comes without its prerequisites, the notions in focus take at least half of the
 * questions.
 */
export function composeTrail(input: TrailInput): TrailStep[] {
  const { progress, day, rng, settings } = input;
  const skills = input.skills.filter((skill) => modeOf(settings, skill) !== 'closed');
  const size = TRAIL_QUESTIONS[input.slowing ? 'short' : input.length];
  const struggling = input.recentRate !== null && input.recentRate < LOW_RATE;
  const stage = (skill: Skill) => progress.get(skill.id)?.stage ?? 'discovery';
  const focus = skills.filter((skill) => modeOf(settings, skill) === 'focus').slice(0, MAX_FOCUS);
  const ready = (skill: Skill) =>
    modeOf(settings, skill) === 'open' ||
    skill.prerequisites.every((id) => isAcquired(progress.get(id)));

  const learning = skills.filter((skill) => stage(skill) === 'learning' && !focus.includes(skill));
  // A notion in focus already acquired is reviewed, not in progress: it leaves room (#54).
  const reviewed = focus.filter((skill) => isAcquired(progress.get(skill.id))).length;
  const discovery = skills.filter(
    (skill) => stage(skill) === 'discovery' && !focus.includes(skill),
  );
  // During a focus (homework of the week), no other notion opens while 3 are in progress.
  const room = focus.length > 0 ? MAX_ACTIVE : MAX_LEARNING;
  const novelty =
    struggling || focus.length - reviewed + learning.length >= room
      ? undefined
      : (discovery.find((skill) => modeOf(settings, skill) === 'open') ?? discovery.find(ready));
  const places = Math.max(MAX_ACTIVE + reviewed, focus.length) - focus.length - (novelty ? 1 : 0);
  const active = [
    ...focus,
    ...inTurn(learning, places, novelty ? [...focus, novelty] : focus, progress),
  ];
  if (novelty) active.push(novelty);
  const acquired = skills.filter((skill) => isAcquired(progress.get(skill.id)));
  const reviews = acquired
    .filter((skill) => !focus.includes(skill) && isDue(progress.get(skill.id)!, day))
    .sort((a, b) => progress.get(a.id)!.due! - progress.get(b.id)!.due!)
    .slice(0, Math.floor(size * REVIEW_SHARE));
  // Everything acquired and nothing new to open: keep 3 acquired notions alive.
  const practised = active.length > 0 ? active : shuffled(acquired, rng).slice(0, MAX_ACTIVE);
  if (practised.length === 0) throw new Error('aucune notion à jouer');

  const known = practised.filter((skill) => skill !== novelty);
  // The easy questions go to the notions seen longest ago: an acquired one never waits on luck.
  const lastSeen = (skill: Skill) => progress.get(skill.id)?.recent.at(-1)?.day ?? -Infinity;
  const easyPool = [...[acquired, known, practised].find((pool) => pool.length > 0)!].sort(
    (a, b) => lastSeen(a) - lastSeen(b),
  );
  let easyCount = 0;
  const easy = (role: StepRole): TrailStep => ({
    skill: easyPool[easyCount++ % easyPool.length].id,
    role,
    easy: true,
  });
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
  return fitTime(withFocus([...warmup, ...core, easy('finish')], focus), size, input);
}

/**
 * Long questions make a shorter trail (#153): core questions leave, then reviews (they wait for
 * the next trail), then warmup ones, the last ones and those out of the focus first, until it
 * takes the time of `size` quick ones; one core and one warmup question stay, and the focus
 * keeps half of the time.
 */
function fitTime(trail: TrailStep[], size: number, input: TrailInput): TrailStep[] {
  const byId = new Map(input.skills.map((skill) => [skill.id, skill]));
  const seconds = (step: TrailStep) => {
    const skill = byId.get(step.skill)!;
    const level = stepLevel(step, input.progress.get(skill.id), settingOf(input.settings, skill));
    return questionSeconds(skill, level);
  };
  const focus = (step: TrailStep) => modeOf(input.settings, byId.get(step.skill)!) === 'focus';
  const fitted = [...trail];
  const sum = (steps: TrailStep[]) => steps.reduce((total, step) => total + seconds(step), 0);
  let total = sum(fitted);
  let focused = sum(fitted.filter(focus));
  const leaving = () => {
    for (const [role, keep] of [
      ['core', 1],
      ['review', 0],
      ['warmup', 1],
    ] as const) {
      const steps = fitted.flatMap((step, i) => (step.role === role ? [i] : []));
      if (steps.length <= keep) continue;
      const free = steps.findLast((i) => !focus(fitted[i]));
      if (free !== undefined) return free;
      const last = seconds(fitted[steps.at(-1)!]);
      if (focused - last >= (total - last) / 2) return steps.at(-1);
    }
    return undefined;
  };
  while (total > size * QUESTION_SECONDS) {
    const out = leaving();
    if (out === undefined) break;
    total -= seconds(fitted[out]);
    if (focus(fitted[out])) focused -= seconds(fitted[out]);
    fitted.splice(out, 1);
  }
  return fitted;
}

/**
 * The notions in focus take at least half of the trail: core questions of other notions pass
 * to them in turn, then warmup and finish ones if need be (they keep the notions seen longest
 * ago coming back); the novelty and the reviews stay.
 */
function withFocus(trail: TrailStep[], focus: readonly Skill[]): TrailStep[] {
  if (focus.length === 0) return trail;
  const ids = new Set(focus.map((skill) => skill.id));
  let missing = Math.ceil(trail.length / 2) - trail.filter((step) => ids.has(step.skill)).length;
  let turn = 0;
  const pass = (steps: TrailStep[], roles: readonly StepRole[]) =>
    steps.map((step) => {
      if (missing <= 0 || ids.has(step.skill) || !roles.includes(step.role)) return step;
      missing--;
      return { ...step, skill: focus[turn++ % focus.length].id };
    });
  return pass(pass(trail, ['core']), ['warmup', 'finish']);
}

/**
 * The notions in progress of a trail take turns: those seen longest ago first (the fewest
 * answers that day), one per domain while there are others.
 */
function inTurn(
  learning: readonly Skill[],
  places: number,
  taken: readonly Skill[],
  progress: ReadonlyMap<SkillId, SkillProgress>,
): Skill[] {
  const seen = (skill: Skill) => {
    const recent = progress.get(skill.id)?.recent ?? [];
    const day = recent.at(-1)?.day ?? 0;
    return { day, answers: recent.filter((answer) => answer.day === day).length };
  };
  const turns = [...learning].sort((a, b) => {
    const [first, second] = [seen(a), seen(b)];
    return first.day - second.day || first.answers - second.answers;
  });
  const domain = (skill: Skill) => skill.id.split('.')[0];
  const domains = new Set(taken.map(domain));
  const chosen: Skill[] = [];
  for (const skill of turns) {
    if (chosen.length < places && !domains.has(domain(skill))) {
      chosen.push(skill);
      domains.add(domain(skill));
    }
  }
  for (const skill of turns) {
    if (chosen.length < places && !chosen.includes(skill)) chosen.push(skill);
  }
  return chosen;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The level to ask for a step, from the notion's progress then, within the parent's range. */
export function stepLevel(
  step: TrailStep,
  progress: SkillProgress | undefined,
  setting: SkillSetting,
): number {
  const level = progress?.level ?? 0;
  return clampLevel(step.easy ? Math.max(0, level - 1) : level, setting);
}

/**
 * A question at the notion's record, where the child works hardest: a notion being learnt, its
 * novelty, a question back after a mistake, a review (#141). Never a warmup, a finish, an easy
 * question, nor an acquired notion played again out of its review.
 */
export function atRecord(
  step: TrailStep,
  level: number,
  progress: SkillProgress | undefined,
  setting: SkillSetting,
): boolean {
  if (step.easy || step.role === 'warmup' || step.role === 'finish') return false;
  if (isAcquired(progress) && step.role !== 'review') return false;
  return level >= clampLevel(bestLevel(progress), setting);
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
