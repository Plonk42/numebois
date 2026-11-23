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
import {
  animalState,
  herdTriangles,
  planHerd,
  type AnimalState,
} from '../../src/scene/render/ambient-life';
import { BACKDROP_TRIANGLES } from '../../src/scene/render/backdrop';
import { QUALITY } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { createOrchard, slotsOf } from '../../src/scene/terrain/orchard';
import type { Terrain } from '../../src/scene/terrain/types';
import { SEASONS, type Season } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { createBudgetLibrary } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const ORCHARD = BIOMES.orchard;

function scene(
  seed: number,
  stage: Stage,
  season: Season,
  { fill = DEMO_FILL[stage], ...more }: Partial<SceneDescription> & { fill?: number } = {},
): SceneDescription {
  return {
    biome: 'orchard',
    seed,
    stage,
    season,
    seasons: [season],
    elements: demoElements(seed, fill),
    animals: demoAnimals('orchard', stage),
    ...more,
  };
}

const compose = (description: SceneDescription, quality = QUALITY.high) =>
  composeScene(
    description,
    budget,
    ambienceFor(description.stage, description.season, ORCHARD),
    quality,
  );

function sceneTriangles(description: SceneDescription): number {
  const composition = compose(description);
  const parts = compositionTriangles(composition, budget);
  const forest = buildForestBuffers(composition.planting.trees, budget, description.season);
  const herd = planHerd(composition.terrain, description.animals, description.seed);
  const spinners = composition.terrain.spinners.reduce(
    (sum, s) => sum + triangleCount(budget.data(s.model)),
    0,
  );
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    herdTriangles(herd) +
    spinners +
    MAX_EFFECT_TRIANGLES +
    BACKDROP_TRIANGLES
  );
}

/** Highest ground of the diorama, sampled. */
function summit(terrain: Terrain): number {
  let top = -Infinity;
  for (let x = -terrain.extent.x; x <= terrain.extent.x; x += 0.5) {
    for (let z = -terrain.extent.z; z <= terrain.extent.z; z += 0.5) {
      top = Math.max(top, terrain.surfaceAt(x, z)?.y ?? -Infinity);
    }
  }
  return top;
}

describe('orchard: budget', () => {
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

describe('orchard: stages and grand moments', () => {
  it('grows at every stage: larger, higher terraces, more cascades', () => {
    for (let seed = 0; seed < 6; seed++) {
      const terrains = STAGES.map((stage) => createOrchard(seed, stage));
      const tops = terrains.map(summit);
      const falls = terrains.map((t) => t.waterfalls.length);
      // The brook comes at stage 3, with one more cascade for each terrace that rises.
      expect(falls.slice(0, 3)).toEqual([0, 0, 0]);
      expect(falls[3]).toBeGreaterThan(0);
      for (let stage = 1; stage < terrains.length; stage++) {
        const label = `seed ${seed}, stage ${stage}`;
        expect(terrains[stage].extent.x, label).toBeGreaterThan(terrains[stage - 1].extent.x);
        expect(terrains[stage].cover, label).toBeGreaterThan(terrains[stage - 1].cover);
        expect(tops[stage], label).toBeGreaterThan(tops[stage - 1] - 0.3);
        expect(falls[stage], label).toBeGreaterThanOrEqual(falls[stage - 1]);
      }
      expect(tops[LAST_STAGE], `seed ${seed}`).toBeGreaterThan(tops[0] + 8);
      expect(falls[LAST_STAGE], `seed ${seed}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('announces the windmill and the great blossom the stage before, then shows them', () => {
    for (const seed of [0, 7, 19]) {
      const at = (stage: Stage) => createOrchard(seed, stage);
      const labels = (stage: Stage) => at(stage).announcements.map((a) => a.label);
      expect(labels(5)).toEqual(['windmill']);
      expect(at(5).spinners).toEqual([]);
      for (const stage of [6, 9, LAST_STAGE] as Stage[]) {
        expect(at(stage).spinners.map((s) => s.model)).toEqual(['Windmill_Sails']);
        expect(at(stage).staticModels.map((m) => m.model)).toContain('Windmill');
      }
      expect(labels(7)).toEqual(['blossom']);
      const pink = (stage: Stage) =>
        compose(scene(seed, stage, 'spring', { fill: 1 })).planting.trees.filter((t) =>
          t.foliage?.includes('Blossom'),
        ).length;
      expect(pink(7)).toBe(0);
      expect(pink(8)).toBeGreaterThan(12);
      // Fruits from stage 10, the rest of the orchard still in blossom.
      const trees = compose(scene(seed, LAST_STAGE, 'spring', { fill: 1 })).planting.trees;
      expect(trees.some((t) => t.fruit !== undefined)).toBe(true);
      expect(trees.filter((t) => t.foliage?.includes('Blossom')).length).toBeGreaterThan(12);
    }
  });

  it('brings effects no earlier décor had', () => {
    for (const effect of ORCHARD.effects) expect(BIOMES.clearing.effects).not.toContain(effect);
    expect(createOrchard(3, LAST_STAGE).spinners.length).toBeGreaterThan(0);
  });
});

describe('orchard: slots', () => {
  it('composes 22 slots that open with the diorama, apart and never hiding the water', () => {
    for (let seed = 0; seed < 120; seed++) {
      const slots = slotsOf(seed);
      expect(slots, `seed ${seed}`).toHaveLength(MAX_ELEMENTS);
      const groves = slots.filter((s) => s.kind === 'grove').length;
      expect(groves, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(groves, `seed ${seed}`).toBeLessThanOrEqual(6);
      slots.forEach((slot, i) => {
        for (const other of slots.slice(i + 1)) {
          expect(Math.hypot(slot.x - other.x, slot.z - other.z), `seed ${seed}`).toBeGreaterThan(
            2.5,
          );
        }
      });
      // Strictly in opening order, and always a choice left.
      const open = STAGES.map((stage) => createOrchard(seed, stage).slots.length);
      expect(open[0], `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (let placed = 0; placed < MAX_ELEMENTS; placed++) {
        expect(
          open[stageFor(placed)] - placed,
          `seed ${seed}, ${placed} placed`,
        ).toBeGreaterThanOrEqual(Math.min(2, MAX_ELEMENTS - placed));
      }
    }
    for (const seed of [2, 7, 40]) {
      const final = createOrchard(seed, LAST_STAGE);
      for (const slot of final.slots) {
        const label = `seed ${seed}, slot ${slot.index}`;
        const surface = final.surfaceAt(slot.x, slot.z);
        expect(surface?.kind, label).toBe('grass');
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
    expect(all[LAST_STAGE].size).toBeGreaterThan(all[0].size * 5);
  });

  it('replays an orchard painting from its compact description', () => {
    for (let seed = 0; seed < 24; seed++) {
      const description = scene(seed, STAGES[seed % STAGES.length], 'autumn', { fill: 0.4 });
      expect(readDescription(JSON.parse(JSON.stringify(description)))).toEqual(description);
    }
  });
});

describe('orchard: animals', () => {
  it('come from their stage on and only walk on grass', () => {
    const state = {} as AnimalState;
    for (const seed of [1, 7, 12]) {
      for (const stage of [3, 7, LAST_STAGE] as Stage[]) {
        const terrain = createOrchard(seed, stage);
        const plan = planHerd(terrain, demoAnimals('orchard', stage), seed);
        expect(plan.length, `seed ${seed} stage ${stage}`).toBe(
          demoAnimals('orchard', stage).length,
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
