import type { Skill, SkillId } from './types';

/**
 * How the trail treats a notion, set by the parent (#47): it decides (auto), never offers it
 * (closed), offers it at once without its prerequisites (open), or gives it at least half of
 * the trail (focus).
 */
export type SkillMode = 'auto' | 'closed' | 'open' | 'focus';
export const SKILL_MODES: readonly SkillMode[] = ['auto', 'closed', 'open', 'focus'];

/** Notions in focus at the same time, at most. */
export const MAX_FOCUS = 2;

/** The parent's setting of a notion: its mode and the levels asked, to match the class. */
export interface SkillSetting {
  skill: SkillId;
  mode: SkillMode;
  /** Lowest and highest internal levels asked, within `0` and `levels - 1`. */
  minLevel: number;
  maxLevel: number;
}

export type Settings = ReadonlyMap<SkillId, SkillSetting>;

export function defaultSetting(skill: Skill): SkillSetting {
  return { skill: skill.id, mode: 'auto', minLevel: 0, maxLevel: skill.levels - 1 };
}

export function settingOf(settings: Settings, skill: Skill): SkillSetting {
  return settings.get(skill.id) ?? defaultSetting(skill);
}

export function modeOf(settings: Settings, skill: Skill): SkillMode {
  return settings.get(skill.id)?.mode ?? 'auto';
}

/** A level kept within the range the parent chose for the notion. */
export function clampLevel(level: number, setting: SkillSetting): number {
  return Math.min(Math.max(level, setting.minLevel), setting.maxLevel);
}

/**
 * The settings with one notion changed. A third notion in focus takes the place of the oldest
 * one, which goes back to auto; the range stays ordered and within the notion's levels.
 */
export function changeSetting(
  settings: Settings,
  skill: Skill,
  change: Partial<Omit<SkillSetting, 'skill'>>,
): Map<SkillId, SkillSetting> {
  const before = settingOf(settings, skill);
  const top = skill.levels - 1;
  const minLevel = Math.min(Math.max(change.minLevel ?? before.minLevel, 0), top);
  const maxLevel = Math.min(Math.max(change.maxLevel ?? before.maxLevel, 0), top);
  const next: SkillSetting = {
    skill: skill.id,
    mode: change.mode ?? before.mode,
    // The bound that moved pushes the other one.
    minLevel: change.maxLevel !== undefined ? Math.min(minLevel, maxLevel) : minLevel,
    maxLevel: change.maxLevel !== undefined ? maxLevel : Math.max(minLevel, maxLevel),
  };
  const result = new Map(settings);
  result.delete(skill.id);
  if (next.mode === 'focus') {
    const focus = [...result.values()].filter((s) => s.mode === 'focus');
    for (const old of focus.slice(0, Math.max(0, focus.length - MAX_FOCUS + 1))) {
      result.set(old.skill, { ...old, mode: 'auto' });
    }
  }
  const isDefault = next.mode === 'auto' && next.minLevel === 0 && next.maxLevel === top;
  if (!isDefault) result.set(skill.id, next);
  return result;
}
