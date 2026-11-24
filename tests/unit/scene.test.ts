import { describe, expect, it } from 'vitest';
import { hashSeed, Rng, valueNoise2 } from '../../src/core/rng';
import { createPlaceholderLibrary } from '../../src/scene/assets';
import { BIOMES } from '../../src/scene/biomes';
import { composeScene, compositionTriangles } from '../../src/scene/compose';
import {
  BIOME_IDS,
  DEMO_FILL,
  LAST_STAGE,
  MAX_ELEMENTS,
  STAGES,
  choicesOf,
  choose,
  demoAnimals,
  demoElements,
  demoRares,
  isBought,
  parseDescription,
  RARE_OFFERS,
  rareStage,
  readDescription,
  shownChoice,
  stageFor,
  writeDescription,
  type SceneDescription,
  type Stage,
} from '../../src/scene/description';
import { MAX_EFFECT_TRIANGLES } from '../../src/scene/painting';
import { candidateSlots, childTreeAge, plantTrees } from '../../src/scene/populate';
import {
  animalState,
  Herd,
  herdTriangles,
  planHerd,
  type AnimalState,
} from '../../src/scene/render/ambient-life';
import { createPlaceholderAnimals } from '../../src/scene/animals';
import { ANIMALS } from '../../src/scene/animals.gen';
import { BACKDROP_TRIANGLES } from '../../src/scene/render/backdrop';
import type { InstanceBatch, InstanceModel } from '../../src/scene/render/instancing';
import { QUALITIES, QUALITY, QualityGovernor } from '../../src/scene/render/quality';
import { ambienceFor } from '../../src/scene/render/richness';
import { clearingLayout, createClearing } from '../../src/scene/terrain/clearing';
import {
  SLOT_COUNT,
  basinAt,
  dryness,
  hidesWater,
  rimValue,
} from '../../src/scene/terrain/clearing-layout';
import { distanceToPath } from '../../src/scene/terrain/types';
import { SEASONS, type Season } from '../../src/scene/trees/builder';
import { buildForestBuffers } from '../../src/scene/trees/forest';
import { createBudgetLibrary, hashFloats } from './helpers';

const TRIANGLE_BUDGET = 150_000;
const budget = createBudgetLibrary();
const placeholders = createPlaceholderLibrary();

/** A description with the slots filled and the animals bought as at its stage (or `fill`). */
function scene(
  seed: number,
  stage: Stage,
  season: Season,
  { fill = DEMO_FILL[stage], ...more }: Partial<SceneDescription> & { fill?: number } = {},
): SceneDescription {
  return {
    biome: 'clearing',
    seed,
    stage,
    season,
    seasons: [season],
    night: 'none',
    elements: demoElements(seed, fill),
    animals: demoAnimals('clearing', stage),
    rares: demoRares('clearing', stage),
    ...more,
  };
}

/** Stage from which the shop sells the beavers, who fill their lake. */
const lakeStage = () => rareStage('clearing', 'beavers')!;

