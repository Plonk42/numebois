import type { FactProgress } from '../core/facts';
import type { SkillProgress, Stage } from '../core/mastery';
import type { SessionSnapshot } from '../core/session';
import type { TrailLength } from '../core/trail';
import type { Skill } from '../core/types';

/**
 * Version of the save format. Free to change until the owner declares that the child
 * really plays (doc/GITHUB_WORKFLOW.md, « Compatibilité des sauvegardes »).
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface SaveData extends SessionSnapshot {
  version: typeof SAVE_SCHEMA_VERSION;
  /** ISO date of the last write. */
  savedAt: string;
  energy: number;
  trailLength: TrailLength;
}

export type ParsedSave = { ok: true; data: SaveData } | { ok: false; reason: string };

const STAGES: readonly Stage[] = ['discovery', 'learning', 'acquired', 'maintenance', 'anchored'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;
const isDay = (value: unknown): value is number => Number.isInteger(value);
const isList = <T>(value: unknown, item: (v: unknown) => v is T): value is T[] =>
  Array.isArray(value) && value.every(item);

function isProgress(value: unknown): value is SkillProgress {
  return (
    isObject(value) &&
    typeof value.skill === 'string' &&
    STAGES.includes(value.stage as Stage) &&
    isCount(value.level) &&
    isCount(value.box) &&
    (value.due === null || isDay(value.due)) &&
    isList(
      value.recent,
      (a): a is SkillProgress['recent'][number] =>
        isObject(a) && isCount(a.level) && typeof a.right === 'boolean' && isDay(a.day),
    )
  );
}

function isFact(value: unknown): value is FactProgress {
  return (
    isObject(value) &&
    typeof value.fact === 'string' &&
    isCount(value.tries) &&
    isCount(value.right) &&
    isList(value.fastDays, isDay) &&
    isList(value.times, (t): t is number => typeof t === 'number' && t >= 0)
  );
}

/**
 * Reads a save written by this version. Notions and facts unknown to the registry are
 * ignored; anything else unexpected refuses the whole save, with a reason for the parent.
 */
export function parseSave(json: string, skills: readonly Skill[]): ParsedSave {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'Ce fichier n’est pas une sauvegarde de Numebois.' };
  }
  if (!isObject(value) || typeof value.version !== 'number') {
    return { ok: false, reason: 'Ce fichier n’est pas une sauvegarde de Numebois.' };
  }
  if (value.version > SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: 'Sauvegarde d’une version plus récente du jeu.' };
  }
  if (value.version < SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: 'Sauvegarde d’une ancienne version, plus lisible.' };
  }
  if (
    typeof value.savedAt !== 'string' ||
    !isCount(value.energy) ||
    (value.trailLength !== 'short' && value.trailLength !== 'normal') ||
    !isList(value.progress, isProgress) ||
    !isList(value.facts, isFact) ||
    !isList(value.history, (h): h is boolean => typeof h === 'boolean')
  ) {
    return { ok: false, reason: 'Sauvegarde abîmée : des données manquent.' };
  }
  const levels = new Map(skills.map((skill) => [skill.id, skill.levels]));
  const facts = new Set(skills.flatMap((skill) => skill.facts?.all ?? []));
  return {
    ok: true,
    data: {
      version: SAVE_SCHEMA_VERSION,
      savedAt: value.savedAt,
      energy: value.energy,
      trailLength: value.trailLength,
      progress: value.progress
        .filter((p) => levels.has(p.skill))
        .map((p) => ({ ...p, level: Math.min(p.level, levels.get(p.skill)! - 1) })),
      facts: value.facts.filter((f) => facts.has(f.fact)),
      history: value.history,
    },
  };
}

export function serializeSave(data: Omit<SaveData, 'version' | 'savedAt'>, now: Date): string {
  const save: SaveData = { version: SAVE_SCHEMA_VERSION, savedAt: now.toISOString(), ...data };
  return JSON.stringify(save);
}
