import type { Quest } from '../../core/types';
import { BIOME_IDS, type BiomeId } from '../description';
import { CLEARING } from './clearing';
import { ORCHARD } from './orchard';
import { SKY } from './sky';
import type { Biome } from './types';

/** The décors, in the order they come: each one more spectacular than the one before. */
export const BIOMES: Record<BiomeId, Biome> = {
  clearing: CLEARING,
  orchard: ORCHARD,
  sky: SKY,
};

/** Décors offered at most for the next painting. */
export const NEXT_CHOICES = 3;

/**
 * Décors of the next painting (#33): the one of the quest of the week (`YYYY-MM-DD` dates,
 * `date` included) if it imposes one, otherwise the ones the child painted least, in the order
 * they come, up to `NEXT_CHOICES` to choose from. `painted` lists the décors of the Album.
 */
export function nextBiomes(
  quests: readonly Quest[],
  date: string,
  painted: readonly BiomeId[],
): BiomeId[] {
  const quest = quests.find(
    (q) => q.id <= date && date <= q.until && BIOME_IDS.includes(q.biome as BiomeId),
  );
  if (quest) return [quest.biome as BiomeId];
  const count = (biome: BiomeId) => painted.filter((b) => b === biome).length;
  return [...BIOME_IDS].sort((a, b) => count(a) - count(b)).slice(0, NEXT_CHOICES);
}

export type { Biome } from './types';