function sceneTriangles(description: SceneDescription, quality = QUALITY.high): number {
  const season = description.season;
  const ambience = ambienceFor(description.stage, season);
  const composition = composeScene(description, budget, ambience, quality);
  const parts = compositionTriangles(composition, budget);
  const forest = buildForestBuffers(composition.planting.trees, budget, season);
  const herd = planHerd(composition.terrain, description.animals, description.seed);
  return (
    parts.ground +
    parts.water +
    parts.instances +
    parts.clouds +
    forest.writer.triangles +
    herdTriangles(herd) +
    MAX_EFFECT_TRIANGLES +
    BACKDROP_TRIANGLES
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
    const d = parseDescription(
      new URLSearchParams('biome=orchard&stage=4&season=winter&seed=12&fill=50'),
    );
    expect(d).toEqual({
      biome: 'orchard',
      stage: 4,
      season: 'winter',
      seasons: ['winter'],
      night: 'none',
      seed: 12,
      elements: demoElements(12, 0.5),
      animals: ['Donkey'],
      rares: ['fireflies'],
    });
    const fallback = parseDescription(
      new URLSearchParams('biome=jungle&stage=12&season=monsoon&seed=x'),
    );
    expect(fallback).toEqual(scene(7, 6, 'summer'));
    expect(parseDescription(new URLSearchParams('stage=0&fill=250')).elements).toHaveLength(
      MAX_ELEMENTS,
    );
    const params = new URLSearchParams();
    writeDescription(params, d);
    expect(parseDescription(params)).toEqual(d);
    const night = { ...d, night: 'shown' } as const;
    writeDescription(params, night);
    expect(parseDescription(params)).toEqual(night);
    expect(parseDescription(new URLSearchParams('stage=11&rares=beavers,unicorn')).rares).toEqual([
      'beavers',
    ]);
    expect(parseDescription(new URLSearchParams('stage=11&rares=')).rares).toEqual([]);
    expect(STAGES).toHaveLength(12);
    expect(LAST_STAGE).toBe(STAGES[STAGES.length - 1]);
  });

  it('composes the same scene twice from the same description', () => {
    const description = scene(21, 9, 'autumn', { fill: 0.5 });
    const ambience = ambienceFor(9, 'autumn');
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
  it('keeps every stage and season under the tablet budget', () => {
    for (const stage of STAGES) {
      for (const season of SEASONS) {
        const triangles = sceneTriangles(scene(7, stage, season));
        expect(triangles, `${stage} ${season}`).toBeLessThan(TRIANGLE_BUDGET);
      }
    }
  });

  it('keeps the richest stage under the budget for other seeds and slots', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const triangles = sceneTriangles(scene(seed, LAST_STAGE, 'summer'));
      expect(triangles, `seed ${seed}`).toBeLessThan(TRIANGLE_BUDGET);
    }
    for (const season of SEASONS) {
      for (const fill of [0, 1]) {
        const full = scene(7, LAST_STAGE, season, { fill });
        expect(sceneTriangles(full), `${season} ${fill}`).toBeLessThan(TRIANGLE_BUDGET);
      }
    }
  });

  it('gets richer with the stage and lighter with the quality tier', () => {
    const first = sceneTriangles(scene(7, 0, 'summer'));
    const last = sceneTriangles(scene(7, LAST_STAGE, 'summer'));
    expect(last).toBeGreaterThan(first * 1.2);
    const low = sceneTriangles(scene(7, LAST_STAGE, 'summer'), QUALITY.low);
    expect(low).toBeLessThan(last);
  });

  it('starts the clearing bare and makes every stage richer, step by step', () => {
    const stages = STAGES.map((stage) => sceneTriangles(scene(7, stage, 'summer')));
    for (let stage = 1; stage < stages.length; stage++) {
      // Visibly richer, but never a jump: progress comes in many small steps.
      expect(stages[stage], `stage ${stage}`).toBeGreaterThan(stages[stage - 1] * 1.05);
      expect(stages[stage], `stage ${stage}`).toBeLessThan(stages[stage - 1] * 1.35);
    }
    expect(stages[LAST_STAGE]).toBeGreaterThan(stages[0] * 3);
  });
});

