import { describe, expect, it } from 'vitest';
import { CATALOG, type ModelName, type ModelSource } from '../../src/scene/asset-catalog';
import { ASSET_FILE, MODELS, type ModelInfo } from '../../src/scene/assets.gen';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  SWATCHES,
  hexCellTarget,
  paintAtlas,
  swatchUV,
  type SwatchDef,
  type SwatchName,
} from '../../src/scene/atlas';
import { boundsOf, triangleCount } from '../../src/scene/mesh-data';
import { placeholderModel } from '../../src/scene/placeholders';
import { GENERATED_PROPS } from '../../src/scene/props';

const swatches = Object.entries<SwatchDef>(SWATCHES);
/** Cells used by the KayKit forest models: never repainted. */
const ORIGINAL_CELLS = ['0,0', '1,0', '2,0'];

function cell(data: Uint8Array, size: number, col: number, row: number): number[] {
  const cw = size / ATLAS_COLS;
  const ch = size / ATLAS_ROWS;
  const out: number[] = [];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = ((row * ch + y) * size + col * cw + x) * 4;
      out.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
  }
  return out;
}

describe('atlas layout', () => {
  it('gives every swatch its own cell of the grid', () => {
    const seen = new Set<string>();
    for (const [name, s] of swatches) {
      expect(s.col, name).toBeGreaterThanOrEqual(0);
      expect(s.col, name).toBeLessThan(ATLAS_COLS);
      expect(s.row, name).toBeGreaterThanOrEqual(0);
      expect(s.row, name).toBeLessThan(ATLAS_ROWS);
      const key = `${s.row},${s.col}`;
      expect(seen.has(key), `${name} shares cell ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('never paints over the original KayKit cells', () => {
    const originals = swatches.filter(([, s]) => s.source.kind === 'original');
    expect(originals.map(([, s]) => `${s.row},${s.col}`).sort()).toEqual(ORIGINAL_CELLS);
    for (const [name, s] of swatches) {
      if (s.source.kind === 'original') continue;
      expect(ORIGINAL_CELLS, name).not.toContain(`${s.row},${s.col}`);
    }
  });

  it('keeps original cells and copies hexagon cells pixel for pixel', () => {
    const size = 64;
    const noise = (seed: number) => {
      const data = new Uint8Array(size * size * 4);
      for (let i = 0; i < data.length; i++) data[i] = (i * 31 + seed * 17 + (i >> 5) * 7) & 255;
      return data;
    };
    const forest = noise(1);
    const hex = noise(2);
    const atlas = paintAtlas(size, { forest, hex });
    for (const [name, s] of swatches) {
      const painted = cell(atlas, size, s.col, s.row);
      if (s.source.kind === 'original') {
        const source = cell(forest, size, s.col, s.row);
        // Only alpha is forced to opaque.
        expect(
          painted.filter((_, i) => i % 4 !== 3),
          name,
        ).toEqual(source.filter((_, i) => i % 4 !== 3));
      } else if (s.source.kind === 'hex') {
        expect(painted, name).toEqual(cell(hex, size, s.source.col, s.source.row));
      } else {
        // A painted gradient is constant along each row.
        const cw = size / ATLAS_COLS;
        expect(painted.slice(0, 4), name).toEqual(painted.slice((cw - 1) * 4, cw * 4));
      }
    }
  });

  it('paints a placeholder atlas without the pack textures', () => {
    const size = 64;
    const atlas = paintAtlas(size);
    for (const [name, s] of swatches) {
      const painted = cell(atlas, size, s.col, s.row);
      // Light at the top, darker at the bottom, fully opaque.
      const top = painted[0] + painted[1] + painted[2];
      const bottom = painted.at(-4)! + painted.at(-3)! + painted.at(-2)!;
      expect(top, name).toBeGreaterThan(bottom);
      expect(painted[3], name).toBe(255);
    }
  });

  it('maps each imported hexagon cell to one cell', () => {
    const sources = new Set<string>();
    for (const [name, s] of swatches) {
      if (s.source.kind !== 'hex') continue;
      const key = `${s.source.col},${s.source.row}`;
      expect(sources.has(key), `${name} duplicates hexagon cell ${key}`).toBe(false);
      sources.add(key);
      expect(hexCellTarget(s.source.col, s.source.row)).toEqual({ col: s.col, row: s.row });
    }
    expect(hexCellTarget(7, 3)).toBeNull();
  });

  it('gives UVs inside the cell of the swatch', () => {
    for (const [name, s] of swatches) {
      for (const frac of [0, 0.5, 1]) {
        const [u, v] = swatchUV(name as SwatchName, frac);
        expect(Math.floor(u * ATLAS_COLS), name).toBe(s.col);
        expect(Math.floor(v * ATLAS_ROWS), name).toBe(s.row);
      }
    }
  });
});

describe('asset manifest', () => {
  const names = Object.keys(CATALOG) as ModelName[];

  it('lists exactly the models of the catalog', () => {
    expect(Object.keys(MODELS).sort()).toEqual([...names].sort());
    expect(ASSET_FILE).toMatch(/^assets\/.+\.glb$/);
  });

  it('describes every model consistently', () => {
    for (const name of names) {
      const info: ModelInfo = MODELS[name];
      const source: ModelSource = CATALOG[name];
      expect(info.kind, name).toBe(source.kind);
      expect(info.triangles, name).toBeGreaterThan(0);
      expect(Number.isInteger(info.triangles), name).toBe(true);
      for (let a = 0; a < 3; a++) expect(info.max[a], name).toBeGreaterThan(info.min[a]);
      if (source.kind === 'tuft') {
        // Tufts are recentred on their bounding box.
        for (let a = 0; a < 3; a++)
          expect(Math.abs(info.min[a] + info.max[a]), name).toBeLessThan(0.01);
      }
    }
  });

  it('has a placeholder of the same size for every model', () => {
    for (const name of names) {
      const info: ModelInfo = MODELS[name];
      const data = placeholderModel(name);
      expect(triangleCount(data), name).toBeGreaterThan(0);
      const b = boundsOf(data);
      for (let a = 0; a < 3; a++) {
        const size = info.max[a] - info.min[a];
        const got = b.max[a] - b.min[a];
        // Flat models (lilies) and mountains (buried base) may differ in height only.
        if (a === 1 && (info.kind === 'lily' || info.kind === 'mountain' || info.kind === 'grass'))
          continue;
        expect(got, `${name} axis ${a}`).toBeGreaterThan(size * 0.6);
        expect(got, `${name} axis ${a}`).toBeLessThan(size * 1.4 + 0.02);
      }
    }
  });

  it('generates the missing props in a low-poly budget', () => {
    for (const [name, make] of Object.entries(GENERATED_PROPS)) {
      const data = make();
      expect(triangleCount(data), name).toBeGreaterThan(10);
      expect(triangleCount(data), name).toBeLessThan(160);
      const b = boundsOf(data);
      expect(b.min[1], name).toBeGreaterThanOrEqual(-0.01);
      expect(b.max[1], name).toBeLessThan(0.8);
    }
  });
});
