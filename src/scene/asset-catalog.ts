/**
 * Models taken from the local KayKit packs by `npm run assets`.
 * The game only refers to them through the generated manifest (`assets.gen.ts`).
 */

export type Pack = 'forest' | 'hex';

export type ModelKind =
  'tuft' | 'bush' | 'grass' | 'rock' | 'tile' | 'mountain' | 'lily' | 'waterplant' | 'cloud';

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
  Grass_1_B: forest('Grass_1_B', 'grass'),
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

  // Medieval Hexagon tiles. Water is drawn by the game, hence the waterless variants.
  hex_grass: hex('hex_grass', 'tile'),
  hex_grass_bottom: hex('hex_grass_bottom', 'tile'),
  hex_grass_sloped_high: hex('hex_grass_sloped_high', 'tile'),
  hex_coast_A: hex('hex_coast_A_waterless', 'tile'),
  hex_coast_B: hex('hex_coast_B_waterless', 'tile'),
  hex_coast_C: hex('hex_coast_C_waterless', 'tile'),
  hex_coast_D: hex('hex_coast_D_waterless', 'tile'),
  hex_coast_E: hex('hex_coast_E_waterless', 'tile'),
  hex_river_A: hex('hex_river_A_waterless', 'tile'),
  hex_river_A_curvy: hex('hex_river_A_curvy_waterless', 'tile'),
  hex_river_B: hex('hex_river_B_waterless', 'tile'),
  hex_river_C: hex('hex_river_C_waterless', 'tile'),

  mountain_A_grass: hex('mountain_A_grass', 'mountain'),
  mountain_B_grass: hex('mountain_B_grass', 'mountain'),
  mountain_C_grass: hex('mountain_C_grass', 'mountain'),
  waterlily_A: hex('waterlily_A', 'lily'),
  waterlily_B: hex('waterlily_B', 'lily'),
  waterplant_A: hex('waterplant_A', 'waterplant'),
  cloud_big: hex('cloud_big', 'cloud'),
  cloud_small: hex('cloud_small', 'cloud'),
} as const satisfies Record<string, ModelSource>;

export type ModelName = keyof typeof CATALOG;

export const PACK_ZIPS: Record<Pack, string> = {
  forest: 'KayKit_Forest_Nature_Pack_1.0_FREE.zip',
  hex: 'KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip',
};

export const PACK_TEXTURES: Record<Pack, string> = {
  forest: 'forest_texture.png',
  hex: 'hexagons_medieval.png',
};

/**
 * Hexagon tiles are pointy-top: flat sides at x = ±1, corners at 30° + 60°·c, edges at
 * 60°·e (angles from +x towards +z). Coast tiles follow the land or water state of the six
 * corners: their water corners form one run.
 */
export const COAST_TILES: readonly { model: ModelName; start: number; length: number }[] = [
  { model: 'hex_coast_E', start: 1, length: 1 },
  { model: 'hex_coast_A', start: 0, length: 2 },
  { model: 'hex_coast_B', start: 0, length: 3 },
  { model: 'hex_coast_C', start: 5, length: 4 },
  { model: 'hex_coast_D', start: 4, length: 5 },
];

/** River tiles by the gap between their two open edges (first open edge given). */
export const RIVER_TILES: readonly { model: ModelName; from: number; to: number }[] = [
  { model: 'hex_river_A', from: 3, to: 0 },
  { model: 'hex_river_A_curvy', from: 3, to: 0 },
  { model: 'hex_river_B', from: 3, to: 5 },
  { model: 'hex_river_C', from: 3, to: 4 },
];

/** `hex_grass_sloped_high` is one level high and ramps down towards this edge. */
export const SLOPE_LOW_EDGE = 3;

/** Heights in tile units (the tile top is at 0, its base at -1). */
export const TILE_RIVER_SURFACE = -0.1;
export const TILE_SEA_SURFACE = -0.2;
export const TILE_RIVER_HALF_WIDTH = 0.5;
