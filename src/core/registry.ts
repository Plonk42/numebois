import type { Domain, Exercise, Skill, SkillId } from './types';

export function defineDomain(domain: Domain): Domain {
  return domain;
}

export function defineSkill<E extends Exercise>(skill: Skill<E>): Skill<E> {
  return skill;
}

/** Every notion of the registry, by identifier. */
export function skillsById(domains: readonly Domain[]): Map<SkillId, Skill> {
  return new Map(domains.flatMap((domain) => domain.skills.map((skill) => [skill.id, skill])));
}

/**
 * Content errors of a registry (empty when valid): unique identifiers prefixed by their
 * domain, existing prerequisites without cycles, at least one level.
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
      skills.set(skill.id, skill);
    }
  }
  for (const skill of skills.values()) {
    for (const id of skill.prerequisites) {
      if (!skills.has(id)) errors.push(`${skill.id} : prérequis inconnu ${id}`);
    }
  }
  return [...errors, ...cycleErrors(skills)];
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
