import { cleanName } from '../core/name';
import type { Play } from '../core/session';
import { SKILL_MODES, type SkillMode, type SkillSetting } from '../core/settings';
import type { Skill } from '../core/types';

/** How quick a right answer must be for a fact to count towards automation (#47). */
export const AUTOMATION_FACTORS = [0.75, 1, 1.5] as const;

/** The drill the parent recommends: a notion with facts, or one of its groups (#47). */
export interface Recommended {
  skill: string;
  group?: string;
}

/** What the parent dashboard keeps in the save, absent from saves written before it. */
export interface ParentPart {
  settings: SkillSetting[];
  automation: number;
  /** The long challenges opened (#132). */
  longChallenges: boolean;
  plays: Play[];
  recommended: Recommended | null;
  /** The child's first name (#138), empty when not given. */
  name: string;
  /** The astuces seen to the end, in the Carnet (#50), in the order they came. */
  notebook: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;
const PLAY_KINDS = new Set<unknown>(['trail', 'drill', 'challenge']);

function isPlay(value: unknown): value is Play {
  return (
    isObject(value) &&
    Number.isInteger(value.day) &&
    PLAY_KINDS.has(value.kind) &&
    isCount(value.questions) &&
    isCount(value.right) &&
    Number(value.right) <= Number(value.questions) &&
    isCount(value.ms)
  );
}

function readSetting(value: unknown, skills: ReadonlyMap<string, Skill>): SkillSetting | null {
  if (!isObject(value) || typeof value.skill !== 'string') return null;
  const skill = skills.get(value.skill);
  if (
    !skill ||
    !SKILL_MODES.includes(value.mode as SkillMode) ||
    !isCount(value.minLevel) ||
    !isCount(value.maxLevel)
  ) {
    return null;
  }
  // A notion with fewer levels than before keeps a range within its own.
  const top = skill.levels - 1;
  const maxLevel = Math.min(value.maxLevel, top);
  return {
    skill: skill.id,
    mode: value.mode as SkillMode,
    minLevel: Math.min(value.minLevel, maxLevel),
    maxLevel,
  };
}

/**
 * The parent part of a save; absent fields take their default, notions unknown to the
 * registry are dropped. Null when something is out of place.
 */
export function readParentPart(
  value: Record<string, unknown>,
  skills: readonly Skill[],
): ParentPart | null {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const {
    settings = [],
    automation = 1,
    longChallenges = false,
    plays = [],
    recommended = null,
    name = '',
    notebook = [],
  } = value;
  if (!Array.isArray(settings) || !Array.isArray(plays) || !plays.every(isPlay)) return null;
  if (typeof name !== 'string') return null;
  if (!Array.isArray(notebook) || !notebook.every((id) => typeof id === 'string')) return null;
  if (!AUTOMATION_FACTORS.includes(automation as (typeof AUTOMATION_FACTORS)[number])) return null;
  if (typeof longChallenges !== 'boolean') return null;
  if (recommended !== null && (!isObject(recommended) || typeof recommended.skill !== 'string')) {
    return null;
  }
  // Notions gone from the registry are forgotten.
  const kept = settings.filter(
    (s) => !isObject(s) || typeof s.skill !== 'string' || byId.has(s.skill),
  );
  const read = kept.map((s) => readSetting(s, byId));
  if (read.includes(null)) return null;
  return {
    settings: read as SkillSetting[],
    automation: automation as number,
    longChallenges,
    plays,
    recommended: readRecommended(recommended, byId),
    name: cleanName(name),
    notebook: notebook as string[],
  };
}

/** A recommendation of a notion or a group gone from the registry is forgotten. */
function readRecommended(value: unknown, skills: ReadonlyMap<string, Skill>): Recommended | null {
  if (!isObject(value) || typeof value.skill !== 'string') return null;
  const { skill, group } = value;
  const facts = skills.get(skill)?.facts;
  if (!facts) return null;
  if (group === undefined) return { skill };
  return facts.groups?.some((g) => g.id === group) ? { skill, group: group as string } : null;
}
