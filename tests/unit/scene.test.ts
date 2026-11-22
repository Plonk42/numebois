import { describe, expect, it } from 'vitest';
import { hashSeed, Rng, valueNoise2 } from '../../src/core/rng';
import { createPlaceholderLibrary } from '../../src/scene/assets';
import { composeScene, compositionTriangles } from '../../src/scene/compose';
import {
  FORMS,
  STAGES,
  parseDescription,
  type SceneDescription,
} from '../../src/scene/description';
import { MAX_EFFECT_TRIANGLES } from '../../src/scene/painting';
import { QUALITIES, QUALITY, QualityGovernor } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { createClearing } from '../../src/scene/terrain/clearing';
import { BOARD_RADIUS, HexPlan } from '../../src/scene/terrain/hex';
import { SEASONS } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { createBudgetLibrary, hashFloats } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const placeholders = createPlaceholderLibrary();

function sceneTriangles(description: SceneDescription, quality = QUALITY.high): number {
  const ambience = ambienceFor(description.stage, description.season);
  const composition = composeScene(description, budget, ambience, quality);
  const parts = compositionTriangles(composition, budget);
  const forest = buildForestBuffers(composition.planting.trees, budget, description.season);
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    MAX_EFFECT_TRIANGLES
  );
}

describe('seeded random', () => {
  it('is deterministic and uniform enough', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 1000).toBeGreaterThan(0.45);
    expect(sum / 1000).toBeLessThan(0.55);
    expect(new Rng(1).fork('a').next()).not.toBe(new Rng(1).fork('b').next());
    expect(hashSeed(1, 'x')).toBe(hashSeed(1, 'x'));
    expect(new Rng(3).int(2, 4)).toBeGreaterThanOrEqual(2);
    const n = valueNoise2(9, 1.3, 2.7);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
  });
});

describe('scene description', () => {
  it('reads the URL parameters and falls back to defaults', () => {
    const d = parseDescription(new URLSearchParams('form=hex&stage=4&season=winter&seed=12'));
    expect(d).toEqual({ form: 'hex', stage: 4, season: 'winter', seed: 12 });
    const fallback = parseDescription(
      new URLSearchParams('form=cube&stage=9&season=monsoon&seed=x'),
    );
    expect(fallback).toEqual({ form: 'clearing', stage: 2, season: 'summer', seed: 7 });
  });

  it.each(FORMS)('composes the same %s scene twice from the same description', (form) => {
    const description: SceneDescription = { form, seed: 21, stage: 3, season: 'autumn' };
    const ambience = ambienceFor(3, 'autumn');
    const a = composeScene(description, placeholders, ambience, QUALITY.high);
    const b = composeScene(description, placeholders, ambience, QUALITY.high);
    expect(b.ground.vertexCount).toBe(a.ground.vertexCount);
    expect(hashFloats(b.ground.positions.subarray(0, b.ground.vertexCount * 3))).toBe(
      hashFloats(a.ground.positions.subarray(0, a.ground.vertexCount * 3)),
    );
    expect(hashFloats(b.water.positions.subarray(0, b.water.vertexCount * 3))).toBe(
      hashFloats(a.water.positions.subarray(0, a.water.vertexCount * 3)),
    );
    expect(b.planting.trees).toEqual(a.planting.trees);
    expect(b.batch.countTriangles()).toBe(a.batch.countTriangles());
  });
});

describe('triangle budget', () => {
  it('keeps every form, stage and season under the tablet budget', () => {
    for (const form of FORMS) {
      for (const stage of STAGES) {
        for (const season of SEASONS) {
          const triangles = sceneTriangles({ form, seed: 7, stage, season });
          expect(triangles, `${form} ${stage} ${season}`).toBeLessThan(TRIANGLE_BUDGET);
        }
      }
    }
  });

  it('keeps the richest stage under the budget for other seeds', () => {
    for (const form of FORMS) {
      for (let seed = 1; seed <= 12; seed++) {
        const triangles = sceneTriangles({ form, seed, stage: 4, season: 'summer' });
        expect(triangles, `${form} seed ${seed}`).toBeLessThan(TRIANGLE_BUDGET);
      }
    }
  });

  it('gets richer with the stage and lighter with the quality tier', () => {
    for (const form of FORMS) {
      const stage0 = sceneTriangles({ form, seed: 7, stage: 0, season: 'summer' });
      const stage4 = sceneTriangles({ form, seed: 7, stage: 4, season: 'summer' });
      expect(stage4).toBeGreaterThan(stage0 * 1.2);
      const low = sceneTriangles({ form, seed: 7, stage: 4, season: 'summer' }, QUALITY.low);
      expect(low).toBeLessThan(stage4);
    }
  });
});

