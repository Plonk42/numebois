import { describe, expect, it } from 'vitest';
import { createPlaceholderLibrary } from '../../src/scene/assets';
import { FAR_FAMILIES } from '../../src/scene/populate';
import {
  TreeWriter,
  buildTree,
  growthFactor,
  sizeForAge,
  SEASONS,
  type TreeSpec,
} from '../../src/scene/trees/builder';
import { FAMILIES, FAMILY_NAMES } from '../../src/scene/trees/families';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { Rng } from '../../src/core/rng';
import { buildSkeleton } from '../../src/scene/trees/skeleton';
import { createBudgetLibrary, hashFloats } from './helpers';

const placeholders = createPlaceholderLibrary();
const budget = createBudgetLibrary();

function spec(overrides: Partial<TreeSpec> = {}): TreeSpec {
  return {
    family: 'Round',
    seed: 1234,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    scale: 1,
    detail: 'full',
    ...overrides,
  };
}

function build(tree: TreeSpec, season = SEASONS[1], assets = placeholders) {
  const out = new TreeWriter(256, 512);
  const info = buildTree(out, tree, assets, season, 0);
  return { out, info };
}

describe('procedural trees', () => {
  it.each(FAMILY_NAMES)('gives the same %s tree for the same seed', (family) => {
    const a = build(spec({ family }));
    const b = build(spec({ family }));
    expect(b.out.vertexCount).toBe(a.out.vertexCount);
    expect(b.out.indexCount).toBe(a.out.indexCount);
    expect(hashFloats(b.out.positions.subarray(0, b.out.vertexCount * 3))).toBe(
      hashFloats(a.out.positions.subarray(0, a.out.vertexCount * 3)),
    );
    expect(hashFloats(b.out.pivots.subarray(0, b.out.vertexCount * 3))).toBe(
      hashFloats(a.out.pivots.subarray(0, a.out.vertexCount * 3)),
    );
  });

  it('gives different trees for different seeds', () => {
    const a = build(spec({ seed: 1 }));
    const b = build(spec({ seed: 2 }));
    expect(hashFloats(a.out.positions.subarray(0, a.out.vertexCount * 3))).not.toBe(
      hashFloats(b.out.positions.subarray(0, b.out.vertexCount * 3)),
    );
  });

  it('keeps the same shape in every season (only UVs change)', () => {
    const summer = build(spec({ family: 'Cube' }), 'summer');
    const autumn = build(spec({ family: 'Cube' }), 'autumn');
    expect(autumn.out.vertexCount).toBe(summer.out.vertexCount);
    expect(hashFloats(autumn.out.positions.subarray(0, autumn.out.vertexCount * 3))).toBe(
      hashFloats(summer.out.positions.subarray(0, summer.out.vertexCount * 3)),
    );
    expect(hashFloats(autumn.out.uvs.subarray(0, autumn.out.vertexCount * 2))).not.toBe(
      hashFloats(summer.out.uvs.subarray(0, summer.out.vertexCount * 2)),
    );
  });

  it('stays under the triangle budget of a tree, with the real tuft sizes', () => {
    for (const family of FAMILY_NAMES) {
      for (let seed = 1; seed <= 60; seed++) {
        for (const season of SEASONS) {
          const full = build(spec({ family, seed }), season, budget).info.triangles;
          const light = build(spec({ family, seed, detail: 'light' }), season, budget).info
            .triangles;
          const far = build(spec({ family, seed, detail: 'far' }), season, budget).info.triangles;
          expect(full, `${family} ${seed} ${season}`).toBeLessThanOrEqual(5000);
          expect(full, `${family} ${seed} ${season}`).toBeGreaterThan(300);
          expect(light, `${family} ${seed} ${season} light`).toBeLessThanOrEqual(2500);
          expect(light, `${family} ${seed} ${season} light`).toBeLessThanOrEqual(full);
          // Far trees are only cheap for the families the forest plants far away.
          if (family === 'Pine' || FAR_FAMILIES.includes(family)) {
            expect(far, `${family} ${seed} ${season} far`).toBeLessThanOrEqual(700);
          }
          expect(far, `${family} ${seed} ${season} far`).toBeLessThanOrEqual(light);
        }
      }
    }
  });

  it('births every branch between 0 and 1, the farthest tip at 1', () => {
    for (const family of FAMILY_NAMES) {
      const sk = buildSkeleton(new Rng(5), FAMILIES[family]);
      const ages = sk.ages();
      const limbs = ages.filter((_, i) => !sk.root[i]);
      expect(Math.max(...limbs)).toBeCloseTo(1, 6);
      expect(Math.min(...ages)).toBeGreaterThanOrEqual(0);
      sk.parent.forEach((p, i) => {
        if (p >= 0 && !sk.root[i]) expect(ages[i]).toBeGreaterThanOrEqual(ages[p]);
      });
    }
  });

  it('grows monotonically with age', () => {
    expect(growthFactor(0, 0.2, 0.6)).toBe(0);
    expect(growthFactor(0.4, 0.2, 0.6)).toBeCloseTo(0.5, 6);
    expect(growthFactor(1, 0.2, 0.6)).toBe(1);
    expect(sizeForAge(0)).toBe(0);
    expect(sizeForAge(1)).toBe(1);
    let previous = 0;
    for (let age = 0; age <= 1.0001; age += 0.05) {
      expect(sizeForAge(age)).toBeGreaterThanOrEqual(previous);
      previous = sizeForAge(age);
    }
  });

  it('merges a forest in one buffer with a tree index per vertex', () => {
    const trees = FAMILY_NAMES.map((family, i) => spec({ family, seed: 10 + i, x: i * 5 }));
    const { writer, infos } = buildForestBuffers(trees, placeholders, 'summer');
    expect(infos).toHaveLength(trees.length);
    expect(writer.triangles).toBe(infos.reduce((sum, info) => sum + info.triangles, 0));
    const indices = new Set<number>();
    for (let i = 0; i < writer.vertexCount; i++) indices.add(Math.floor(writer.tree[i]));
    expect([...indices].sort((a, b) => a - b)).toEqual(trees.map((_, i) => i));
  });
});
