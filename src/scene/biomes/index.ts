import { BIOME_IDS, type BiomeId } from '../description';
import { CLEARING } from './clearing';
import { MOUNTAIN } from './mountain';
import { ORCHARD } from './orchard';
import { SKY } from './sky';
import type { Biome } from './types';

/** The décors, in the order they come: each one more spectacular than the one before. */
export const BIOMES: Record<BiomeId, Biome> = {
  clearing: CLEARING,
  orchard: ORCHARD,
  sky: SKY,
  mountain: MOUNTAIN,
};

/** Décors offered at most for the next painting. */
export const NEXT_CHOICES = 3;

/**
 * Décors of the next painting (#33): the ones the child painted least, in the order they come,
 * up to `NEXT_CHOICES` to choose from. `painted` lists the décors of the Album.
 */
export function nextBiomes(painted: readonly BiomeId[]): BiomeId[] {
  const count = (biome: BiomeId) => painted.filter((b) => b === biome).length;
  return [...BIOME_IDS].sort((a, b) => count(a) - count(b)).slice(0, NEXT_CHOICES);
}

export type { Biome } from './types';
