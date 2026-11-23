/** Plume's model, made in Blender by `scripts/plume.py` and optimised by `npm run assets`. */
export const PLUME_FILE = 'assets/plume.glb';

/** Breathing, a blink, a tilt of the head (hint), a hop of joy (right answer). */
export const PLUME_CLIPS = ['Idle', 'Blink', 'Tilt', 'Cheer'] as const;
export type PlumeClip = (typeof PLUME_CLIPS)[number];
