import { describe, expect, it } from 'vitest';
import { hashSeed, Rng, valueNoise2 } from '../../src/core/rng';
import { createPlaceholderLibrary } from '../../src/scene/assets';
import { composeScene, compositionTriangles } from '../../src/scene/compose';
import {
  FORMS,
  LAST_STAGE,
  STAGES,
  parseDescription,
  type SceneDescription,
  type Stage,
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
      new URLSearchParams('form=cube&stage=12&season=monsoon&seed=x'),
    );
    expect(fallback).toEqual({ form: 'clearing', stage: 6, season: 'summer', seed: 7 });
    expect(STAGES).toHaveLength(12);
    expect(LAST_STAGE).toBe(STAGES[STAGES.length - 1]);
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
        const triangles = sceneTriangles({ form, seed, stage: LAST_STAGE, season: 'summer' });
        expect(triangles, `${form} seed ${seed}`).toBeLessThan(TRIANGLE_BUDGET);
      }
    }
  });

  it('gets richer with the stage and lighter with the quality tier', () => {
    for (const form of FORMS) {
      const first = sceneTriangles({ form, seed: 7, stage: 0, season: 'summer' });
      const last = sceneTriangles({ form, seed: 7, stage: LAST_STAGE, season: 'summer' });
      expect(last).toBeGreaterThan(first * 1.2);
      const low = sceneTriangles(
        { form, seed: 7, stage: LAST_STAGE, season: 'summer' },
        QUALITY.low,
      );
      expect(low).toBeLessThan(last);
    }
  });

  it('starts the clearing bare and makes every stage richer, step by step', () => {
    const stages = STAGES.map((stage) =>
      sceneTriangles({ form: 'clearing', seed: 7, stage, season: 'summer' }),
    );
    for (let stage = 1; stage < stages.length; stage++) {
      // Visibly richer, but never a jump: progress comes in many small steps.
      expect(stages[stage], `stage ${stage}`).toBeGreaterThan(stages[stage - 1] * 1.05);
      expect(stages[stage], `stage ${stage}`).toBeLessThan(stages[stage - 1] * 1.35);
    }
    expect(stages[LAST_STAGE]).toBeGreaterThan(stages[0] * 3);
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
  it('plants trees on the ground, away from the water, at every stage', () => {
    for (let seed = 0; seed < 12; seed++) {
      for (const stage of STAGES) {
        const terrain = createClearing(seed, stage);
        const label = `seed ${seed}, stage ${stage}`;
        expect(terrain.treeSpots.filter((s) => s.role === 'demo').length, label).toBeGreaterThan(0);
        expect(terrain.treeSpots.filter((s) => s.role === 'hero').length, label).toBeGreaterThan(0);
        for (const spot of terrain.treeSpots) {
          const surface = terrain.surfaceAt(spot.x, spot.z);
          expect(surface, `${label}: ${spot.role} at ${spot.x},${spot.z}`).not.toBeNull();
          expect(surface!.kind, `${label}: ${spot.role} at ${spot.x},${spot.z}`).not.toBe('water');
        }
        // Every fall starts on the diorama, comes down and lands in water.
        for (const fall of terrain.waterfalls) {
          expect(fall.foot[1], label).toBeLessThan(fall.top[1] - 2);
          if (!fall.splash) continue;
          expect(terrain.surfaceAt(fall.top[0], fall.top[2]), `${label}: lip`).not.toBeNull();
          expect(terrain.surfaceAt(fall.foot[0], fall.foot[2])?.kind, `${label}: foot`).toBe(
            'water',
          );
        }
        expect(terrain.surfaceAt(100, 0)).toBeNull();
      }
    }
  });

  it('makes the relief an axis of progress: larger, higher, with more water', () => {
    const highest = (terrain: ReturnType<typeof createClearing>) => {
      const height = (x: number, z: number) => terrain.surfaceAt(x, z)?.y ?? -Infinity;
      let top = -Infinity;
      let best = [0, 0];
      for (let x = -terrain.extent.x; x <= terrain.extent.x; x += 1) {
        for (let z = -terrain.extent.z; z <= terrain.extent.z; z += 1) {
          const y = height(x, z);
          if (y > top) [top, best] = [y, [x, z]];
        }
      }
      // Climb to the summit itself, which lies between the samples.
      for (let step = 0.5; step > 0.01; step /= 2) {
        for (let moved = true; moved;) {
          moved = false;
          for (const [dx, dz] of [
            [step, 0],
            [-step, 0],
            [0, step],
            [0, -step],
          ]) {
            const y = height(best[0] + dx, best[1] + dz);
            if (y > top) [top, best, moved] = [y, [best[0] + dx, best[1] + dz], true];
          }
        }
      }
      return top;
    };
    const edges = (terrain: ReturnType<typeof createClearing>) =>
      terrain.treeSpots.filter((s) => s.role === 'edge').length;
    for (let seed = 0; seed < 6; seed++) {
      const terrains = STAGES.map((stage) => createClearing(seed, stage));
      const tops = terrains.map(highest);
      // One new thing at a time: a fall, the stream out of the lake (3), a stream with its pool.
      expect(terrains.map((t) => t.waterfalls.length)).toEqual([
        0, 0, 1, 2, 3, 4, 4, 5, 6, 7, 7, 7,
      ]);
      expect(terrains.map((t) => t.ponds.length)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
      for (let stage = 1; stage < terrains.length; stage++) {
        const label = `seed ${seed}, stage ${stage}`;
        expect(terrains[stage].extent.x, label).toBeGreaterThan(terrains[stage - 1].extent.x);
        expect(terrains[stage].cover, label).toBeGreaterThan(terrains[stage - 1].cover);
        expect(tops[stage], label).toBeGreaterThan(tops[stage - 1] - 0.5);
        expect(edges(terrains[stage]), label).toBeGreaterThanOrEqual(edges(terrains[stage - 1]));
      }
      // From the hill on, the relief rises at every stage.
      for (let stage = 3; stage < terrains.length; stage++) {
        expect(tops[stage], `seed ${seed}, stage ${stage}`).toBeGreaterThan(tops[stage - 1] + 1);
      }
      // A mountain in the background, and a forest around the clearing.
      expect(tops[LAST_STAGE], `seed ${seed}`).toBeGreaterThan(20);
      expect(edges(terrains[LAST_STAGE])).toBeGreaterThan(35);
    }
  });

  it('draws a different clearing from each seed', () => {
    const exits = new Set<number>();
    const summits = new Set<number>();
    const pines = new Set<number>();
    for (let seed = 0; seed < 16; seed++) {
      const terrain = createClearing(seed, LAST_STAGE);
      // The stream leaves the diorama at a different place.
      const exit = terrain.waterfalls.find((fall) => !fall.splash)!;
      exits.add(Math.round(exit.top[0] / 3));
      // The summits differ in height.
      const top = Math.max(...terrain.waterfalls.map((fall) => fall.top[1]));
      summits.add(Math.round(top));
      const edges = terrain.treeSpots.filter((s) => s.role === 'edge');
      pines.add(Math.round((edges.filter((s) => s.conifer).length / edges.length) * 5));
    }
    expect(exits.size).toBeGreaterThanOrEqual(6);
    expect(summits.size).toBeGreaterThanOrEqual(4);
    expect(pines.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps a tree in place and in shape from one stage to the next', () => {
    const trees = (stage: Stage) => {
      const description: SceneDescription = { form: 'clearing', seed: 11, stage, season: 'summer' };
      const { planting } = composeScene(
        description,
        placeholders,
        ambienceFor(stage, 'summer'),
        QUALITY.high,
      );
      return new Map(planting.trees.map((t) => [`${t.x},${t.z}`, t]));
    };
    const all = STAGES.map(trees);
    for (let stage = 1; stage < all.length; stage++) {
      const before = all[stage - 1];
      const after = all[stage];
      expect(after.size, `stage ${stage}`).toBeGreaterThanOrEqual(before.size);
      for (const [place, tree] of before) {
        const same = after.get(place);
        expect(same, `stage ${stage}: tree at ${place}`).toBeDefined();
        expect(same).toMatchObject({ family: tree.family, seed: tree.seed, detail: tree.detail });
        expect(same!.age).toBeGreaterThanOrEqual(tree.age);
      }
    }
    expect(all[LAST_STAGE].size).toBeGreaterThan(all[0].size * 5);
  });
});
