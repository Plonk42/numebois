/** A character of the interface, made in Blender by `scripts/<name>.py`, optimised by `npm run assets`. */
export interface Character {
  /** Its class in the interface and its folder in `assets-private/`. */
  readonly name: 'plume' | 'squirrel';
  readonly file: string;
  /** Size on the screen: CSS pixels per model unit. */
  readonly pxPerUnit: number;
}

/** Plume the owl, by the slate and on the cards of the trail and of the drill. */
export const PLUME: Character = { name: 'plume', file: 'assets/plume.glb', pxPerUnit: 110 };

/** The squirrel of the challenges: his tail and his ears make him taller than Plume. */
export const SQUIRREL: Character = { name: 'squirrel', file: 'assets/squirrel.glb', pxPerUnit: 92 };

export const CHARACTERS = [PLUME, SQUIRREL] as const;

/** Breathing, a blink, a tilt of the head (hint, offer), a hop of joy (right answer). */
export const CHARACTER_CLIPS = ['Idle', 'Blink', 'Tilt', 'Cheer'] as const;
export type CharacterClip = (typeof CHARACTER_CLIPS)[number];
