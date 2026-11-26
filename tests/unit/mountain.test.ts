import { describe, expect, it } from 'vitest';
import { swatchUV } from '../../src/scene/atlas';
import { BIOMES } from '../../src/scene/biomes';
import { composeScene, compositionTriangles } from '../../src/scene/compose';
import {
  DEMO_FILL,
  LAST_STAGE,
  MAX_ELEMENTS,
  STAGES,
  demoAnimals,
  demoElements,
  demoRares,
  readDescription,
  stageFor,
  type SceneDescription,
  type Stage,
} from '../../src/scene/description';
import { triangleCount } from '../../src/scene/mesh-data';
import { MAX_EFFECT_TRIANGLES } from '../../src/scene/painting';
import { GENERATED_DRIFTERS } from '../../src/scene/props';
import {
  animalState,
  herdTriangles,
  planHerd,
  type AnimalState,
} from '../../src/scene/render/ambient-life';
import { BACKDROP_TRIANGLES } from '../../src/scene/render/backdrop';
import { QUALITY } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { cabin, cabinAt, cablewayMesh, HANG } from '../../src/scene/cableway';
import {
  cablewayOf,
  createMountain,
  hidesWater,
  layoutOf,
  slotsOf,
} from '../../src/scene/terrain/mountain';
import type { Terrain } from '../../src/scene/terrain/types';
import { SEASONS, type Season } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { createBudgetLibrary } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const MOUNTAIN = BIOMES.mountain;

function scene(
  seed: number,
  stage: Stage,
  season: Season,
  { fill = DEMO_FILL[stage], ...more }: Partial<SceneDescription> & { fill?: number } = {},
): SceneDescription {
  return {
    biome: 'mountain',
    seed,
    stage,
    season,
    seasons: [season],
    night: 'none',
    elements: demoElements(seed, fill),
    animals: demoAnimals('mountain', stage),
    rares: demoRares('mountain', stage),
    ...more,
  };
}

const compose = (description: SceneDescription, quality = QUALITY.high) =>
  composeScene(
    description,
    budget,
    ambienceFor(description.stage, description.season, MOUNTAIN),
    quality,
  );

function sceneTriangles(description: SceneDescription): number {
  const composition = compose(description);
  const parts = compositionTriangles(composition, budget);
  const forest = buildForestBuffers(composition.planting.trees, budget, description.season);
  const herd = planHerd(composition.terrain, description.animals, description.seed);
  const drifters = composition.terrain.drifters.reduce(
    (sum, d) => sum + triangleCount(GENERATED_DRIFTERS[d.model]()),
    0,
  );
  const { cableway } = composition.terrain;
  const cable = cableway ? triangleCount(cablewayMesh(cableway)) + triangleCount(cabin()) : 0;
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    herdTriangles(herd) +
    drifters +
    cable +
    MAX_EFFECT_TRIANGLES +
    BACKDROP_TRIANGLES
  );
}

/** Highest ground of the mountain, sampled. */
function summit(terrain: Terrain): number {
  let top = -Infinity;
  for (let x = -terrain.extent.x; x <= terrain.extent.x; x += 0.5) {
    for (let z = -terrain.extent.z; z <= terrain.extent.z; z += 0.5) {
      top = Math.max(top, terrain.surfaceAt(x, z)?.y ?? -Infinity);
    }
  }
  return top;
}

describe('mountain: budget', () => {
  it('keeps every stage and season under the tablet budget', () => {
    for (const stage of STAGES) {
      for (const season of SEASONS) {
        const triangles = sceneTriangles(scene(7, stage, season, { fill: 1 }));
        expect(triangles, `${stage} ${season}`).toBeLessThan(TRIANGLE_BUDGET);
      }
    }
  });

  it('keeps the richest stage under the budget for other seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const triangles = sceneTriangles(scene(seed, LAST_STAGE, 'spring', { fill: 1 }));
      expect(triangles, `seed ${seed}`).toBeLessThan(TRIANGLE_BUDGET);
    }
  });
});

/** The fall whose foot is nearest the middle of the pool. */
function poolFall(terrain: Terrain) {
  const [pool] = terrain.ponds;
  const off = (f: Terrain['waterfalls'][number]) =>
    Math.hypot(f.foot[0] - pool.x, f.foot[2] - pool.z);
  return terrain.waterfalls.filter((f) => f.splash).sort((a, b) => off(a) - off(b))[0];
}

