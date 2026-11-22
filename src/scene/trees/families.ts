import type { ModelName } from '../asset-catalog';
import type { SwatchName } from '../atlas';

export type FamilyName = 'Round' | 'Cube' | 'Gnarly' | 'Umbrella' | 'Birch' | 'Pine';

export interface Family {
  shape: 'broadleaf' | 'conifer';
  /** Tuft at the branch tips, and a smaller one beside it. */
  blob: ModelName;
  sub: ModelName;
  /** Width of a tip tuft. */
  clump: number;
  /** Vertical squash of the tufts. */
  squash: number;
  /** Tuft on the top of the trunk, as a factor of `clump` (0: none). */
  crown: number;
  height: number;
  radius: number;
  limbs: readonly [number, number];
  /** Tilt of the limbs from the vertical, in degrees. */
  limbAngle: number;
  limbLength: number;
  /** Levels of forks on a limb. */
  depth: number;
  wobble: number;
  bark: SwatchName;
}

/** Families of the Blender prototype (`kaykit_tree.py`), plus a birch and a conifer. */
export const FAMILIES: Record<FamilyName, Family> = {
  Round: {
    shape: 'broadleaf',
    blob: 'Tuft_Round',
    sub: 'Tuft_RoundSmall',
    clump: 1.9,
    squash: 0.9,
    crown: 1.05,
    height: 2.4,
    radius: 0.22,
    limbs: [2, 3],
    limbAngle: 40,
    limbLength: 1.5,
    depth: 2,
    wobble: 0.25,
    bark: 'Bark',
  },
  Cube: {
    shape: 'broadleaf',
    blob: 'Tuft_Cube',
    sub: 'Tuft_CubeSmall',
    clump: 1.6,
    squash: 0.9,
    crown: 1.0,
    height: 3.0,
    radius: 0.2,
    limbs: [2, 3],
    limbAngle: 32,
    limbLength: 1.4,
    depth: 2,
    wobble: 0.2,
    bark: 'Bark',
  },
  Gnarly: {
    shape: 'broadleaf',
    blob: 'Tuft_RoundSmall',
    sub: 'Tuft_RoundSmall',
    clump: 1.25,
    squash: 0.9,
    crown: 1.3,
    height: 2.0,
    radius: 0.3,
    // Three limbs only: with three levels of forks, a fourth would pass the triangle budget.
    limbs: [3, 3],
    limbAngle: 62,
    limbLength: 1.7,
    depth: 3,
    wobble: 0.45,
    bark: 'DarkBark',
  },
  Umbrella: {
    shape: 'broadleaf',
    blob: 'Tuft_DiscSmall',
    sub: 'Tuft_DiscSmall',
    clump: 2.0,
    squash: 1,
    crown: 1.15,
    height: 2.6,
    radius: 0.2,
    limbs: [3, 4],
    limbAngle: 55,
    limbLength: 1.5,
    depth: 1,
    wobble: 0.2,
    bark: 'Bark',
  },
  Birch: {
    shape: 'broadleaf',
    blob: 'Tuft_RoundSmall',
    sub: 'Tuft_RoundSmall',
    clump: 1.5,
    squash: 1.05,
    crown: 1.0,
    height: 3.3,
    radius: 0.15,
    limbs: [2, 3],
    limbAngle: 26,
    limbLength: 1.25,
    depth: 2,
    wobble: 0.18,
    bark: 'Birch',
  },
  Pine: {
    shape: 'conifer',
    blob: 'Tuft_PineLayer',
    sub: 'Tuft_PineTop',
    clump: 2.7,
    squash: 0.8,
    crown: 0,
    height: 4.4,
    radius: 0.2,
    limbs: [0, 0],
    limbAngle: 0,
    limbLength: 0,
    depth: 0,
    wobble: 0.05,
    bark: 'DarkBark',
  },
};

export const FAMILY_NAMES = Object.keys(FAMILIES) as FamilyName[];