describe('quality tiers', () => {
  it('declares every effect at every tier and never cuts the growth effects', () => {
    const keys = Object.keys(QUALITY.high).sort();
    for (const quality of QUALITIES) {
      expect(Object.keys(QUALITY[quality]).sort()).toEqual(keys);
      expect(QUALITY[quality].growthFx).toBe(1);
    }
    expect(QUALITY.high.pixelRatio).toBe(2);
    expect(QUALITY.medium.pixelRatio).toBe(1.5);
    expect(QUALITY.low.shadowMapSize).toBe(0);
    expect(QUALITY.low.contactShadows).toBe(true);
  });

  it('steps down when the frame rate stays low, and not on a single long pause', () => {
    const changes: string[] = [];
    const governor = new QualityGovernor('high', (q) => changes.push(q));
    for (let i = 0; i < 200; i++) governor.frame(1 / 60);
    governor.frame(3);
    for (let i = 0; i < 200; i++) governor.frame(1 / 60);
    expect(changes).toEqual([]);
    for (let i = 0; i < 400; i++) governor.frame(1 / 25);
    expect(changes).toEqual(['medium', 'low']);
  });
});

describe('hexagon island plan', () => {
  it('always has a river on tiles, a waterfall pool and a valid coast', () => {
    for (let seed = 0; seed < 300; seed++) {
      const plan = new HexPlan(seed);
      expect(plan.river.length, `seed ${seed}: river`).toBeGreaterThanOrEqual(2);
      expect(plan.pool, `seed ${seed}: pool`).not.toBeNull();
      // The river is a chain of neighbouring tiles, each leaving by the edge the next enters.
      plan.river.forEach((tile, i) => {
        expect(tile.kind, `seed ${seed}`).toBe('river');
        expect(tile.model, `seed ${seed}`).toMatch(/^hex_river_/);
        const next = plan.neighbour(tile, tile.riverOut!);
        if (i + 1 < plan.river.length) {
          expect(next, `seed ${seed}`).toBe(plan.river[i + 1]);
          expect(plan.river[i + 1].riverIn, `seed ${seed}`).toBe((tile.riverOut! + 3) % 6);
        } else {
          expect(next, `seed ${seed}`).toBe(plan.pool);
        }
      });
      for (const tile of plan.tiles.values()) {
        if (tile.ring === BOARD_RADIUS) expect(tile.kind, `seed ${seed}: rim`).toBe('sea');
        if (tile.kind !== 'coast') continue;
        // The water corners of a coast tile form one run, matching its model.
        const water = plan.water(tile);
        let runs = 0;
        for (let c = 0; c < 6; c++) if (water[c] && !water[(c + 5) % 6]) runs++;
        expect(runs, `seed ${seed}: coast runs`).toBe(1);
        expect(tile.model, `seed ${seed}`).toMatch(/^hex_coast_/);
      }
    }
  });

  it('gives the same plan for the same seed', () => {
    const summary = (plan: HexPlan) =>
      [...plan.tiles.values()]
        .map((t) => `${t.q},${t.r}:${t.kind}:${t.level}:${t.model}:${t.steps}`)
        .join('|');
    expect(summary(new HexPlan(5))).toBe(summary(new HexPlan(5)));
    expect(summary(new HexPlan(5))).not.toBe(summary(new HexPlan(6)));
  });
});

describe('clearing terrain', () => {
  it('plants trees on the ground, away from the water, and has two waterfalls', () => {
    for (let seed = 0; seed < 40; seed++) {
      const terrain = createClearing(seed);
      expect(terrain.waterfalls, `seed ${seed}`).toHaveLength(2);
      expect(
        terrain.treeSpots.filter((s) => s.role === 'edge').length,
        `seed ${seed}`,
      ).toBeGreaterThan(18);
      expect(terrain.treeSpots.filter((s) => s.role === 'demo').length).toBeGreaterThan(0);
      for (const spot of terrain.treeSpots) {
        const surface = terrain.surfaceAt(spot.x, spot.z);
        expect(surface, `seed ${seed}: ${spot.role} at ${spot.x},${spot.z}`).not.toBeNull();
        expect(surface!.kind, `seed ${seed}: ${spot.role} at ${spot.x},${spot.z}`).not.toBe(
          'water',
        );
      }
      expect(terrain.surfaceAt(100, 0)).toBeNull();
    }
  });
});
