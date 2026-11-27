import { bubbleErrors, exerciseErrors } from './content';
import type { Domain, Exercise, Lesson, Skill, SkillFacts, SkillId } from './types';

/** Content limits checked by the tests (plan, « Pour le parent et le code »). */
export const MAX_LESSON_STEPS = 6;

export function defineDomain(domain: Domain): Domain {
  return domain;
}

export function defineSkill<E extends Exercise>(skill: Skill<E>): Skill<E> {
  return skill;
}

export function defineLesson(lesson: Lesson): Lesson {
  return lesson;
}

/** Every notion of the registry, by identifier. */
export function skillsById(domains: readonly Domain[]): Map<SkillId, Skill> {
  return new Map(domains.flatMap((domain) => domain.skills.map((skill) => [skill.id, skill])));
}

/**
 * Order in which the trail opens the notions: the registry's `order` first, then the notions it
 * does not list, the domains taking turns (the first notion of each domain, then the second…).
 */
export function curriculum(domains: readonly Domain[], order: readonly SkillId[]): Skill[] {
  const byId = skillsById(domains);
  const first = order.flatMap((id) => byId.get(id) ?? []);
  const longest = Math.max(0, ...domains.map((domain) => domain.skills.length));
  const rest = Array.from({ length: longest }, (_, i) =>
    domains.flatMap((domain) => domain.skills[i] ?? []),
  )
    .flat()
    .filter((skill) => !first.includes(skill));
  return [...first, ...rest];
}

/**
 * Content errors of a registry (empty when valid): unique identifiers prefixed by their
 * domain, existing prerequisites without cycles, at least one level, facts and their groups
 * declared once, short lessons on existing notions.
 */
export function registryErrors(domains: readonly Domain[]): string[] {
  const errors: string[] = [];
  const domainIds = new Set<string>();
  const skills = new Map<SkillId, Skill>();
  for (const domain of domains) {
    if (domainIds.has(domain.id)) errors.push(`domaine en double : ${domain.id}`);
    domainIds.add(domain.id);
    for (const skill of domain.skills) {
      if (skills.has(skill.id)) errors.push(`notion en double : ${skill.id}`);
      if (!skill.id.startsWith(`${domain.id}.`)) {
        errors.push(`${skill.id} n'est pas préfixée par ${domain.id}.`);
      }
      if (!Number.isInteger(skill.levels) || skill.levels < 1) {
        errors.push(`${skill.id} : niveaux invalides`);
      }
      errors.push(...factErrors(skill), ...secondsErrors(skill));
      skills.set(skill.id, skill);
    }
  }
  for (const skill of skills.values()) {
    for (const id of skill.prerequisites) {
      if (!skills.has(id)) errors.push(`${skill.id} : prérequis inconnu ${id}`);
    }
  }
  return [...errors, ...cycleErrors(skills), ...lessonErrors(domains, skills)];
}

function secondsErrors(skill: Skill): string[] {
  const seconds = skill.questionSeconds;
  if (!seconds) return [];
  return seconds.length === skill.levels && seconds.every((s) => s > 0)
    ? []
    : [`${skill.id} : un temps par niveau attendu`];
}

function factErrors(skill: Skill): string[] {
  if (!skill.facts) return [];
  const errors: string[] = [];
  if (new Set(skill.facts.all).size !== skill.facts.all.length) {
    errors.push(`${skill.id} : fait en double`);
  }
  for (const fact of skill.facts.all) {
    if (!fact.startsWith(`${skill.id}:`)) errors.push(`${fact} n'est pas préfixé par ${skill.id}:`);
  }
  return [...errors, ...groupErrors(skill.id, skill.facts)];
}

function groupErrors(id: SkillId, facts: SkillFacts): string[] {
  const errors: string[] = [];
  const groups = facts.groups ?? [];
  if (new Set(groups.map((group) => group.id)).size !== groups.length) {
    errors.push(`${id} : groupe de faits en double`);
  }
  for (const group of groups) {
    if (group.facts.length === 0) errors.push(`${id} : groupe ${group.id} vide`);
    for (const fact of group.facts.filter((fact) => !facts.all.includes(fact))) {
      errors.push(`${id} : groupe ${group.id}, fait inconnu ${fact}`);
    }
  }
  return errors;
}

function lessonErrors(domains: readonly Domain[], skills: ReadonlyMap<SkillId, Skill>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const lesson of domains.flatMap((domain) => domain.lessons ?? [])) {
    if (ids.has(lesson.id)) errors.push(`astuce en double : ${lesson.id}`);
    ids.add(lesson.id);
    errors.push(...lessonContentErrors(lesson, skills));
  }
  return errors;
}

/**
 * What is wrong with a lesson (empty when valid): an existing notion, at most 6 steps, texts
 * of Plume's bubble, exercises valid for their notion, checks at one of its levels.
 */
export function lessonContentErrors(lesson: Lesson, skills: ReadonlyMap<SkillId, Skill>): string[] {
  const errors: string[] = [];
  const skill = skills.get(lesson.skill);
  if (!skill) errors.push(`${lesson.id} : notion inconnue ${lesson.skill}`);
  if (!lesson.id.startsWith(`${lesson.skill}/`)) {
    errors.push(`${lesson.id} n'est pas préfixée par ${lesson.skill}/`);
  }
  const from = lesson.fromLevel ?? 0;
  if (skill && !(Number.isInteger(from) && from >= 0 && from < skill.levels)) {
    errors.push(`${lesson.id} : à partir du niveau ${from}, hors de ${skill.id}`);
  }
  if (lesson.steps.length === 0 || lesson.steps.length > MAX_LESSON_STEPS) {
    errors.push(`${lesson.id} : ${lesson.steps.length} étapes (1 à ${MAX_LESSON_STEPS})`);
  }
  for (const step of lesson.steps) {
    if (step.kind === 'check') {
      if (
        skill &&
        !(Number.isInteger(step.level) && step.level >= 0 && step.level < skill.levels)
      ) {
        errors.push(`${lesson.id} : niveau ${step.level} hors de ${skill.id}`);
      }
      continue;
    }
    errors.push(...bubbleErrors(lesson.id, step.text));
    const exercise = step.kind === 'explain' ? step.demo : step.exercise;
    if (!exercise) continue;
    const own = skills.get(exercise.skill);
    if (!own) errors.push(`${lesson.id} : notion inconnue ${exercise.skill}`);
    else
      errors.push(
        ...exerciseErrors(own, exercise, exercise.level).map((e) => `${lesson.id} : ${e}`),
      );
  }
  return errors;
}

/** Depth-first search for prerequisite cycles. */
function cycleErrors(skills: ReadonlyMap<SkillId, Skill>): string[] {
  const errors: string[] = [];
  const state = new Map<SkillId, 'visiting' | 'done'>();
  const visit = (id: SkillId, path: SkillId[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      errors.push(`boucle de prérequis : ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 'visiting');
    for (const next of skills.get(id)?.prerequisites ?? []) visit(next, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of skills.keys()) visit(id, []);
  return errors;
}
