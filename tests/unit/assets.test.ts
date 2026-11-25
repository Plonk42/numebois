import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ANIMAL_CLIPS, ANIMAL_NAMES } from '../../src/scene/animal-catalog';
import { createPlaceholderAnimals } from '../../src/scene/animals';
import { ANIMAL_FILE, ANIMALS } from '../../src/scene/animals.gen';
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
import { CHARACTER_CLIPS, CHARACTERS } from '../../src/scene/characters';
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

  it('matches the committed GLB (run `npm run assets` after a catalog change)', () => {
    const glb = readFileSync(`public/${ASSET_FILE}`);
    expect(glb.toString('latin1', 0, 4)).toBe('glTF');
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as {
      nodes: { name: string; mesh: number }[];
      meshes: { primitives: { indices: number }[] }[];
      accessors: { count: number }[];
    };
    const triangles = Object.fromEntries(
      json.nodes.map((node) => [
        node.name,
        json.meshes[node.mesh].primitives.reduce(
          (sum, p) => sum + json.accessors[p.indices].count / 3,
          0,
        ),
      ]),
    );
    expect(triangles).toEqual(
      Object.fromEntries(names.map((name) => [name, MODELS[name].triangles])),
    );
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

describe('animal manifest', () => {
  it('matches the committed GLB: one skinned mesh and the gentle clips per animal', () => {
    expect(Object.keys(ANIMALS).sort()).toEqual([...ANIMAL_NAMES].sort());
    const glb = readFileSync(`public/${ANIMAL_FILE}`);
    expect(glb.toString('latin1', 0, 4)).toBe('glTF');
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as {
      scenes: { name: string }[];
      nodes: { name: string; mesh?: number; skin?: number }[];
      meshes: { primitives: { indices: number; material: number }[] }[];
      materials: unknown[];
      animations: { name: string }[];
      accessors: { count: number }[];
    };
    expect(json.scenes.map((s) => s.name)).toEqual(ANIMAL_NAMES);
    expect(json.animations.map((a) => a.name).sort()).toEqual(
      ANIMAL_NAMES.flatMap((name) => ANIMAL_CLIPS.map((clip) => `${name}:${clip}`)).sort(),
    );
    for (const name of ANIMAL_NAMES) {
      const node = json.nodes.find((n) => n.name === `${name}_body`)!;
      expect(node.skin, name).toBeDefined();
      const primitives = json.meshes[node.mesh!].primitives;
      // One draw call: colours are in the vertices.
      expect(primitives, name).toHaveLength(1);
      expect(json.accessors[primitives[0].indices].count / 3, name).toBe(ANIMALS[name].triangles);
      for (const clip of ANIMAL_CLIPS) expect(ANIMALS[name].clips[clip], name).toBeGreaterThan(0);
    }
    expect(json.nodes.filter((n) => n.mesh !== undefined)).toHaveLength(ANIMAL_NAMES.length);
  });

  it('has a placeholder of the same size for every animal', () => {
    const library = createPlaceholderAnimals();
    for (const name of ANIMAL_NAMES) {
      const body = library.create(name);
      const box = new THREE.Box3().setFromObject(body.object);
      const { min, max } = ANIMALS[name];
      for (const a of [0, 1, 2] as const) {
        const size = max[a] - min[a];
        const got = box.max.getComponent(a) - box.min.getComponent(a);
        expect(got, `${name} axis ${a}`).toBeGreaterThan(size * 0.6);
        expect(got, `${name} axis ${a}`).toBeLessThan(size * 1.4);
      }
      body.dispose();
    }
    library.dispose();
  });
});

describe('characters', () => {
  // Triangles: the squirrel's bushy tail costs a thousand more than Plume.
  const TRIANGLES = { plume: 3000, squirrel: 4000 };
  it.each(CHARACTERS)(
    '$name is one skinned mesh with the four clips, light enough to stay next to the question',
    ({ name, file }) => {
      const glb = readFileSync(`public/${file}`);
      expect(glb.toString('latin1', 0, 4)).toBe('glTF');
      const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as {
        nodes: { mesh?: number; skin?: number }[];
        meshes: { primitives: { indices: number }[] }[];
        materials: unknown[];
        animations: { name: string }[];
        accessors: { count: number }[];
      };
      expect(json.animations.map((a) => a.name).sort()).toEqual([...CHARACTER_CLIPS].sort());
      const bodies = json.nodes.filter((n) => n.mesh !== undefined);
      expect(bodies).toHaveLength(1);
      expect(bodies[0].skin).toBeDefined();
      const primitives = json.meshes[bodies[0].mesh!].primitives;
      expect(primitives).toHaveLength(1);
      expect(json.materials).toHaveLength(1);
      expect(json.accessors[primitives[0].indices].count / 3).toBeLessThan(TRIANGLES[name]);
      expect(glb.byteLength).toBeLessThan(64 * 1024);
    },
  );
});
