import { describe, expect, it } from 'vitest';
import { BIOMES } from '../../src/scene/biomes';
import { composeScene, compositionTriangles } from '../../src/scene/compose';
import {
  DEMO_FILL,
  LAST_STAGE,
  MAX_ELEMENTS,
  STAGES,
  demoAnimals,
  demoElements,
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
import { CLOUD_SEA_TRIANGLES } from '../../src/scene/render/cloud-sea';
import { QUALITY } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { archipelagoOf, CLOUD_SEA, createSkyIslands, slotsOf } from '../../src/scene/terrain/sky';
import type { Terrain } from '../../src/scene/terrain/types';
import { SEASONS, type Season } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { createBudgetLibrary } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const SKY = BIOMES.sky;

function scene(
  seed: number,
  stage: Stage,
  season: Season,
  { fill = DEMO_FILL[stage], ...more }: Partial<SceneDescription> & { fill?: number } = {},
): SceneDescription {
  return {
    biome: 'sky',
    seed,
    stage,
    season,
    seasons: [season],
    night: 'none',
    elements: demoElements(seed, fill),
    animals: demoAnimals('sky', stage),
    ...more,
  };
}

const compose = (description: SceneDescription, quality = QUALITY.high) =>
  composeScene(
    description,
    budget,
    ambienceFor(description.stage, description.season, SKY),
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
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    herdTriangles(herd) +
    drifters +
    CLOUD_SEA_TRIANGLES +
    MAX_EFFECT_TRIANGLES +
    BACKDROP_TRIANGLES
  );
}

/** Highest ground of the archipelago, sampled. */
function summit(terrain: Terrain): number {
  let top = -Infinity;
  for (let x = -terrain.extent.x; x <= terrain.extent.x; x += 0.5) {
    for (let z = -terrain.extent.z; z <= terrain.extent.z; z += 0.5) {
      top = Math.max(top, terrain.surfaceAt(x, z)?.y ?? -Infinity);
    }
  }
  return top;
}

/** Area of ground out of the clouds, sampled on a fixed grid. */
function groundArea(terrain: Terrain): number {
  let area = 0;
  for (let x = -40; x <= 40; x += 1) {
    for (let z = -40; z <= 30; z += 1) {
      if (terrain.surfaceAt(x, z)) area++;
    }
  }
  return area;
}

