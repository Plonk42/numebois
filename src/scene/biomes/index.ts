import type { BiomeId } from '../description';
import { CLEARING } from './clearing';
import { ORCHARD } from './orchard';
import type { Biome } from './types';

/** The décors, in the order they come: each one more spectacular than the one before. */
export const BIOMES: Record<BiomeId, Biome> = {
  clearing: CLEARING,
  orchard: ORCHARD,
};

export type { Biome, Vocabulary } from './types';