describe('animals', () => {
  const plan = (seed: number, stage: Stage, animals = demoAnimals('clearing', stage)) =>
    planHerd(createClearing(seed, stage), animals, seed);

  it('come from their stage on and all find a place in the meadow', { timeout: 30_000 }, () => {
    for (let seed = 0; seed < 8; seed++) {
      const counts = STAGES.map((stage) => plan(seed, stage).length);
      const wanted = STAGES.map((stage) => demoAnimals('clearing', stage).length);
      expect(counts, `seed ${seed}`).toEqual(wanted);
      expect(counts[0]).toBe(0);
      // Bought in another order, each one still finds a place.
      const reversed = demoAnimals('clearing', LAST_STAGE).reverse();
      expect(plan(seed, LAST_STAGE, reversed), `seed ${seed}`).toHaveLength(reversed.length);
    }
  });

  it('only walk on grass, away from the water', () => {
    const state = {} as AnimalState;
    for (const seed of [1, 7]) {
      for (const stage of [3, 7, LAST_STAGE] as Stage[]) {
        const terrain = createClearing(seed, stage);
        for (const member of plan(seed, stage)) {
          for (let t = 0; t < member.period; t += 0.5) {
            animalState(member, t, state);
            const surface = terrain.surfaceAt(state.x, state.z);
            expect(surface?.kind, `seed ${seed} stage ${stage} ${member.name} t ${t}`).toBe(
              'grass',
            );
            expect(Math.abs(state.y - surface!.y)).toBeLessThan(0.3);
          }
        }
      }
    }
  });

  it('put the wolf on its ledge, high on the mountain, in view and from stage 10 on', () => {
    let ledges = 0;
    for (let seed = 0; seed < 10; seed++) {
      expect(createClearing(seed, 9).perch, `seed ${seed}`).toBeNull();
      const terrain = createClearing(seed, 10);
      const perch = terrain.perch;
      if (!perch) continue;
      ledges++;
      expect(perch.y, `seed ${seed}`).toBeGreaterThan(4);
      expect(terrain.surfaceAt(perch.x, perch.z)!.slope, `seed ${seed}`).toBeLessThan(0.1);
      for (const tree of terrain.treeSpots) {
        const dz = tree.z - perch.z;
        const inFront = dz > -2 && dz < 8 && Math.abs(tree.x - perch.x) < 3.5;
        expect(inFront, `seed ${seed}: tree at ${tree.x},${tree.z}`).toBe(false);
      }
      const wolf = plan(seed, 10).find((m) => m.name === 'Wolf')!;
      for (const leg of wolf.legs) {
        for (const p of leg.path) {
          expect(Math.hypot(p.x - perch.x, p.z - perch.z)).toBeLessThan(perch.radius);
          expect(p.y).toBe(perch.y);
        }
      }
    }
    expect(ledges).toBeGreaterThanOrEqual(7);
  });

  it('are the same for the same seed, and a newcomer never moves the others', () => {
    expect(plan(3, LAST_STAGE)).toEqual(plan(3, LAST_STAGE));
    const all = demoAnimals('clearing', LAST_STAGE);
    const few = plan(3, LAST_STAGE, all.slice(0, 3));
    expect(few).toHaveLength(3);
    expect(plan(3, LAST_STAGE).slice(0, few.length)).toEqual(few);
  });

  it('move smoothly, through the end of their loop too', () => {
    const state = {} as AnimalState;
    for (const member of plan(7, LAST_STAGE)) {
      let last: { x: number; z: number; yaw: number } | null = null;
      for (let t = 0; t < member.period * 2; t += 0.05) {
        animalState(member, t, state);
        expect(state.blend).toBeGreaterThanOrEqual(0);
        expect(state.blend).toBeLessThanOrEqual(1);
        if (last) {
          expect(Math.hypot(state.x - last.x, state.z - last.z), member.name).toBeLessThan(0.1);
          const turn = Math.abs(
            Math.atan2(Math.sin(state.yaw - last.yaw), Math.cos(state.yaw - last.yaw)),
          );
          expect(turn, member.name).toBeLessThan(0.3);
        }
        last = { x: state.x, z: state.z, yaw: state.yaw };
      }
    }
  });

  it('jump and gallop a loop when touched, then go on with their day where they left it (#28)', () => {
    const terrain = createClearing(7, LAST_STAGE);
    const members = planHerd(terrain, demoAnimals('clearing', LAST_STAGE), 7);
    const herd = new Herd(createPlaceholderAnimals(), members, terrain);
    const camera = { x: 0, z: 80 };
    const state = {} as AnimalState;
    const where = (i: number) => {
      const { x, z } = herd.spots()[i];
      return { x, z };
    };
    // Touched while it walks.
    let start = 0;
    while (animalState(members[0], start, state).clip !== 'walk') start += 0.1;
    start += 0.2;
    herd.update(start);
    const before = where(0);
    const length = herd.react(0, start, camera);
    expect(herd.react(0, start + 0.5, camera)).toBe(0);
    const jump = ANIMALS[members[0].name].clips.jump;
    // Longer than a jump alone: there is room for its loop.
    expect(length).toBeGreaterThan(2 * 0.5 + jump + 1.2);
    // Still while it turns to the child and jumps.
    for (let t = start; t < start + 0.5 + jump; t += 0.1) {
      herd.update(t);
      expect(where(0).x).toBeCloseTo(before.x, 6);
      expect(where(0).z).toBeCloseTo(before.z, 6);
    }
    herd.update(start + 1);
    const yaw = herd.group.children[0].rotation.y;
    const towards = { x: camera.x - before.x, z: camera.z - before.z };
    const cos =
      (Math.sin(yaw) * towards.x + Math.cos(yaw) * towards.z) / Math.hypot(towards.x, towards.z);
    expect(cos).toBeGreaterThan(0.5);
    // Then a loop on the grass, back to where it jumped.
    let furthest = 0;
    for (let t = start + 0.5 + jump; t < start + length; t += 0.05) {
      herd.update(t);
      const { x, z } = where(0);
      furthest = Math.max(furthest, Math.hypot(x - before.x, z - before.z));
      expect(terrain.surfaceAt(x, z)?.kind).toBe('grass');
    }
    expect(furthest).toBeGreaterThan(1);
    herd.update(start + length - 0.01);
    expect(where(0).x).toBeCloseTo(before.x, 4);
    expect(where(0).z).toBeCloseTo(before.z, 4);
    // Its day goes on, late by the reaction; the others never stopped.
    herd.update(start + 20);
    animalState(members[0], start + 20 - length, state);
    expect(where(0).x).toBeCloseTo(state.x, 5);
    expect(where(0).z).toBeCloseTo(state.z, 5);
    animalState(members[1], start + 20, state);
    expect(where(1).x).toBeCloseTo(state.x, 5);
    expect(herd.react(0, start + 20, camera)).toBeGreaterThan(0);
  });

  it('mostly find room for their loop (#28)', () => {
    let runs = 0;
    let animals = 0;
    for (let seed = 0; seed < 6; seed++) {
      const terrain = createClearing(seed, LAST_STAGE);
      const members = planHerd(terrain, demoAnimals('clearing', LAST_STAGE), seed);
      const herd = new Herd(createPlaceholderAnimals(), members, terrain);
      members.forEach((member, i) => {
        herd.update(3);
        animals++;
        if (herd.react(i, 3, { x: 0, z: 80 }) > 2 * 0.5 + ANIMALS[member.name].clips.jump + 1.2) {
          runs++;
        }
      });
    }
    expect(runs / animals).toBeGreaterThan(0.6);
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

describe('clearing terrain', () => {
  it('plants trees on the ground, away from the water, at every stage', () => {
    for (let seed = 0; seed < 12; seed++) {
      for (const stage of STAGES) {
        const terrain = createClearing(seed, stage);
        const label = `seed ${seed}, stage ${stage}`;
        // Slots to choose from at the first stage already, and a large tree.
        expect(terrain.slots.length, label).toBeGreaterThanOrEqual(4);
        expect(terrain.treeSpots.filter((s) => s.role === 'hero').length, label).toBeGreaterThan(0);
        for (const spot of [...terrain.treeSpots, ...terrain.slots]) {
          const surface = terrain.surfaceAt(spot.x, spot.z);
          expect(surface, `${label}: spot at ${spot.x},${spot.z}`).not.toBeNull();
          expect(surface!.kind, `${label}: spot at ${spot.x},${spot.z}`).not.toBe('water');
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
      // One new thing at a time: a fall, the stream out of the lake (3), a stream with its pool;
      // the beavers' lake comes with the beavers, bought.
      expect(terrains.map((t) => t.waterfalls.length)).toEqual([
        0, 0, 1, 2, 3, 4, 4, 5, 6, 7, 7, 7,
      ]);
      expect(terrains.map((t) => t.ponds.length)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
      expect(createClearing(seed, LAST_STAGE, ['beavers']).ponds).toHaveLength(4);
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
      const { planting } = composeScene(
        scene(11, stage, 'summer'),
        placeholders,
        ambienceFor(stage, 'summer'),
        QUALITY.high,
      );
      // The grown trees: hidden ones wait in the slots offered to the child at that stage. The
      // islet's tree moves with the lake as it grows.
      const grown = planting.trees.filter((t) => t.age > 0 && !t.islet);
      return new Map(grown.map((t) => [`${t.x},${t.z}`, t]));
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

describe('slots and grand moments', () => {
  it('composes about 25 slots that never hide the water', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { layout, finalLake } = clearingLayout(seed);
      const slots = layout.slots;
      expect(slots, `seed ${seed}`).toHaveLength(SLOT_COUNT);
      expect(slots.filter((s) => s.kind === 'grove')).toHaveLength(5);
      slots.forEach((slot, i) => {
        const label = `seed ${seed}, slot ${i}`;
        expect(hidesWater(layout, finalLake, slot.x, slot.z), label).toBe(false);
        expect(dryness(layout, finalLake, slot.x, slot.z), label).toBeGreaterThanOrEqual(0.4);
        // Any set of filled slots keeps its elements apart.
        for (const other of slots.slice(i + 1)) {
          const reach = (slot.kind === 'tree' ? 4.2 : 3) + (other.kind === 'tree' ? 4.2 : 3);
          expect(Math.hypot(slot.x - other.x, slot.z - other.z), label).toBeGreaterThan(
            reach / 2 - 1e-6,
          );
        }
      });
      // The lake moment fits in the first diorama, away from the large trees.
      for (const [x, z] of layout.hero) {
        expect(Math.hypot(x - layout.basin.x, z - layout.basin.z)).toBeGreaterThan(
          layout.basin.radius + 1,
        );
      }
      expect(
        rimValue(layout, { hx: 13.5, hz: 10.5, cz: 1 }, layout.basin.x, layout.basin.z),
      ).toBeLessThan(0.85);
    }
  });

  it('fills the slots in a stable order, so a filled slot stays filled', () => {
    const slots = (seed: number, fill: number) =>
      new Set(demoElements(seed, fill).map((element) => element.slot));
    for (const seed of [1, 7, 30]) {
      let before = slots(seed, 0);
      expect(before.size).toBe(0);
      for (const fill of [0.2, 0.5, 0.55, 1]) {
        const after = slots(seed, fill);
        expect(after.size).toBe(Math.round(fill * SLOT_COUNT));
        for (const slot of before) expect(after.has(slot)).toBe(true);
        before = after;
      }
    }
  });

  it('replays a painting from its compact description (300 seeds, 24 scenes)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const stage = STAGES[seed % STAGES.length];
      const rng = new Rng(seed);
      const description = scene(seed, stage, 'spring', {
        elements: demoElements(seed, rng.next()).map((e) => ({ ...e, day: 20_400 + seed })),
      });
      const json = JSON.stringify(description);
      expect(json.length).toBeLessThan(2048);
      const replayed = readDescription(JSON.parse(json));
      expect(replayed).toEqual(description);
      // Building the terrain is slow: the planting itself on a sample of seeds.
      if (seed % 12 !== 0 && seed % 12 !== 7) continue;
      const terrain = createClearing(seed, stage);
      const ambience = ambienceFor(stage, 'spring');
      expect(plantTrees(terrain, replayed!, ambience)).toEqual(
        plantTrees(terrain, description, ambience),
      );
    }
  });

  it('refuses a description out of place', () => {
    const valid = scene(3, 2, 'autumn', { elements: [{ slot: 4, day: 1 }] });
    expect(readDescription(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
    for (const broken of [
      null,
      { ...valid, stage: 12 },
      { ...valid, season: 'monsoon' },
      { ...valid, seed: -1 },
      { ...valid, elements: [{ slot: MAX_ELEMENTS, day: 1 }] },
      {
        ...valid,
        elements: [
          { slot: 1, day: 1 },
          { slot: 1, day: 2 },
        ],
      },
      { ...valid, elements: [{ slot: 1.5, day: 1 }] },
      { ...valid, elements: undefined },
      { ...valid, animals: undefined },
      { ...valid, animals: ['Bear'] },
      { ...valid, animals: ['Fox', 'Fox'] },
      { ...valid, animals: ['Deer', 'Deer', 'Deer'] },
      { ...valid, seasons: undefined },
      { ...valid, seasons: [] },
      { ...valid, seasons: ['summer'] },
      { ...valid, seasons: ['autumn', 'monsoon'] },
      { ...valid, seasons: ['autumn', 'winter', 'autumn'] },
      { ...valid, night: undefined },
      { ...valid, night: 'dusk' },
      { ...valid, rares: ['unicorn'] },
      { ...valid, rares: ['rainbow', 'rainbow'] },
      { ...valid, rares: 'rainbow' },
      { ...valid, biome: 'sky', rares: ['beavers'] },
    ]) {
      expect(readDescription(broken), JSON.stringify(broken)).toBeNull();
    }
    const twoDeer = { ...valid, animals: ['Deer', 'Wolf', 'Deer'] };
    expect(readDescription(JSON.parse(JSON.stringify(twoDeer)))).toEqual(twoDeer);
    const bought = { ...valid, seasons: ['spring', 'summer', 'autumn'] };
    expect(readDescription(JSON.parse(JSON.stringify(bought)))).toEqual(bought);
    const night = { ...valid, night: 'shown' };
    expect(readDescription(JSON.parse(JSON.stringify(night)))).toEqual(night);
    const rares = { ...valid, rares: ['beavers', 'fireflies'] };
    expect(readDescription(JSON.parse(JSON.stringify(rares)))).toEqual(rares);
    // Paintings kept before the rare elements (#46) have none.
    const before = { ...valid, rares: undefined };
    expect(readDescription(JSON.parse(JSON.stringify(before)))).toEqual({ ...valid, rares: [] });
  });

  it('shows each rare element only once bought, from the stage it is sold (#46)', () => {
    for (const biome of BIOME_IDS) {
      for (const { rare, stage } of RARE_OFFERS[biome]) {
        const label = `${biome} ${rare}`;
        const without = ambienceFor(stage, 'summer', BIOMES[biome]);
        const bought = ambienceFor(stage, 'summer', BIOMES[biome], false, [rare]);
        const terrain = BIOMES[biome].terrain(3, stage, [rare]);
        if (rare === 'fireflies') {
          expect([without.fireflies, bought.fireflies], label).toEqual([0, 1]);
        } else if (rare === 'rainbow') {
          expect([without.rainbow, bought.rainbow], label).toEqual([0, 1]);
          // Over the widest fall landing in water: there must be one.
          expect(
            terrain.waterfalls.some((fall) => fall.splash),
            label,
          ).toBe(true);
        } else {
          expect(BIOMES[biome].terrain(3, stage, []).dam, label).toBeNull();
          expect(terrain.dam, label).not.toBeNull();
        }
      }
    }
  });

  it('shows the night as a fifth choice, over the plants of the season (#85)', () => {
    const summer = scene(3, 6, 'summer');
    expect(choicesOf(summer)).toEqual(['summer']);
    expect(isBought(summer, 'night')).toBe(false);
    const night = choose(summer, 'night');
    expect(night).toMatchObject({ season: 'summer', seasons: ['summer'], night: 'shown' });
    expect(shownChoice(night)).toBe('night');
    expect(isBought(night, 'night')).toBe(true);
    // Autumn bought at night: the day comes back with autumn, the night stays to choose.
    const autumn = choose(night, 'autumn');
    expect(autumn).toMatchObject({ season: 'autumn', seasons: ['summer', 'autumn'] });
    expect(autumn.night).toBe('owned');
    expect(choicesOf(autumn)).toEqual(['summer', 'autumn', 'night']);
    expect(shownChoice(choose(autumn, 'night'))).toBe('night');
    expect(choose(autumn, 'night').season).toBe('autumn');
    expect(choose(summer, 'autumn').night).toBe('none');
  });

  it('changes only the light, the life and the sound at night (#85)', () => {
    for (const season of SEASONS) {
      const day = ambienceFor(6, season);
      const night = ambienceFor(6, season, undefined, true);
      expect(night.night).toBe(true);
      const plants = (a: typeof day) => [
        a.grass,
        a.flowers,
        a.bushes,
        a.mushrooms,
        a.lilies,
        a.deadwood,
        a.edgeTrees,
        a.edgeAge,
      ];
      expect(plants(night)).toEqual(plants(day));
      const brightness = (color: number) => (color >> 16) + ((color >> 8) & 255) + (color & 255);
      expect(brightness(night.sky.zenith)).toBeLessThan(brightness(day.sky.zenith) / 2);
      expect(night.sun.intensity).toBeLessThan(day.sun.intensity);
      // A blue veil over the colours, softer shadows.
      expect([day.veil, night.veil > 0]).toEqual([0, true]);
      expect(night.shadow.strength).toBeLessThan(day.shadow.strength);
      expect(night.shadow.blur).toBeGreaterThan(day.shadow.blur);
      expect([night.butterflies, night.birds, night.sunRays, night.rainbow]).toEqual([0, 0, 0, 0]);
      if (season !== 'winter') expect(night.fireflies).toBeGreaterThan(0);
      expect(night.sound.songs + night.sound.birds + night.sound.cuckoo).toBe(0);
      expect(night.sound.owl).toBeGreaterThan(0);
    }
  });

  it('moves nothing when the night falls (#85)', () => {
    for (const seed of [2, 9]) {
      const description = scene(seed, LAST_STAGE, 'summer');
      const composed = (night: boolean) =>
        composeScene(
          { ...description, night: night ? 'shown' : 'none' },
          placeholders,
          ambienceFor(LAST_STAGE, 'summer', undefined, night),
          QUALITY.high,
        );
      const [day, night] = [composed(false), composed(true)];
      const items = (c: typeof day) =>
        (c.batch as unknown as { items: Map<string, number[]> }).items;
      expect(items(night)).toEqual(items(day));
      expect(night.planting.trees).toEqual(day.planting.trees);
    }
  });

  it('moves no tree and no animal when the child changes the season (#82)', () => {
    for (const seed of [2, 9]) {
      const terrain = createClearing(seed, LAST_STAGE);
      const plans = SEASONS.map((season) => {
        const description = scene(seed, LAST_STAGE, season);
        return {
          trees: plantTrees(terrain, description, ambienceFor(LAST_STAGE, season)),
          herd: planHerd(terrain, description.animals, seed),
        };
      });
      for (const plan of plans.slice(1)) expect(plan).toEqual(plans[0]);
    }
  });

  it('plants the filled slots and keeps the candidate ones ready to grow', () => {
    const composed = (fill: number) => {
      const description = scene(5, 6, 'summer', { fill });
      const composition = composeScene(
        description,
        placeholders,
        ambienceFor(6, 'summer'),
        QUALITY.high,
      );
      return { ...composition, candidates: candidateSlots(composition.terrain, description) };
    };
    const empty = composed(0);
    const full = composed(1);
    // Three free slots offered, each waiting with a hidden tree or grove, ready to grow.
    expect(empty.candidates).toHaveLength(3);
    for (const slot of empty.candidates) {
      const tree = empty.planting.slotTrees.get(slot);
      if (tree === undefined) expect(empty.population.groves.has(slot)).toBe(true);
      else expect(empty.planting.trees[tree].age).toBe(0);
    }
    expect(empty.planting.trees.filter((t) => t.slot !== undefined && t.age > 0)).toEqual([]);
    // Every open slot is filled: nothing to offer, nothing hidden.
    expect(full.candidates).toEqual([]);
    const grown = full.planting.demo.filter((i) => full.planting.trees[i].age > 0);
    expect(grown.length).toBe(full.planting.demo.length);
    expect(grown.length).toBeGreaterThan(5);
  });

  it('passes the stages with the elements placed, always leaving slots to choose from', () => {
    expect([0, 1, 2, 3, 4, 5, 19, 21, 22].map(stageFor)).toEqual([0, 1, 2, 3, 3, 4, 11, 11, 11]);
    for (let seed = 0; seed < 16; seed++) {
      const open = STAGES.map((stage) => createClearing(seed, stage).slots.length);
      for (let placed = 0; placed < MAX_ELEMENTS; placed++) {
        const free = open[stageFor(placed)] - placed;
        expect(free, `seed ${seed}, ${placed} placed`).toBeGreaterThanOrEqual(
          Math.min(2, MAX_ELEMENTS - placed),
        );
      }
    }
  });

  it('places an element without moving anything else', () => {
    for (const seed of [2, 7]) {
      const before = scene(seed, 6, 'summer', { fill: 0.3 });
      const composed = (description: SceneDescription) =>
        composeScene(description, placeholders, ambienceFor(6, 'summer'), QUALITY.high);
      const a = composed(before);
      const slot = candidateSlots(a.terrain, before)[1];
      const b = composed({ ...before, elements: [...before.elements, { slot, day: 1 }] });
      // The instances, without those of the groves of the child.
      const scatter = (c: typeof a) => {
        const items = (c.batch as unknown as { items: Map<string, number[]> }).items;
        const own = new Set(
          [...c.population.groves.values()].flat().map((p) => `${p.model}#${p.index}`),
        );
        return [...items].flatMap(([model, list]) =>
          Array.from({ length: list.length / 9 }, (_, i) => i)
            .filter((i) => !own.has(`${model}#${i}`))
            .map((i) => `${model} ${list.slice(i * 9, i * 9 + 7).join(' ')}`),
        );
      };
      expect(scatter(b).sort(), `seed ${seed}`).toEqual(scatter(a).sort());
      const others = (c: typeof a) => c.planting.trees.filter((t) => t.slot === undefined);
      expect(others(b)).toEqual(others(a));
    }
  });

  it('grows a tree of the child with every element placed after it', () => {
    const elements = Array.from({ length: 8 }, (_, slot) => ({ slot, day: 0 }));
    const ages = (count: number) =>
      childTreeAge({ ...scene(3, 0, 'summer'), elements: elements.slice(0, count) }, 0);
    expect(ages(0)).toBe(0);
    expect(ages(1)).toBeGreaterThanOrEqual(0.5);
    for (let count = 2; count <= 6; count++) expect(ages(count)).toBeGreaterThan(ages(count - 1));
    expect(ages(8)).toBe(1);
  });

  it("fills the beavers' lake once bought, with sparkles over the hollow while sold", () => {
    const lake = lakeStage();
    for (let seed = 0; seed < 12; seed++) {
      const label = `seed ${seed}`;
      const { layout } = clearingLayout(seed);
      const m = layout.mirror;
      // A dry sandy hollow from the first diorama, nothing announced yet.
      const first = createClearing(seed, 0);
      const hollow = basinAt(layout.basin, 0);
      expect(first.surfaceAt(hollow.x * m, hollow.z)?.kind, label).toBe('sand');
      expect(first.announcements, label).toEqual([]);
      expect(createClearing(seed, (lake - 1) as Stage).announcements, label).toEqual([]);

      for (const stage of [lake, LAST_STAGE]) {
        const sold = createClearing(seed, stage);
        expect(
          sold.announcements.map((a) => a.label),
          label,
        ).toEqual(['lake']);
        expect(sold.dam, label).toBeNull();
      }
      const filled = createClearing(seed, lake, ['beavers']);
      expect(filled.announcements, label).toEqual([]);
      const center = basinAt(layout.basin, lake / LAST_STAGE);
      const islet = filled.treeSpots.find((s) => s.role === 'islet')!;
      expect(filled.surfaceAt(islet.x, islet.z)?.kind, label).toBe('grass');
      const [cx, cz] = [center.x * m, center.z];
      const [wx, wz] = [cx + (cx - islet.x) * 1.5, cz + (cz - islet.z) * 1.5];
      expect(filled.surfaceAt(wx, wz)?.kind, label).toBe('water');
    }
  });

  it('brings the far chain out of the haze at its stage, announced the stage before', () => {
    const reveals = STAGES.map((stage) => createClearing(3, stage).chain);
    const shown = reveals.indexOf('shown');
    expect(shown).toBeGreaterThan(1);
    expect(reveals.slice(0, shown - 1).every((r) => r === 'waiting')).toBe(true);
    expect(reveals[shown - 1]).toBe('announced');
    expect(reveals.slice(shown).every((r) => r === 'shown')).toBe(true);
    // One axis of progress: the lake comes later, once the chain is there.
    expect(lakeStage()).toBeGreaterThan(shown);
  });

  it("runs the east stream through the beavers' lake, held by a dam once filled", () => {
    const lakeAt = lakeStage();
    for (let seed = 0; seed < 12; seed++) {
      const label = `seed ${seed}`;
      const { layout } = clearingLayout(seed);
      const m = layout.mirror;
      const { basin, eastPath, eastInlet, mainPath } = layout;
      const inlet = eastPath[eastInlet];
      expect(Math.hypot(inlet[0] - basin.x, inlet[1] - basin.z), label).toBeLessThan(1e-6);
      const mouth = eastPath[eastPath.length - 1];
      expect(distanceToPath(mainPath, mouth[0], mouth[1]).distance, label).toBeLessThan(0.01);
      // Before the beavers, the stream already crosses the dry hollow; nothing holds it back.
      const before = createClearing(seed, lakeAt);
      expect(before.surfaceAt(basin.x * m, basin.z)?.kind, label).toBe('water');
      expect(before.dam, label).toBeNull();
      // Then the dam stands on the outlet, at the bank of the lake.
      const lake = basinAt(basin, lakeAt / LAST_STAGE);
      const dam = createClearing(seed, lakeAt, ['beavers']).dam!;
      expect(dam, label).not.toBeNull();
      expect(Math.hypot(dam.x * m - lake.x, dam.z - lake.z) - lake.radius, label).toBeLessThan(1);
      expect(distanceToPath(eastPath, dam.x * m, dam.z).distance, label).toBeLessThan(0.01);
    }
  });

  it('heaps large logs on the dam, and lays fallen logs and stumps on the grass', () => {
    const compose = (seed: number, stage: Stage, season: Season) =>
      composeScene(
        scene(seed, stage, season),
        placeholders,
        ambienceFor(stage, season),
        QUALITY.high,
      );
    const at = (batch: InstanceBatch, model: string) => {
      const list = batch['items'].get(model as InstanceModel) ?? [];
      return Array.from({ length: list.length / 9 }, (_, i) => ({
        x: list[i * 9],
        z: list[i * 9 + 2],
      }));
    };
    const deadwood = ['Log_Moss', 'Stump', 'Stump_Moss'];
    const lake = lakeStage();
    for (const seed of [3, 7, 11]) {
      const label = `seed ${seed}`;
      for (const season of ['summer', 'winter'] as const) {
        const { batch, terrain } = compose(seed, lake, season);
        const dam = terrain.dam!;
        const logs = at(batch, season === 'winter' ? 'Log_Snow' : 'Log');
        const onDam = logs.filter((l) => Math.hypot(l.x - dam.x, l.z - dam.z) < dam.width * 0.35);
        expect(onDam, `${label} ${season}`).toHaveLength(3);
      }
      // The first stage has no wood lying around yet.
      const first = compose(seed, 0, 'summer').batch;
      expect(
        [...deadwood, 'Log'].flatMap((m) => at(first, m)),
        label,
      ).toEqual([]);
      const { batch, terrain } = compose(seed, LAST_STAGE, 'summer');
      const dam = terrain.dam!;
      const lying = [...deadwood, 'Log']
        .flatMap((m) => at(batch, m))
        .filter((p) => Math.hypot(p.x - dam.x, p.z - dam.z) > dam.width * 0.35);
      expect(lying.length, label).toBeGreaterThan(3);
      for (const p of lying) expect(terrain.surfaceAt(p.x, p.z)?.kind, label).toBe('grass');
    }
  });

  it('makes the lake moment larger than the lake of the cascade', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { layout, finalLake } = clearingLayout(seed);
      expect(basinAt(layout.basin, 1).radius, `seed ${seed}`).toBeGreaterThan(finalLake * 1.1);
    }
  });
});
