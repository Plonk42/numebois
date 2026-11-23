/**
 * Animals taken from the local Quaternius pack by `npm run assets` (CC0, issue #9).
 * The game only refers to them through the generated manifest (`assets.gen.ts`).
 */

/** Gentle clips only: no attack, death or hit reaction in front of the child. */
export type AnimalClip = 'idle' | 'look' | 'eat' | 'walk';
export const ANIMAL_CLIPS: readonly AnimalClip[] = ['idle', 'look', 'eat', 'walk'];

export interface AnimalSource {
  /** glTF file name in the pack, without extension. */
  file: string;
  /** Clip of the pack behind each of our clips. */
  clips: Record<AnimalClip, string>;
}

const hoofed = { idle: 'Idle', look: 'Idle_Headlow', eat: 'Eating', walk: 'Walk' };
const canine = { idle: 'Idle', look: 'Idle_2_HeadLow', eat: 'Eating', walk: 'Walk' };

export const ANIMAL_CATALOG = {
  Deer: { file: 'Deer', clips: hoofed },
  Stag: { file: 'Stag', clips: hoofed },
  Fox: { file: 'Fox', clips: canine },
  Wolf: { file: 'Wolf', clips: canine },
} as const satisfies Record<string, AnimalSource>;

export type AnimalName = keyof typeof ANIMAL_CATALOG;
export const ANIMAL_NAMES = Object.keys(ANIMAL_CATALOG) as AnimalName[];

/** Start of the zip name of the pack in `assets/` (Google Drive adds a date to it). */
export const ANIMAL_ZIP_PREFIX = 'Ultimate Animated Animals';
