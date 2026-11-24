import type { Domain, Exercise, Lesson, Quest, Skill, SkillFacts, SkillId } from './types';

/** Content limits checked by the tests (plan, « Pour le parent et le code »). */
export const MAX_LESSON_STEPS = 6;
export const MAX_NEW_SKILLS_PER_QUEST = 2;
export const MAX_QUEST_ELEMENTS = 15;

export function defineDomain(domain: Domain): Domain {
  return domain;
}

export function defineSkill<E extends Exercise>(skill: Skill<E>): Skill<E> {
  return skill;
}

export function defineLesson(lesson: Lesson): Lesson {
  return lesson;
}

export function defineQuest(quest: Quest): Quest {
  return quest;
}

/** Every notion of the registry, by identifier. */
export function skillsById(domains: readonly Domain[]): Map<SkillId, Skill> {
  return new Map(domains.flatMap((domain) => domain.skills.map((skill) => [skill.id, skill])));
}

/**
 * Order in which the trail opens the notions: the domains take turns (the first notion of
 * each domain, then the second…), so a new domain does not wait for all of the previous one.
 */
export function curriculum(domains: readonly Domain[]): Skill[] {
  const longest = Math.max(0, ...domains.map((domain) => domain.skills.length));
  return Array.from({ length: longest }, (_, i) =>
    domains.flatMap((domain) => domain.skills[i] ?? []),
  ).flat();
}

/**
 * Content errors of a registry (empty when valid): unique identifiers prefixed by their
 * domain, existing prerequisites without cycles, at least one level, facts on drill notions
 * only, short lessons on existing notions.
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
      errors.push(...factErrors(skill));
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

function factErrors(skill: Skill): string[] {
  if (!skill.facts) return [];
  const errors: string[] = [];
  if (!skill.drill) errors.push(`${skill.id} : des faits sans rafale`);
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
    if (!skills.has(lesson.skill)) errors.push(`${lesson.id} : notion inconnue ${lesson.skill}`);
    if (!lesson.id.startsWith(`${lesson.skill}/`)) {
      errors.push(`${lesson.id} n'est pas préfixée par ${lesson.skill}/`);
    }
    if (lesson.steps.length === 0 || lesson.steps.length > MAX_LESSON_STEPS) {
      errors.push(`${lesson.id} : ${lesson.steps.length} étapes (1 à ${MAX_LESSON_STEPS})`);
    }
  }
  return errors;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Content errors of the quests against the registry (empty when valid). */
export function questErrors(quests: readonly Quest[], domains: readonly Domain[]): string[] {
  const errors: string[] = [];
  const skills = skillsById(domains);
  const lessons = new Set(domains.flatMap((domain) => domain.lessons ?? []).map((l) => l.id));
  const ids = new Set<string>();
  for (const quest of quests) {
    if (ids.has(quest.id)) errors.push(`quête ${quest.id} en double`);
    ids.add(quest.id);
    errors.push(...questContentErrors(quest, skills, lessons));
  }
  return errors;
}

function questContentErrors(
  quest: Quest,
  skills: ReadonlyMap<SkillId, Skill>,
  lessons: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const name = `quête ${quest.id}`;
  if (!DAY.test(quest.id) || !DAY.test(quest.until) || quest.until < quest.id) {
    errors.push(`${name} : période invalide`);
  }
  const newSkills = quest.skills.filter((skill) => skill.isNew).length;
  if (newSkills > MAX_NEW_SKILLS_PER_QUEST) errors.push(`${name} : ${newSkills} notions nouvelles`);
  const elements =
    quest.skills.length +
    (quest.lessons?.length ?? 0) +
    (quest.challenges?.length ?? 0) +
    (quest.drill ? 1 : 0);
  if (elements > MAX_QUEST_ELEMENTS) errors.push(`${name} : ${elements} éléments`);
  for (const { id, level } of quest.skills) {
    const skill = skills.get(id);
    if (!skill) errors.push(`${name} : notion inconnue ${id}`);
    else if (level !== undefined && (level < 0 || level >= skill.levels)) {
      errors.push(`${name} : niveau ${level} invalide pour ${id}`);
    }
  }
  if (quest.drill && !skills.get(quest.drill)?.drill) {
    errors.push(`${name} : ${quest.drill} n'est pas une notion de rafale`);
  }
  for (const id of quest.challenges ?? []) {
    if (!skills.get(id)?.challenge) errors.push(`${name} : ${id} n'est pas une notion de défi`);
  }
  for (const id of quest.lessons ?? []) {
    if (!lessons.has(id)) errors.push(`${name} : astuce inconnue ${id}`);
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