describe('mountain: the cable car', () => {
  it('finds its line for every seed, its cabins clear of the ground and of the trees', () => {
    for (let seed = 0; seed < 40; seed++) {
      const plan = cablewayOf(seed);
      expect(plan, `seed ${seed}`).not.toBeNull();
      for (const stage of [8, 9, 10, LAST_STAGE] as Stage[]) {
        const terrain = createMountain(seed, stage, ['cablecar']);
        const { supports } = terrain.cableway!;
        const label = `seed ${seed}, stage ${stage}`;
        // From beside the pool up to the great peak, each support higher than the bottom one.
        expect(supports.length, label).toBeGreaterThanOrEqual(2);
        expect(supports.at(-1)!.y, label).toBeGreaterThan(supports[0].y + 10);
        for (const s of supports) expect(s.y, label).toBeGreaterThan(s.ground);
        // No tree of the forest under the line.
        for (const tree of terrain.treeSpots) {
          for (let t = 0; t < 60; t += 0.5) {
            const cab = cabinAt(terrain.cableway!, t);
            if (Math.hypot(cab.x - tree.x, cab.z - tree.z) > 1.2) continue;
            expect(cab.y - HANG, `${label}, at ${t} s`).toBeGreaterThan(
              terrain.surfaceAt(tree.x, tree.z)!.y + 3,
            );
          }
        }
      }
    }
  });

  it('runs its cabin smoothly up and down, waiting in each station', () => {
    const { cableway } = createMountain(7, LAST_STAGE, ['cablecar']);
    const bottom = cableway!.supports[0];
    const top = cableway!.supports.at(-1)!;
    const along = (p: { x: number; z: number }) =>
      ((p.x - bottom.x) * (top.x - bottom.x) + (p.z - bottom.z) * (top.z - bottom.z)) /
      Math.hypot(top.x - bottom.x, top.z - bottom.z);
    let previous = cabinAt(cableway!, 0);
    const waits = new Set<string>();
    for (let f = 1; f <= 30 * 120; f++) {
      const now = cabinAt(cableway!, f / 30);
      const step = Math.hypot(now.x - previous.x, now.y - previous.y, now.z - previous.z);
      expect(step, `${f / 30} s`).toBeLessThan(0.2);
      // Not moving at all: waiting in a station, at one end of the line.
      if (step === 0) {
        const end = along(now) < 1 ? 'bottom' : along(now) > along(top) - 1 ? 'top' : null;
        expect(end, `${f / 30} s`).not.toBeNull();
        waits.add(end!);
      }
      previous = now;
    }
    expect([...waits].sort()).toEqual(['bottom', 'top']);
  });
});

