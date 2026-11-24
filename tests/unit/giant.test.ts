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
import { MAX_EFFECT_TRIANGLES, MAX_SPIRAL_LEAVES } from '../../src/scene/painting';
import {
  animalState,
  herdTriangles,
  planHerd,
  type AnimalState,
} from '../../src/scene/render/ambient-life';
import { BACKDROP_TRIANGLES } from '../../src/scene/render/backdrop';
import { CANOPY_RAYS } from '../../src/scene/render/particles';
import { QUALITY } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { createGiantTree, GiantTree, slotsOf } from '../../src/scene/terrain/giant';
import { SEASONS, type Season } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { giantShape, trunkAt } from '../../src/scene/trees/giant';
import { createBudgetLibrary } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const GIANT = BIOMES.giant;

function scene(
  seed: number,
  stage: Stage,
  season: Season,
  { fill = DEMO_FILL[stage], ...more }: Partial<SceneDescription> & { fill?: number } = {},
): SceneDescription {
  return {
    biome: 'giant',
    seed,
    stage,
    season,
    seasons: [season],
    elements: demoElements(seed, fill),
    animals: demoAnimals('giant', stage),
    ...more,
  };
}

const compose = (description: SceneDescription, quality = QUALITY.high) =>
  composeScene(
    description,
    budget,
    ambienceFor(description.stage, description.season, GIANT),
    quality,
  );

function sceneTriangles(description: SceneDescription): number {
  const composition = compose(description);
  const parts = compositionTriangles(composition, budget);
  const forest = buildForestBuffers(composition.planting.trees, budget, description.season);
  const herd = planHerd(composition.terrain, description.animals, description.seed);
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    herdTriangles(herd) +
    MAX_EFFECT_TRIANGLES +
    MAX_SPIRAL_LEAVES * 2 +
    CANOPY_RAYS * 2 +
    BACKDROP_TRIANGLES
  );
}

const tree = (seed: number, stage: Stage) => new GiantTree(seed, stage);