describe('sky islands: budget', () => {
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

describe('sky islands: stages and grand moments', () => {
  it('rises at every stage: more ground, higher islands, more falls', () => {
    for (let seed = 0; seed < 6; seed++) {
      const terrains = STAGES.map((stage) => createSkyIslands(seed, stage));
      const areas = terrains.map(groundArea);
      const tops = terrains.map(summit);
      const falls = terrains.map((t) => t.waterfalls.length);
      // The spring comes at stage 2, its fall into the clouds; the great cascade at 8.
      expect(falls.slice(0, 2)).toEqual([0, 0]);
      expect(falls[2]).toBe(1);
      expect(falls[7]).toBe(1);
      expect(falls[8]).toBe(3);
      for (let stage = 1; stage < terrains.length; stage++) {
        const label = `seed ${seed}, stage ${stage}`;
        expect(areas[stage], label).toBeGreaterThanOrEqual(areas[stage - 1]);
        expect(terrains[stage].cover, label).toBeGreaterThan(terrains[stage - 1].cover);
        expect(tops[stage], label).toBeGreaterThan(tops[stage - 1] - 0.3);
      }
      expect(tops[LAST_STAGE], `seed ${seed}`).toBeGreaterThan(tops[0] + 9);
      expect(areas[LAST_STAGE], `seed ${seed}`).toBeGreaterThan(areas[0] * 1.8);
    }
  });

  it('announces the suspension bridge, the cascade and the balloon the stage before', () => {
    for (const seed of [0, 7, 19]) {
      const at = (stage: Stage) => createSkyIslands(seed, stage);
      const labels = (stage: Stage) => at(stage).announcements.map((a) => a.label);
      expect(labels(5)).toEqual(['bridge']);
      expect(labels(7)).toEqual(['cascade']);
      expect(labels(10)).toEqual(['balloon']);
      for (const stage of [0, 6, 8, 11] as Stage[]) expect(labels(stage)).toEqual([]);
      expect(at(10).drifters).toEqual([]);
      expect(at(LAST_STAGE).drifters.map((d) => d.model)).toEqual(['balloon']);
    }
  });

  it('brings effects no earlier décor had', () => {
    for (const effect of SKY.effects) {
      expect(BIOMES.clearing.effects).not.toContain(effect);
      expect(BIOMES.orchard.effects).not.toContain(effect);
    }
    const final = createSkyIslands(3, LAST_STAGE);
    // The sea of clouds, with the main stream falling into it.
    expect(final.cloudSea).toBe(CLOUD_SEA);
    expect(final.waterfalls.filter((f) => !f.splash)).toHaveLength(1);
    expect(final.waterfalls.find((f) => !f.splash)!.foot[1]).toBeLessThan(CLOUD_SEA + 1);
    expect(final.drifters).toHaveLength(1);
    // Rope bridges and the suspension bridge are in the ground mesh: more triangles with them.
    const ground = (stage: Stage) => compose(scene(3, stage, 'summer')).ground.triangles;
    expect(ground(4)).toBeGreaterThan(ground(3));
    expect(ground(6)).toBeGreaterThan(ground(5));
  });
});

describe('sky islands: archipelago', () => {
  it('chains isles through others, differently for each seed, with gentle bridges', () => {
    const shapes = new Set<string>();
    let chained = 0;
    const seeds = 60;
    for (let seed = 0; seed < seeds; seed++) {
      const { islands, links } = archipelagoOf(seed);
      const isles = islands.filter((i) => i.role === 'isle');
      expect(isles.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(isles.length, `seed ${seed}`).toBeLessThanOrEqual(6);
      // Every isle hangs by an island out of the clouds before it, by one bridge.
      for (const isle of isles) {
        const parent = islands[isle.parent!];
        expect(parent.rises, `seed ${seed}`).toBeLessThanOrEqual(isle.rises);
        expect(links.filter((l) => l.to === isle.index)).toHaveLength(1);
      }
      if (isles.some((i) => islands[i.parent!].role === 'isle')) chained++;
      shapes.add(
        isles.map((i) => `${i.kind}<${islands[i.parent!].kind ?? islands[i.parent!].role}`).join(),
      );
      expect(
        links.filter((l) => l.kind === 'suspension'),
        `seed ${seed}`,
      ).toHaveLength(1);
      for (const link of links) {
        for (const stage of STAGES.filter((s) => s >= link.stage)) {
          const climb = Math.abs(
            islands[link.from].levels[stage]! - islands[link.to].levels[stage]!,
          );
          expect(climb / link.span, `seed ${seed}, stage ${stage}`).toBeLessThan(0.65);
        }
      }
    }
    expect(chained).toBeGreaterThan(seeds * 0.4);
    expect(shapes.size).toBeGreaterThan(seeds * 0.3);
  });
});

describe('sky islands: slots', () => {
  it('composes 22 slots that open with the islands, apart and never hiding the water', () => {
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
      // Strictly in opening order, and always a choice left.
      const open = STAGES.map((stage) => createSkyIslands(seed, stage).slots.length);
      expect(open[0], `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (let placed = 0; placed < MAX_ELEMENTS; placed++) {
        expect(
          open[stageFor(placed)] - placed,
          `seed ${seed}, ${placed} placed`,
        ).toBeGreaterThanOrEqual(Math.min(2, MAX_ELEMENTS - placed));
      }
    }
    for (const seed of [2, 7, 40]) {
      const final = createSkyIslands(seed, LAST_STAGE);
      for (const slot of final.slots) {
        const label = `seed ${seed}, slot ${slot.index}`;
        const surface = final.surfaceAt(slot.x, slot.z);
        expect(surface?.kind, label).toBe('grass');
        if (slot.kind === 'grove') continue;
        for (const fall of final.waterfalls) {
          const hidden = (wx: number, wz: number) =>
            slot.z > wz && slot.z - wz < 8 && Math.abs(slot.x - wx) < 1.5;
          expect(hidden(fall.foot[0], fall.foot[2]), label).toBe(false);
          expect(hidden(fall.top[0], fall.top[2]), label).toBe(false);
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

  it('replays a sky painting from its compact description', () => {
    for (let seed = 0; seed < 24; seed++) {
      const description = scene(seed, STAGES[seed % STAGES.length], 'autumn', { fill: 0.4 });
      expect(readDescription(JSON.parse(JSON.stringify(description)))).toEqual(description);
    }
  });
});

describe('sky islands: animals', () => {
  it('come from their stage on and only walk on grass', () => {
    const state = {} as AnimalState;
    for (const seed of [1, 7, 12]) {
      for (const stage of [3, 7, LAST_STAGE] as Stage[]) {
        const terrain = createSkyIslands(seed, stage);
        const plan = planHerd(terrain, demoAnimals('sky', stage), seed);
        expect(plan.length, `seed ${seed} stage ${stage}`).toBe(demoAnimals('sky', stage).length);
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
