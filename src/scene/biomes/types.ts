import type { Vocabulary } from '../../core/types';
import type { BiomeId, PerStage, RareName, Stage } from '../description';
import type { BiomeLook } from '../render/richness';
import type { Terrain } from '../terrain/types';

/**
 * A décor of the paintings: its terrain, its ambience (stage names, life, sound, light), its
 * shop animals (`ANIMAL_OFFERS`), what it brings that no décor before it had, and its words.
 */
export interface Biome extends BiomeLook {
  id: BiomeId;
  /** Name shown to the child. */
  name: string;
  /** The terrain of a stage, with the rare elements bought that change it (beavers). */
  terrain(seed: number, stage: Stage, rares: readonly RareName[]): Terrain;
  /** Effects seen in no earlier décor, in French: the test checks that each one shows. */
  effects: readonly string[];
  stageNames: PerStage<string>;
  vocabulary: Vocabulary;
}
