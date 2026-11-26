/**
 * Animals taken from the local Quaternius pack by `npm run assets` (CC0, issue #9).
 * The game only refers to them through the generated manifest (`assets.gen.ts`).
 */

/** Gentle clips only: no attack, death or hit reaction in front of the child. */
export type AnimalClip = 'idle' | 'look' | 'eat' | 'walk' | 'jump' | 'gallop';
export const ANIMAL_CLIPS: readonly AnimalClip[] = [
  'idle',
  'look',
  'eat',
  'walk',
  'jump',
  'gallop',
];

export interface AnimalSource {
  /** glTF file name in the pack, without extension. */
  file: string;
  /**
   * Made in Blender, the pack has no mountain animal: from a pack animal by
   * `scripts/mountain_animals.py`, the eagle by `scripts/eagle.py`. Read from
   * `assets-private/animals/export/<file>.glb`.
   */
  made?: true;
  /** Clip of the pack behind each of our clips. */
  clips: Record<AnimalClip, string>;
}

// The jump and the gallop answer a touch of the child (#28).
const hoofed = {
  idle: 'Idle',
  look: 'Idle_Headlow',
  eat: 'Eating',
  walk: 'Walk',
  jump: 'Jump_toIdle',
  gallop: 'Gallop',
};
const canine = {
  idle: 'Idle',
  look: 'Idle_2_HeadLow',
  eat: 'Eating',
  walk: 'Walk',
  jump: 'Jump_ToIdle',
  gallop: 'Gallop',
};
// A bird: perched (preening to eat), flapping to walk, landing or taking off to jump, gliding
// to gallop.
const bird = {
  idle: 'Perch',
  look: 'Look',
  eat: 'Preen',
  walk: 'Flap',
  jump: 'Land',
  gallop: 'Glide',
};

export const ANIMAL_CATALOG = {
  Deer: { file: 'Deer', clips: hoofed },
  Stag: { file: 'Stag', clips: hoofed },
  Fox: { file: 'Fox', clips: canine },
  Wolf: { file: 'Wolf', clips: canine },
  // The orchard's animals (#31).
  Donkey: { file: 'Donkey', clips: hoofed },
  Alpaca: { file: 'Alpaca', clips: hoofed },
  Horse: { file: 'Horse_White', clips: hoofed },
  Cow: { file: 'Cow', clips: hoofed },
  // The mountain's animals (#136).
  Chamois: { file: 'Chamois', clips: hoofed, made: true },
  Ibex: { file: 'Ibex', clips: hoofed, made: true },
  Marmot: { file: 'Marmot', clips: canine, made: true },
  // Never sold: it comes with the eagles, a rare element.
  Eagle: { file: 'Eagle', clips: bird, made: true },
} as const satisfies Record<string, AnimalSource>;

export type AnimalName = keyof typeof ANIMAL_CATALOG;
export const ANIMAL_NAMES = Object.keys(ANIMAL_CATALOG) as AnimalName[];

/** Start of the zip name of the pack in `assets/` (Google Drive adds a date to it). */
export const ANIMAL_ZIP_PREFIX = 'Ultimate Animated Animals';