describe('mountain: stages and grand moments', () => {
  it('grows at every stage: larger, higher peaks, one more fall with each torrent ledge', () => {
    for (let seed = 0; seed < 6; seed++) {
      const terrains = STAGES.map((stage) => createMountain(seed, stage));
      const tops = terrains.map(summit);
      const falls = terrains.map((t) => t.waterfalls.filter((f) => f.splash).length);
      // From the middle ledge into the pool from the start; the hanging valley at 1, the
      // western torrent at 4, the eastern one at 7, their high ledges at 8 and 9. A torrent
      // ending in its tarn has no fall until its high ledge rises; the water running off the
      // island may fall from a ledge on its way.
      const tarn = layoutOf(seed).tarn !== null;
      expect(falls.slice(0, 4)).toEqual([1, 2, 2, 2]);
      expect(falls[LAST_STAGE]).toBeGreaterThanOrEqual(tarn ? 5 : 6);
      for (let stage = 1; stage < terrains.length; stage++) {
        expect(falls[stage], `seed ${seed}, stage ${stage}`).toBeGreaterThanOrEqual(
          falls[stage - 1],
        );
        const label = `seed ${seed}, stage ${stage}`;
        expect(terrains[stage].extent.x, label).toBeGreaterThan(terrains[stage - 1].extent.x);
        expect(terrains[stage].cover, label).toBeGreaterThan(terrains[stage - 1].cover);
        expect(tops[stage], label).toBeGreaterThan(tops[stage - 1] - 0.3);
        // The fall into the pool carries more water at every stage.
        expect(poolFall(terrains[stage]).width, label).toBeGreaterThan(
          poolFall(terrains[stage - 1]).width,
        );
      }
      expect(tops[LAST_STAGE], `seed ${seed}`).toBeGreaterThan(tops[0] + 15);
    }
  });

  it('announces the cascade and the great peak the stage before, the cable car while sold', () => {
    for (const seed of [0, 7, 19]) {
      const at = (stage: Stage) => createMountain(seed, stage);
      const labels = (stage: Stage) => at(stage).announcements.map((a) => a.label);
      expect(labels(5)).toEqual(['cascade']);
      expect(labels(9)).toEqual(['cablecar']);
      expect(labels(10)).toEqual(['peak', 'cablecar']);
      for (const stage of [0, 4, 6, 7] as Stage[]) expect(labels(stage)).toEqual([]);
      // The great cascade: the hanging valley rises high, its tall falls wrapped in spray.
      const tallest = (stage: Stage) =>
        Math.max(
          ...at(stage)
            .waterfalls.filter((f) => f.splash)
            .map((f) => f.top[1] - f.foot[1]),
        );
      expect(tallest(6)).toBeGreaterThan(tallest(5) + 2);
      expect(at(5).waterfalls.some((f) => f.spray)).toBe(false);
      expect(at(6).waterfalls.some((f) => f.spray)).toBe(true);
      // The eagles come by themselves at 9.
      expect(at(8).drifters).toEqual([]);
      for (const stage of [9, LAST_STAGE] as Stage[]) {
        expect(at(stage).drifters.map((d) => d.model)).toEqual(['eagle', 'eagle']);
      }
      for (const stage of [8, LAST_STAGE] as Stage[]) {
        expect(labels(stage)).toContain('cablecar');
        expect(at(stage).cableway).toBeNull();
        const bought = createMountain(seed, stage, ['cablecar']);
        expect(bought.announcements.map((a) => a.label)).not.toContain('cablecar');
        expect(bought.cableway).not.toBeNull();
        // Buying it moves nothing else.
        expect(bought.slots).toEqual(at(stage).slots);
        expect(bought.treeSpots).toEqual(at(stage).treeSpots);
        expect(bought.frame).toEqual(at(stage).frame);
      }
    }
  });

  it('brings effects no earlier décor had', () => {
    for (const effect of MOUNTAIN.effects) {
      for (const biome of ['clearing', 'orchard', 'sky'] as const) {
        expect(BIOMES[biome].effects).not.toContain(effect);
      }
    }
    let tarns = 0;
    for (let seed = 0; seed < 40; seed++) {
      const { tarn, joins } = layoutOf(seed);
      const final = createMountain(seed, LAST_STAGE, ['cablecar']);
      // The side torrents fall onto the middle ledge and join the main stream there, each at
      // its own place; or one keeps to its side and ends in a tarn on its back ledge.
      const feet = final.waterfalls.filter((f) => f.splash).map((f) => f.foot[1].toFixed(3));
      const onMiddle = Math.max(...feet.map((y) => feet.filter((f) => f === y).length));
      if (tarn) {
        tarns++;
        expect(onMiddle, `seed ${seed}`).toBe(2);
        expect(final.ponds, `seed ${seed}`).toHaveLength(2);
      } else {
        expect(onMiddle, `seed ${seed}`).toBe(3);
        expect(Math.abs(joins[1]! - joins[2]!), `seed ${seed}`).toBeGreaterThan(0.2);
      }
      expect(final.waterfalls.some((f) => f.spray)).toBe(true);
      expect(final.drifters.map((d) => d.model)).toEqual(['eagle', 'eagle']);
    }
    expect(tarns).toBeGreaterThan(8);
    expect(tarns).toBeLessThan(32);
    // Every torrent ends off the island, joined or not: the pool overflows at the front, the
    // tarn off its side, and low springs run off the sides; two falls into the void at least.
    for (let seed = 0; seed < 40; seed++) {
      const { tarn, outflows } = layoutOf(seed);
      const from = outflows.map((o) => o.from);
      expect(from[0], `seed ${seed}`).toBe('pool');
      expect(from.includes('tarn'), `seed ${seed}`).toBe(tarn !== null);
      expect(outflows.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      let before = 0;
      for (const stage of STAGES) {
        const terrain = createMountain(seed, stage);
        const off = terrain.waterfalls.filter((f) => !f.splash);
        const label = `seed ${seed}, stage ${stage}`;
        expect(off.length, label).toBeGreaterThanOrEqual(Math.max(1, before));
        for (const f of off) {
          expect(f.top[1] - f.foot[1], label).toBeGreaterThan(5);
          // Its lip is on the island's edge: no ground a little further out.
          const out = [f.foot[0] - f.top[0], f.foot[2] - f.top[2]];
          const l = Math.hypot(out[0], out[1]);
          const beyond = terrain.surfaceAt(
            f.top[0] + (out[0] / l) * 0.8,
            f.top[2] + (out[1] / l) * 0.8,
          );
          expect(beyond, label).toBeNull();
        }
        before = off.length;
      }
      expect(before, `seed ${seed}`).toBe(outflows.length);
    }
    // Snowy peaks, in summer too, higher and more of them as the stages go.
    const [snowU, top] = swatchUV('SnowGround', 0);
    const [, bottom] = swatchUV('SnowGround', 1);
    const snowy = (stage: Stage) => {
      const { uvs } = compose(scene(3, stage, 'summer')).ground.toMeshData();
      let count = 0;
      for (let i = 0; i < uvs.length; i += 2) {
        if (Math.abs(uvs[i] - snowU) < 1e-6 && uvs[i + 1] >= top && uvs[i + 1] <= bottom) count++;
      }
      return count;
    };
    expect(snowy(0)).toBe(0);
    expect(snowy(LAST_STAGE)).toBeGreaterThan(snowy(3));
    expect(snowy(3)).toBeGreaterThan(0);
  });
});

describe('mountain: slots', () => {
  it('composes 22 slots that open with the mountain, apart and never hiding the water', () => {
    for (let seed = 0; seed < 120; seed++) {
      const slots = slotsOf(seed);
      expect(slots, `seed ${seed}`).toHaveLength(MAX_ELEMENTS);
      const groves = slots.filter((s) => s.kind === 'grove').length;
      expect(groves, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(groves, `seed ${seed}`).toBeLessThanOrEqual(14);
      slots.forEach((slot, i) => {
        for (const other of slots.slice(i + 1)) {
          expect(Math.hypot(slot.x - other.x, slot.z - other.z), `seed ${seed}`).toBeGreaterThan(
            2.5,
          );
        }
      });
      const open = STAGES.map((stage) => createMountain(seed, stage).slots.length);
      expect(open[0], `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (let placed = 0; placed < MAX_ELEMENTS; placed++) {
        expect(
          open[stageFor(placed)] - placed,
          `seed ${seed}, ${placed} placed`,
        ).toBeGreaterThanOrEqual(Math.min(2, MAX_ELEMENTS - placed));
      }
    }
    for (const seed of [2, 7, 40]) {
      // On grass at every stage that shows them: never on a cliff built later.
      for (const stage of STAGES) {
        const terrain = createMountain(seed, stage);
        for (const slot of terrain.slots) {
          const label = `seed ${seed}, stage ${stage}, slot ${slot.index}`;
          const surface = terrain.surfaceAt(slot.x, slot.z);
          expect(surface?.kind, label).toBe('grass');
          expect(surface!.slope, label).toBeLessThan(0.35);
          if (slot.kind === 'grove') continue;
          // A tree never stands in front of a fall lower than the line of sight over it.
          const water = terrain.waterfalls.flatMap((f) => [
            [f.top[0], f.top[2], f.top[1]] as const,
            [f.foot[0], f.foot[2], f.foot[1]] as const,
          ]);
          expect(hidesWater(water, slot.x, slot.z, surface!.y), label).toBe(false);
        }
      }
    }
  });

  it('keeps a tree in place and in shape from one stage to the next', () => {
    const trees = (stage: Stage) => {
      const grown = compose(scene(11, stage, 'summer')).planting.trees.filter((t) => t.age > 0);
      return new Map(grown.map((t) => [`${t.x},${t.z}`, t]));
    };
    const all = STAGES.map(trees);
    for (let stage = 1; stage < all.length; stage++) {
      for (const [place, tree] of all[stage - 1]) {
        const same = all[stage].get(place);
        expect(same, `stage ${stage}: tree at ${place}`).toBeDefined();
        expect(same).toMatchObject({ family: tree.family, seed: tree.seed, detail: tree.detail });
      }
    }
    expect(all[LAST_STAGE].size).toBeGreaterThan(all[0].size * 3);
  });

  it('replays a mountain painting from its compact description', () => {
    for (let seed = 0; seed < 24; seed++) {
      const description = scene(seed, STAGES[seed % STAGES.length], 'autumn', { fill: 0.4 });
      expect(readDescription(JSON.parse(JSON.stringify(description)))).toEqual(description);
    }
  });
});

describe('mountain: animals', () => {
  it('come from their stage on and only walk on grass', () => {
    const state = {} as AnimalState;
    for (const seed of [1, 7, 12]) {
      for (const stage of [3, 7, LAST_STAGE] as Stage[]) {
        const terrain = createMountain(seed, stage);
        const plan = planHerd(terrain, demoAnimals('mountain', stage), seed);
        expect(plan.length, `seed ${seed} stage ${stage}`).toBe(
          demoAnimals('mountain', stage).length,
        );
        for (const member of plan) {
          for (let t = 0; t < member.period; t += 1) {
            animalState(member, t, state);
            expect(terrain.surfaceAt(state.x, state.z)?.kind).toBe('grass');
          }
        }
      }
    }
  });
});
