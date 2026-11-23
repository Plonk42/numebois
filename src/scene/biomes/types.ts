import type { BiomeId, PerStage, Stage } from '../description';
import type { BiomeLook } from '../render/richness';
import type { Terrain } from '../terrain/types';

/** Words of a décor for the word problems (#19): what lives and what is counted there. */
export interface Vocabulary {
  /** Where the problem takes place, with its article: « dans la clairière ». */
  place: string;
  /** Things to count, in the plural. */
  things: readonly string[];
  /** Containers to fill or share, in the plural. */
  containers: readonly string[];
  /** Animals, in the plural. */
  animals: readonly string[];
}

/**
 * A décor of the paintings: its terrain, its ambience (stage names, life, sound, light), its
 * shop animals (`ANIMAL_OFFERS`), what it brings that no décor before it had, and its words.
 */
export interface Biome extends BiomeLook {
  id: BiomeId;
  /** Name shown to the child. */
  name: string;
  terrain(seed: number, stage: Stage): Terrain;
  /** Effects seen in no earlier décor, in French: the test checks that each one shows. */
  effects: readonly string[];
  stageNames: PerStage<string>;
  vocabulary: Vocabulary;
}
