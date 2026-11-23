/**
 * Layout of the shared gradient atlas, declared once for the asset pipeline and the game.
 *
 * The KayKit forest atlas is 1024² with 8×4 cells of 128×256 px; each cell is a vertical
 * gradient (light at the top). Only column 0 of rows 0 to 2 is used by KayKit: these cells
 * are never repainted. New colours go to free cells; cells of the Medieval Hexagon atlas are
 * copied pixel for pixel, so both packs share one texture.
 * UVs follow the glTF convention (v = 0 at the top of the image).
 */

export const ATLAS_SIZE = 1024;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export const CELL_U = 1 / ATLAS_COLS;
export const CELL_V = 1 / ATLAS_ROWS;

export const LEAF_ROW = 0;
export const BARK_ROW = 1;
export const STONE_ROW = 2;
export const ACCENT_ROW = 3;

/** Gradient stop: fraction from the top (0) to the bottom (1) of the cell, and colour. */
export type Stop = readonly [number, string];

export type SwatchSource =
  /** Original KayKit forest cell: never repainted (stops only feed the placeholder atlas). */
  | { kind: 'original' }
  /** Painted from the stops. */
  | { kind: 'ramp' }
  /** Copied from this cell of the Medieval Hexagon atlas (stops feed the placeholder atlas). */
  | { kind: 'hex'; col: number; row: number };

export interface SwatchDef {
  row: number;
  col: number;
  source: SwatchSource;
  stops: readonly Stop[];
}

const original = (row: number, col: number, stops: readonly Stop[]): SwatchDef => ({
  row,
  col,
  source: { kind: 'original' },
  stops,
});
const ramp = (row: number, col: number, stops: readonly Stop[]): SwatchDef => ({
  row,
  col,
  source: { kind: 'ramp' },
  stops,
});
const hex = (
  row: number,
  col: number,
  from: readonly [number, number],
  stops: readonly Stop[],
): SwatchDef => ({ row, col, source: { kind: 'hex', col: from[0], row: from[1] }, stops });

