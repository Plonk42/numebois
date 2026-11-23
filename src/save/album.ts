import type { FactId, Skill, SkillId } from '../core/types';
import { isComplete, readDescription, type SceneDescription } from '../scene/description';
import { isJournal, parseSave, SAVE_SCHEMA_VERSION, type PaintingJournal } from './save';

/** A painting of the Album (#34): complete, framed, kept with what was learnt meanwhile. */
export interface AlbumEntry extends PaintingJournal {
  description: SceneDescription;
  /** Local day number of the grand finale. */
  finished: number;
  /** The painting at its framing, as a WebP data URL. */
  picture: string;
}

const PICTURE = /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/;

/**
 * Reads the paintings of an Album (kept apart from the save, or in an exported file); null when
 * anything is out of place: a painting that does not read or is not complete, a broken picture.
 */
export function readEntries(value: unknown): AlbumEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: AlbumEntry[] = [];
  for (const item of value as unknown[]) {
    if (!isJournal(item)) return null;
    const entry = item as unknown as Record<string, unknown>;
    const description = readDescription(entry.description);
    if (
      !description ||
      !isComplete(description) ||
      !Number.isInteger(entry.finished) ||
      typeof entry.picture !== 'string' ||
      !PICTURE.test(entry.picture)
    ) {
      return null;
    }
    entries.push({
      description,
      started: item.started,
      finished: entry.finished as number,
      acquired: [...item.acquired] as SkillId[],
      automated: [...item.automated] as FactId[],
      picture: entry.picture,
    });
  }
  return entries;
}

/** The Album as kept in IndexedDB, with the version of the save. */
export function serializeAlbum(entries: readonly AlbumEntry[]): string {
  return JSON.stringify({ version: SAVE_SCHEMA_VERSION, entries });
}

export type ParsedAlbum = { ok: true; entries: AlbumEntry[] } | { ok: false; reason: string };

export function parseAlbum(json: string): ParsedAlbum {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'L’Album n’a pas pu être lu.' };
  }
  const { version, entries } = (value ?? {}) as { version?: unknown; entries?: unknown };
  if (version !== SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: 'Album d’une autre version du jeu.' };
  }
  const read = readEntries(entries);
  return read ? { ok: true, entries: read } : { ok: false, reason: 'Album abîmé.' };
}

/** Is this painting the last one framed in the Album? (the grand finale may stop halfway) */
export function isFramed(entries: readonly AlbumEntry[], description: SceneDescription): boolean {
  const last = entries.at(-1);
  const same = (d: SceneDescription) => JSON.stringify(readDescription(d));
  return last !== undefined && same(last.description) === same(description);
}

/** The exported file: the save, with the Album in it. */
export function exportFile(save: string, entries: readonly AlbumEntry[]): string {
  return JSON.stringify({ ...(JSON.parse(save) as object), album: entries });
}

/**
 * Reads an exported file: the save and the Album, each as kept in IndexedDB, or why the file
 * is refused.
 */
export function importFile(
  text: string,
  skills: readonly Skill[],
): { ok: true; save: string; album: string } | { ok: false; reason: string } {
  const parsed = parseSave(text, skills);
  if (!parsed.ok) return parsed;
  const { album, ...save } = JSON.parse(text) as { album?: unknown };
  const entries = readEntries(album);
  if (!entries) return { ok: false, reason: 'Album abîmé.' };
  return { ok: true, save: JSON.stringify(save), album: serializeAlbum(entries) };
}
