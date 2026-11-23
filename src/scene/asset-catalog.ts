/**
 * Models taken from the local packs by `npm run assets`: KayKit, and a few Quaternius models
 * (CC0, plain colours mapped onto the KayKit atlas by the pipeline).
 * The game only refers to them through the generated manifest (`assets.gen.ts`).
 */

export type Pack = 'forest' | 'hex' | 'nature';

export type ModelKind =
  | 'tuft'
  | 'bush'
  | 'grass'
  | 'rock'
  | 'mountain'
  | 'lily'
  | 'waterplant'
  | 'cloud'
  | 'log'
  | 'stump';

export interface ModelSource {
  pack: Pack;
  /** glTF file name in the pack, without extension. */
  file: string;
  kind: ModelKind;
  /** Leaf tuft cut out of a tree: index among its leaf pieces, largest first. */
  leafPart?: number;
}

const forest = (file: string, kind: ModelKind): ModelSource => ({
  pack: 'forest',
  file: `${file}_Color1`,
  kind,
});
const tuft = (tree: string, leafPart: number): ModelSource => ({
  pack: 'forest',
  file: `${tree}_Color1`,
  kind: 'tuft',
  leafPart,
});
const hex = (file: string, kind: ModelKind): ModelSource => ({ pack: 'hex', file, kind });
const nature = (file: string, kind: ModelKind): ModelSource => ({ pack: 'nature', file, kind });

export const CATALOG = {
  // Leaf tufts cut out of the KayKit trees, recentred on their bounding box.
  Tuft_Round: tuft('Tree_1_A', 0),
  Tuft_RoundSmall: tuft('Tree_1_A', 1),
  Tuft_Cube: tuft('Tree_2_A', 0),
  Tuft_CubeSmall: tuft('Tree_2_A', 1),
  Tuft_Disc: tuft('Tree_3_A', 0),
  Tuft_DiscSmall: tuft('Tree_3_A', 1),
  Tuft_PineTop: tuft('Tree_4_A', 0),
  Tuft_PineLayer: tuft('Tree_4_A', 1),

  Bush_1_B: forest('Bush_1_B', 'bush'),
  Bush_1_E: forest('Bush_1_E', 'bush'),
  Bush_2_D: forest('Bush_2_D', 'bush'),
  Bush_3_B: forest('Bush_3_B', 'bush'),
  Bush_4_D: forest('Bush_4_D', 'bush'),

  Grass_1_A: forest('Grass_1_A', 'grass'),
  Grass_2_A: forest('Grass_2_A', 'grass'),
  Grass_2_B: forest('Grass_2_B', 'grass'),

  // Small rocks, instanced along banks and in the meadow.
  Rock_1_A: forest('Rock_1_A', 'rock'),
  Rock_2_C: forest('Rock_2_C', 'rock'),
  Rock_3_E: forest('Rock_3_E', 'rock'),
  // Large rocks, merged into the static scenery (cliff, waterfall).
  Rock_1_G: forest('Rock_1_G', 'rock'),
  Rock_1_J: forest('Rock_1_J', 'rock'),
  Rock_1_K: forest('Rock_1_K', 'rock'),
  Rock_1_M: forest('Rock_1_M', 'rock'),
  Rock_1_N: forest('Rock_1_N', 'rock'),
  Rock_2_E: forest('Rock_2_E', 'rock'),
  Rock_2_G: forest('Rock_2_G', 'rock'),
  Rock_3_K: forest('Rock_3_K', 'rock'),
  Rock_3_M: forest('Rock_3_M', 'rock'),

  // Medieval Hexagon models. Mountains are kept for a large background mountain (#7).
  mountain_A_grass: hex('mountain_A_grass', 'mountain'),
  mountain_B_grass: hex('mountain_B_grass', 'mountain'),
  mountain_C_grass: hex('mountain_C_grass', 'mountain'),
  waterlily_A: hex('waterlily_A', 'lily'),
  waterlily_B: hex('waterlily_B', 'lily'),
  waterplant_A: hex('waterplant_A', 'waterplant'),
  cloud_big: hex('cloud_big', 'cloud'),
  cloud_small: hex('cloud_small', 'cloud'),

  // Quaternius Ultimate Nature: fallen logs and stumps, mossy, or snowy in winter.
  Log: nature('WoodLog', 'log'),
  Log_Moss: nature('WoodLog_Moss', 'log'),
  Log_Snow: nature('WoodLog_Snow', 'log'),
  Stump: nature('TreeStump', 'stump'),
  Stump_Moss: nature('TreeStump_Moss', 'stump'),
  Stump_Snow: nature('TreeStump_Snow', 'stump'),
} as const satisfies Record<string, ModelSource>;

export type ModelName = keyof typeof CATALOG;

/** Zip of each pack in `assets/`, by the start of its name (downloads add a suffix). */
export const PACK_ZIPS: Record<Pack, string> = {
  forest: 'KayKit_Forest_Nature_Pack_1.0_FREE.zip',
  hex: 'KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip',
  nature: 'Ultimate Nature Pack - Jun 2019',
};

export const PACK_TEXTURES: Record<'forest' | 'hex', string> = {
  forest: 'forest_texture.png',
  hex: 'hexagons_medieval.png',
};