export const SWATCHES = {
  // Row 0: foliage. A season only shifts leaf UVs to another column.
  Summer: original(0, 0, [
    [0, '#88c33f'],
    [0.5, '#46973b'],
    [1, '#056b37'],
  ]),
  Spring: ramp(0, 1, [
    [0, '#c9ec6b'],
    [1, '#3f9a3a'],
  ]),
  Blossom: ramp(0, 2, [
    [0, '#ffd9e8'],
    [0.5, '#f590ba'],
    [1, '#bf437a'],
  ]),
  Gold: ramp(0, 3, [
    [0, '#ffe066'],
    [1, '#c97a0e'],
  ]),
  Orange: ramp(0, 4, [
    [0, '#ffad42'],
    [1, '#b63f1a'],
  ]),
  Red: ramp(0, 5, [
    [0, '#ff6f5a'],
    [1, '#7e1a2b'],
  ]),
  // Snow on faces turned to the sky, frosty green underneath.
  Snow: ramp(0, 6, [
    [0, '#ffffff'],
    [0.3, '#eaf3fb'],
    [0.36, '#d4e6f2'],
    [0.4, '#6fa477'],
    [1, '#14503f'],
  ]),
  Brown: ramp(0, 7, [
    [0, '#d9a066'],
    [1, '#6e3b1f'],
  ]),

  // Row 1: bark and ground (plus one cell copied from the Medieval Hexagon atlas).
  Bark: original(1, 0, [
    [0, '#f17c36'],
    [0.5, '#c36532'],
    [1, '#813223'],
  ]),
  Birch: ramp(1, 1, [
    [0, '#fbf8f1'],
    [1, '#bdb6aa'],
  ]),
  DarkBark: ramp(1, 2, [
    [0, '#c08a5c'],
    [0.5, '#7a4a33'],
    [1, '#3a2430'],
  ]),
  Meadow: ramp(1, 3, [
    [0, '#bfe05a'],
    [0.5, '#8cc247'],
    [1, '#4f9a40'],
  ]),
  DryGrass: ramp(1, 4, [
    [0, '#e8d87e'],
    [0.5, '#c9b556'],
    [1, '#8e8a3e'],
  ]),
  Earth: ramp(1, 5, [
    [0, '#d79a64'],
    [0.5, '#a66546'],
    [1, '#5f3a32'],
  ]),
  HexStone: hex(
    1,
    6,
    [2, 2],
    [
      [0, '#aab8be'],
      [0.5, '#828c91'],
      [1, '#596064'],
    ],
  ),

  // Row 2: stone, then cells copied from the Medieval Hexagon atlas.
  Stone: original(2, 0, [
    [0, '#aab8be'],
    [0.5, '#828c91'],
    [1, '#596064'],
  ]),
  HexGrass: hex(
    2,
    1,
    [0, 2],
    [
      [0, '#dfe54e'],
      [0.5, '#abb028'],
      [1, '#777b02'],
    ],
  ),
  HexSand: hex(
    2,
    2,
    [4, 2],
    [
      [0, '#eac99c'],
      [1, '#cb935e'],
    ],
  ),
  // Snow on the ground: white in the sun, blue-grey in the hollows and shade.
  SnowGround: ramp(2, 3, [
    [0, '#ffffff'],
    [0.35, '#eef4fb'],
    [0.7, '#d3e0f1'],
    [1, '#b3c4e0'],
  ]),
  HexCloud: hex(
    2,
    4,
    [1, 0],
    [
      [0, '#fefefe'],
      [1, '#acb9bf'],
    ],
  ),
  HexLily: hex(
    2,
    5,
    [1, 2],
    [
      [0, '#00ae5e'],
      [1, '#005b4a'],
    ],
  ),
  HexWater: hex(
    2,
    6,
    [1, 1],
    [
      [0, '#29abe2'],
      [0.5, '#2580be'],
      [1, '#1b1968'],
    ],
  ),
  HexWaterLight: hex(
    2,
    7,
    [0, 1],
    [
      [0, '#89d4eb'],
      [0.5, '#62a0d0'],
      [1, '#3d6db5'],
    ],
  ),

  // Row 3: accents (petals, mushrooms). A per-instance offset picks the column.
  PetalWhite: ramp(3, 0, [
    [0, '#ffffff'],
    [1, '#d3deef'],
  ]),
  PetalPink: ramp(3, 1, [
    [0, '#ffc4dd'],
    [1, '#e2579b'],
  ]),
  PetalYellow: ramp(3, 2, [
    [0, '#fff3a6'],
    [1, '#f2b21d'],
  ]),
  PetalViolet: ramp(3, 3, [
    [0, '#dcc6ff'],
    [1, '#8a55d6'],
  ]),
  PetalRed: ramp(3, 4, [
    [0, '#ff8d73'],
    [1, '#cf2a2a'],
  ]),
  PetalBlue: ramp(3, 5, [
    [0, '#c2e5ff'],
    [1, '#3f86e0'],
  ]),
  Cream: ramp(3, 6, [
    [0, '#fff7e3'],
    [1, '#d8b98c'],
  ]),
} as const satisfies Record<string, SwatchDef>;

export type SwatchName = keyof typeof SWATCHES;

/** Column of a swatch in its row. */
export function swatchColumn(name: SwatchName): number {
  return SWATCHES[name].col;
}

/** UV of a point at height `frac` (0 = top, light; 1 = bottom, dark) in a swatch. */
export function swatchUV(name: SwatchName, frac = 0.5): [number, number] {
  const s: SwatchDef = SWATCHES[name];
  const f = Math.min(0.96, Math.max(0.04, frac));
  return [(s.col + 0.5) * CELL_U, (s.row + f) * CELL_V];
}

/** Gradient height for a normal: lit from above, like the KayKit models. */
export function shadeOf(normalY: number): number {
  return 0.12 + (1 - (normalY + 1) / 2) * 0.76;
}