describe('great tree: budget', () => {
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

describe('great tree: its growth', () => {
  it('is the same tree at every growth, larger and with more limbs', () => {
    for (const seed of [1, 7, 30]) {
      expect(giantShape(seed, 0.5)).toEqual(giantShape(seed, 0.5));
      const shapes = [0, 0.2, 0.4, 0.6, 0.8, 1].map((growth) => giantShape(seed, growth));
      expect(shapes[0].limbs).toHaveLength(2);
      expect(shapes.at(-1)!.limbs).toHaveLength(7);
      for (let i = 1; i < shapes.length; i++) {
        expect(shapes[i].height).toBeGreaterThan(shapes[i - 1].height);
        expect(shapes[i].trunk[0].r).toBeGreaterThan(shapes[i - 1].trunk[0].r);
        expect(shapes[i].limbs.length).toBeGreaterThanOrEqual(shapes[i - 1].limbs.length);
      }
      // A sprout a little taller than a young tree, then a colossus.
      expect(shapes[0].height).toBeLessThan(3.5);
      expect(shapes.at(-1)!.height).toBeGreaterThan(shapes[0].height * 3);
    }
    expect(giantShape(1, 1).skeleton.x).not.toEqual(giantShape(2, 1).skeleton.x);
  });

  it('grows at every stage until the colossus, the diorama with it', () => {
    for (let seed = 0; seed < 6; seed++) {
      const terrains = STAGES.map((stage) => tree(seed, stage));
      for (let stage = 1; stage < terrains.length; stage++) {
        const label = `seed ${seed}, stage ${stage}`;
        const [before, now] = [terrains[stage - 1], terrains[stage]];
        expect(now.extent.x, label).toBeGreaterThan(before.extent.x);
        expect(now.cover, label).toBeGreaterThan(before.cover);
        expect(now.treehouse.shape.height, label).toBeGreaterThanOrEqual(
          before.treehouse.shape.height,
        );
      }
      expect(terrains[10].treehouse.shape.height).toBeGreaterThan(
        terrains[9].treehouse.shape.height,
      );
      // The great tree is always there, as the hero of the painting.
      for (const terrain of terrains) {
        expect(terrain.treeSpots.filter((s) => s.giant)).toHaveLength(1);
      }
    }
  });
});

describe('great tree: its decks and grand moments', () => {
  it('builds the tree house piece by piece', () => {
    for (const seed of [0, 7, 19]) {
      const house = (stage: Stage) => tree(seed, stage).treehouse;
      expect(house(3).ladder).toBeNull();
      expect(house(4).ladder).not.toBeNull();
      expect(house(4).stair).toBeNull();
      expect(house(5).stair).not.toBeNull();
      expect(house(6).swing).toBeNull();
      expect(house(7).swing).not.toBeNull();
      expect(house(7).nests).toHaveLength(0);
      expect(house(8).nests).toHaveLength(3);
      expect(house(8).lookout).toBeNull();
      expect(house(9).lookout).not.toBeNull();
    }
  });

  it('sets every deck on the trunk, under the limbs', () => {
    for (const seed of [0, 3, 7, 19, 42]) {
      for (const stage of STAGES) {
        const { foot, shape, low, cabinDeck, lookout } = tree(seed, stage).treehouse;
        const limbs = foot[1] + shape.trunk[shape.trunk.length - 3].y;
        for (const deck of [low, cabinDeck, lookout]) {
          if (!deck) continue;
          const label = `seed ${seed}, stage ${stage}`;
          expect(deck.inner, label).toBeLessThanOrEqual(trunkAt(shape, deck.y - foot[1]).r);
          expect(deck.y + 1, label).toBeLessThan(limbs);
          expect(deck.outer, label).toBeGreaterThan(deck.inner + 1);
        }
      }
    }
  });

  it('announces the cabin and the lanterns the stage before, then shows them', () => {
    for (const seed of [0, 7, 19]) {
      const at = (stage: Stage) => tree(seed, stage);
      expect(at(5).announcements.map((a) => a.label)).toEqual(['cabin']);
      expect(at(5).treehouse.cabin).toBeNull();
      for (const stage of [6, 7, 8, 9] as Stage[]) {
        expect(at(stage).treehouse.cabin, `stage ${stage}`).not.toBeNull();
        expect(at(stage).announcements, `stage ${stage}`).toEqual([]);
      }
      expect(at(10).announcements.map((a) => a.label)).toEqual(['lanterns']);
      expect(at(10).lanterns).toEqual([]);
      expect(at(LAST_STAGE).lanterns.length).toBeGreaterThan(20);
    }
    // The lanterns light up at dusk.
    expect(ambienceFor(10, 'summer', GIANT).sun.elevation).toBeGreaterThan(
      ambienceFor(LAST_STAGE, 'summer', GIANT).sun.elevation + 5,
    );
  });

  it('brings effects no earlier décor had', () => {
    const earlier = [BIOMES.clearing, BIOMES.orchard, BIOMES.sky].flatMap((b) => b.effects);
    for (const effect of GIANT.effects) expect(earlier).not.toContain(effect);
    const terrain = tree(3, 6);
    expect(terrain.canopy).not.toBeNull();
    expect(terrain.canopy!.radius).toBeGreaterThan(terrain.canopy!.trunk + 2);
    expect(ambienceFor(6, 'summer', GIANT).canopyRays).toBeGreaterThan(0);
    // No other décor has a great tree, nor dusk.
    for (const id of ['clearing', 'orchard', 'sky'] as const) {
      expect(BIOMES[id].terrain(3, LAST_STAGE).canopy).toBeNull();
      expect(ambienceFor(LAST_STAGE, 'summer', BIOMES[id]).canopyRays).toBe(0);
    }
  });
});

describe('great tree: slots', () => {
  it('composes 22 slots that open with the diorama, apart and never hiding the tree', () => {
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
      const open = STAGES.map((stage) => createGiantTree(seed, stage).slots.length);
      expect(open[0], `seed ${seed}`).toBeGreaterThanOrEqual(4);
      for (let placed = 0; placed < MAX_ELEMENTS; placed++) {
        expect(
          open[stageFor(placed)] - placed,
          `seed ${seed}, ${placed} placed`,
        ).toBeGreaterThanOrEqual(Math.min(2, MAX_ELEMENTS - placed));
      }
    }
    for (const seed of [2, 7, 40]) {
      const final = tree(seed, LAST_STAGE);
      const { foot, swing } = final.treehouse;
      for (const slot of final.slots) {
        const label = `seed ${seed}, slot ${slot.index}`;
        expect(final.surfaceAt(slot.x, slot.z)?.kind, label).toBe('grass');
        // Off the roots and the swing; right in front of the trunk, only low groves.
        expect(Math.hypot(slot.x - foot[0], slot.z - foot[2]), label).toBeGreaterThan(7);
        expect(Math.hypot(slot.x - swing!.branch[0], slot.z - swing!.branch[2])).toBeGreaterThan(2);
        if (slot.z > foot[2] && Math.abs(slot.x - foot[0]) < 5)
          expect(slot.kind, label).toBe('grove');
        for (const pond of final.ponds) {
          const hidden = slot.z > pond.z && slot.z - pond.z < 8 && Math.abs(slot.x - pond.x) < 1.5;
          expect(hidden, label).toBe(false);
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
      for (const [place, t] of all[stage - 1]) {
        const same = all[stage].get(place);
        expect(same, `stage ${stage}: tree at ${place}`).toBeDefined();
        expect(same).toMatchObject({ family: t.family, seed: t.seed, detail: t.detail });
      }
    }
    expect(all[LAST_STAGE].size).toBeGreaterThan(all[0].size * 5);
  });

  it('replays a great tree painting from its compact description', () => {
    for (let seed = 0; seed < 24; seed++) {
      const description = scene(seed, STAGES[seed % STAGES.length], 'autumn', { fill: 0.4 });
      expect(readDescription(JSON.parse(JSON.stringify(description)))).toEqual(description);
    }
  });
});

describe('great tree: animals', () => {
  it('come from their stage on and only walk on grass', () => {
    const state = {} as AnimalState;
    for (const seed of [1, 7, 12]) {
      for (const stage of [3, 7, LAST_STAGE] as Stage[]) {
        const terrain = createGiantTree(seed, stage);
        const plan = planHerd(terrain, demoAnimals('giant', stage), seed);
        expect(plan.length, `seed ${seed} stage ${stage}`).toBe(demoAnimals('giant', stage).length);
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