/** Target cell in our atlas for a cell of the Medieval Hexagon atlas, if it is imported. */
export function hexCellTarget(col: number, row: number): { col: number; row: number } | null {
  for (const s of Object.values<SwatchDef>(SWATCHES)) {
    if (s.source.kind === 'hex' && s.source.col === col && s.source.row === row) {
      return { col: s.col, row: s.row };
    }
  }
  return null;
}

/**
 * Cells of the Medieval Hexagon atlas used by its buildings, drawn with a part of a swatch of
 * close colours instead of a cell of their own: the atlas has no room left for them.
 */
export const HEX_ALIASES: Record<string, { swatch: SwatchName; from: number; to: number }> = {
  // Stone, light to dark grey: the same ramp as the KayKit stone.
  '2,0': { swatch: 'Stone', from: 0, to: 1 },
  '3,0': { swatch: 'Stone', from: 0.85, to: 1 },
  // Black of the windows.
  '4,0': { swatch: 'DarkBark', from: 0.9, to: 1 },
  '6,1': { swatch: 'Stone', from: 0.15, to: 0.9 },
  // Wood, light and dark.
  '5,0': { swatch: 'Earth', from: 0.15, to: 0.6 },
  '6,0': { swatch: 'Earth', from: 0.35, to: 0.75 },
  // Sand-coloured walls and sacks.
  '5,1': { swatch: 'HexSand', from: 0, to: 1 },
  // Red roofs and sails, golden grain, yellow roofs.
  '1,3': { swatch: 'PetalRed', from: 0.25, to: 1 },
  '3,1': { swatch: 'Gold', from: 0, to: 1 },
  '2,3': { swatch: 'PetalYellow', from: 0.3, to: 1 },
};

function hexToRgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colour of a gradient at fraction f (0 = top). */
export function rampColor(stops: readonly Stop[], f: number): [number, number, number] {
  let prev = stops[0];
  for (const stop of stops) {
    if (f <= stop[0]) {
      const a = hexToRgb(prev[1]);
      const b = hexToRgb(stop[1]);
      const t = stop[0] === prev[0] ? 0 : (f - prev[0]) / (stop[0] - prev[0]);
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ];
    }
    prev = stop;
  }
  return hexToRgb(prev[1]);
}

/** Linear colour (0..1) of a swatch at a height, for effects that must stay in the palette. */
export function swatchColor(name: SwatchName, frac = 0.5): [number, number, number] {
  const c = rampColor(SWATCHES[name].stops, frac);
  return [c[0] / 255, c[1] / 255, c[2] / 255];
}

export interface AtlasSources {
  /** RGBA pixels of the KayKit forest atlas (size × size). */
  forest?: Uint8Array;
  /** RGBA pixels of the Medieval Hexagon atlas (size × size). */
  hex?: Uint8Array;
}

/**
 * Paint the atlas as RGBA pixels. With the pack textures, original cells are kept and
 * hexagon cells are copied exactly; without them, every cell is painted from its stops
 * (placeholder atlas for a clone without the packs).
 */
export function paintAtlas(size: number, sources: AtlasSources = {}): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  if (sources.forest) data.set(sources.forest);
  else data.fill(128);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const cw = size / ATLAS_COLS;
  const ch = size / ATLAS_ROWS;
  for (const s of Object.values<SwatchDef>(SWATCHES)) {
    const x0 = s.col * cw;
    const y0 = s.row * ch;
    if (s.source.kind === 'original' && sources.forest) continue;
    if (s.source.kind === 'hex' && sources.hex) {
      const sx = s.source.col * cw;
      const sy = s.source.row * ch;
      for (let y = 0; y < ch; y++) {
        const from = ((sy + y) * size + sx) * 4;
        data.set(sources.hex.subarray(from, from + cw * 4), ((y0 + y) * size + x0) * 4);
      }
      continue;
    }
    for (let y = 0; y < ch; y++) {
      const [r, g, b] = rampColor(s.stops, y / (ch - 1));
      for (let x = 0; x < cw; x++) {
        const i = ((y0 + y) * size + x0 + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  }
  return data;
}
