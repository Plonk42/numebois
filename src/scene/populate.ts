import { hashSeed, Rng, valueNoise2 } from '../core/rng';
import type { ModelName } from './asset-catalog';
import { MODELS } from './assets.gen';
import { swatchColumn, swatchUV, type SwatchName } from './atlas';
import type { SceneDescription } from './description';
import { MeshWriter, type MeshData } from './mesh-data';
import { beaverDam, GENERATED_PROPS } from './props';
import type { InstanceBatch, InstanceModel } from './render/instancing';
import type { QualitySettings } from './render/quality';
import type { Ambience } from './render/richness';
import { groundSwatch } from './terrain/clearing';
import type { CropRow, Terrain } from './terrain/types';
import type { Season } from './trees/builder';
import type { FamilyName } from './trees/families';
import type { PlantedTree } from './trees/forest';

const TAU = Math.PI * 2;

const EDGE_FAMILIES: readonly FamilyName[] = ['Round', 'Cube', 'Birch', 'Round', 'Cube'];
/** Seen from far away, only the simplest shapes read well. */
export const FAR_FAMILIES: readonly FamilyName[] = ['Round', 'Cube'];
const CLEARING_FAMILIES: readonly FamilyName[] = [
  'Round',
  'Cube',
  'Umbrella',
  'Birch',
  'Gnarly',
  'Round',
  'Pine',
  'Cube',
  'Umbrella',
];
const HERO_FAMILIES: readonly FamilyName[] = ['Gnarly', 'Umbrella', 'Round', 'Cube', 'Birch'];
const FAVOURITES: readonly FamilyName[] = ['Round', 'Cube', 'Birch', 'Umbrella'];
/** Slots offered at most for the next element. */
const CANDIDATES = 3;
/** Age of a new tree of the child, and elements placed after it until it is adult. */
const NEW_TREE_AGE = 0.5;
const GROWN_AFTER = 5;

/** Character of the vegetation of a painting, drawn from its seed. */
interface Flora {
  edge: readonly FamilyName[];
  favourite: FamilyName;
  /** Shift of the family lists, so two seeds do not plant the same sequence. */
  shift: number;
  flower: FlowerKind;
  petal: SwatchName;
}

function floraOf(seed: number): Flora {
  const rng = new Rng(seed).fork('flora');
  const favourite = rng.pick(FAVOURITES);
  const flower = rng.pick(FLOWERS);
  return {
    // Umbrellas are too heavy for the many trees of the edge.
    edge: EDGE_FAMILIES.includes(favourite)
      ? [...EDGE_FAMILIES, favourite, favourite, favourite]
      : EDGE_FAMILIES,
    favourite,
    shift: rng.int(0, 8),
    flower,
    petal: rng.pick(flower.colors),
  };
}

export interface Planting {
  trees: PlantedTree[];
  /** Indices of the trees used by the growth demonstration: the hidden ones first. */
  demo: number[];
  /** Tree of each slot of the child holding one, grown or waiting hidden. */
  slotTrees: Map<number, number>;
}

/** Slots holding an element placed by the child. */
function filledSlots(description: SceneDescription): ReadonlySet<number> {
  return new Set(description.elements.map((element) => element.slot));
}

/**
 * Free slots offered for the next element, prepared hidden in the painting: the first to
 * open, and others spread over the open ones. Empty once the painting is complete.
 */
export function candidateSlots(terrain: Terrain, description: SceneDescription): number[] {
  const filled = filledSlots(description);
  const free = terrain.slots.filter((slot) => !filled.has(slot.index)).map((s) => s.index);
  if (free.length <= CANDIDATES) return free;
  return [free[0], free[Math.floor((free.length - 1) / 2)], free[free.length - 1]];
}

/** Age of the tree of a slot: young when placed, adult a few elements later. */
export function childTreeAge(description: SceneDescription, slot: number): number {
  const { elements } = description;
  const rank = elements.findIndex((element) => element.slot === slot);
  if (rank < 0) return 0;
  const since = elements.length - 1 - rank;
  return NEW_TREE_AGE + (1 - NEW_TREE_AGE) * Math.min(1, since / GROWN_AFTER);
}

/** Trees of the painting for its stage: the forest, the large trees, the tree slots. */
export function plantTrees(
  terrain: Terrain,
  description: SceneDescription,
  ambience: Ambience,
): Planting {
  const trees: PlantedTree[] = [];
  const flora = floraOf(description.seed);
  const place = (x: number, z: number) => {
    // Numbers drawn from the place itself, so a tree keeps its shape from stage to stage.
    const rng = new Rng(
      hashSeed(description.seed, `tree:${Math.round(x * 8)}:${Math.round(z * 8)}`),
    );
    const seed = rng.int(1, 1e9);
    const yaw = rng.range(0, TAU);
    const surface = terrain.surfaceAt(x, z);
    if (!surface) return null;
    // On a slope, the foot of the trunk stays in the ground.
    const y = surface.y - 0.05 - 0.4 * surface.slope;
    return { seed, x, y, z, yaw, pick: rng.next(), ageDraw: rng.next() };
  };
  const plant = (
    at: NonNullable<ReturnType<typeof place>>,
    family: FamilyName,
    size: number,
    rest: Pick<PlantedTree, 'detail' | 'age' | 'islet' | 'slot' | 'foliage' | 'fruit'>,
  ) => {
    const { seed, x, y, z, yaw } = at;
    trees.push({
      family,
      seed,
      x,
      y,
      z,
      yaw,
      scale: size * (family === 'Pine' ? 1.25 : 1),
      ...rest,
    });
  };

  for (const spot of terrain.treeSpots) {
    const at = place(spot.x, spot.z);
    if (!at) continue;
    if (spot.role === 'edge') {
      if (spot.rank !== undefined && spot.rank >= ambience.edgeTrees) continue;
      const detail = spot.detail ?? 'light';
      const families = detail === 'far' ? FAR_FAMILIES : flora.edge;
      const [young, old] = ambience.edgeAge;
      plant(
        at,
        spot.family ?? (spot.conifer ? 'Pine' : families[Math.floor(at.pick * families.length)]),
        spot.size,
        {
          detail,
          age: young + (old - young) * at.ageDraw,
          foliage: spot.foliage,
          fruit: spot.fruit,
        },
      );
    } else if (spot.role === 'hero') {
      const family =
        spot.family ?? HERO_FAMILIES[((spot.slot ?? 0) + flora.shift) % HERO_FAMILIES.length];
      plant(at, family, spot.size, {
        detail: spot.detail ?? 'full',
        age: Math.max(ambience.edgeAge[0], 0.85),
        foliage: spot.foliage,
        fruit: spot.fruit,
      });
    } else {
      plant(at, flora.favourite, spot.size, {
        detail: spot.detail ?? 'light',
        age: 0.9,
        islet: true,
      });
    }
  }

  // The child's trees: grown in the filled slots, waiting hidden in the candidate ones.
  const filled = filledSlots(description);
  const candidates = new Set(candidateSlots(terrain, description));
  const hidden: number[] = [];
  const grown: number[] = [];
  const slotTrees = new Map<number, number>();
  for (const slot of terrain.slots) {
    if (slot.kind !== 'tree') continue;
    if (!filled.has(slot.index) && !candidates.has(slot.index)) continue;
    const at = place(slot.x, slot.z);
    if (!at) continue;
    const family =
      slot.family ??
      (slot.index % 3 === 1
        ? flora.favourite
        : CLEARING_FAMILIES[(slot.index + flora.shift) % CLEARING_FAMILIES.length]);
    const age = childTreeAge(description, slot.index);
    (age > 0 ? grown : hidden).push(trees.length);
    slotTrees.set(slot.index, trees.length);
    plant(at, family, slot.size, {
      detail: slot.detail,
      age,
      slot: slot.index,
      foliage: slot.foliage,
      fruit: slot.fruit,
    });
  }
  return { trees, demo: [...hidden, ...grown], slotTrees };
}

function leafColumns(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Spring'];
    case 'summer':
      return ['Summer'];
    case 'autumn':
      return ['Gold', 'Orange', 'Brown', 'Gold', 'Summer'];
    case 'winter':
      return ['Snow'];
  }
}

function bushColumns(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Spring', 'Blossom', 'Spring', 'Blossom'];
    case 'summer':
      return ['Summer'];
    case 'autumn':
      return ['Orange', 'Red', 'Gold', 'Summer'];
    case 'winter':
      return ['Snow'];
  }
}

interface FlowerKind {
  model: InstanceModel;
  colors: readonly SwatchName[];
}

const FLOWERS: readonly FlowerKind[] = [
  { model: 'gen:daisy', colors: ['PetalWhite', 'PetalWhite', 'PetalYellow', 'PetalPink'] },
  { model: 'gen:tulip', colors: ['PetalRed', 'PetalYellow', 'PetalPink', 'PetalViolet'] },
  { model: 'gen:bellflower', colors: ['PetalViolet', 'PetalBlue', 'PetalPink'] },
];

/** Half length of a fallen log at scale 1 (the model lies along z). */
const LOG_HALF_LENGTH = MODELS.Log.max[2];

const DEADWOOD: Record<'woods' | 'meadow' | 'winter', { log: ModelName; stump: ModelName }> = {
  woods: { log: 'Log_Moss', stump: 'Stump_Moss' },
  meadow: { log: 'Log', stump: 'Stump' },
  winter: { log: 'Log_Snow', stump: 'Stump_Snow' },
};

/**
 * Large logs across the beaver dam, in its frame and in dam widths: x across the flow,
 * z downstream, y above its base; turn is the angle off the dam line.
 */
const DAM_LOGS: readonly { x: number; y: number; z: number; turn: number; scale: number }[] = [
  { x: -0.2, y: 0.15, z: -0.04, turn: 0.35, scale: 0.85 },
  { x: 0.2, y: 0.15, z: 0.03, turn: -0.4, scale: 0.8 },
  { x: 0.0, y: 0.22, z: -0.01, turn: 0.06, scale: 0.95 },
];

/** Dark disc of the ground colour: contact shadow of the low quality tier. */
function contactShadow(season: Season): MeshData {
  const out = new MeshWriter(16, 32);
  const ground = groundSwatch(season);
  const uv = swatchUV(ground.swatch, ground.to);
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * TAU;
    const a1 = ((i + 1) / 10) * TAU;
    out.facet([0, 0, 0], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)], uv);
  }
  return out.toMeshData();
}

export interface Population {
  /** Centres of the flower drifts, for the butterflies. */
  flowerSpots: { x: number; y: number; z: number }[];
  /** Instances of each grove, filled or waiting hidden in a candidate slot, by slot. */
  groves: Map<number, { model: InstanceModel; index: number }[]>;
}

/**
 * Bushes, grass, flowers, mushrooms, rocks and lilies, placed by the code as instances.
 * Densities follow the richness stage and the quality tier.
 */
export function scatterVegetation(
  batch: InstanceBatch,
  terrain: Terrain,
  description: SceneDescription,
  ambience: Ambience,
  quality: QualitySettings,
  trees: readonly PlantedTree[],
): Population {
  // Numbers drawn for each item, so the lake only changes the items it touches.
  const draw = (label: string, index: number) =>
    new Rng(hashSeed(description.seed, `scatter:${label}:${index}`));
  const season = description.season;
  for (const [name, make] of Object.entries(GENERATED_PROPS)) {
    batch.register(name as keyof typeof GENERATED_PROPS, make());
  }
  batch.register('gen:shadow', contactShadow(season));

  const blocked: { x: number; z: number; r: number }[] = [];
  // Every open slot keeps its room, filled or not: what the child places moves nothing else.
  for (const tree of trees) {
    if (tree.slot === undefined)
      blocked.push({ x: tree.x, z: tree.z, r: tree.age > 0 ? 0.9 : 1.4 });
  }
  for (const slot of terrain.slots) {
    blocked.push({ x: slot.x, z: slot.z, r: slot.kind === 'tree' ? 1.4 : 1.6 });
  }
  for (const model of terrain.staticModels)
    blocked.push({ x: model.x, z: model.z, r: 1.3 * model.scale });
  const free = (x: number, z: number, r: number) =>
    !blocked.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r);
  const col = (rng: Rng, names: readonly SwatchName[]) => swatchColumn(rng.pick(names));
  const leaves = leafColumns(season);
  const flora = floraOf(description.seed);
  const flowerSpots: Population['flowerSpots'] = [];

  if (terrain.dam) {
    const { x, y, z, yaw, width } = terrain.dam;
    batch.register('gen:dam', beaverDam());
    batch.add('gen:dam', x, y, z, yaw, width);
    blocked.push({ x, z, r: width * 0.55 });
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const log of DAM_LOGS) {
      const lx = log.x * width;
      const lz = log.z * width;
      batch.add(
        season === 'winter' ? 'Log_Snow' : 'Log',
        x + lx * c + lz * s,
        y + log.y * width,
        z - lx * s + lz * c,
        yaw + Math.PI / 2 + log.turn,
        log.scale,
      );
    }
  }

  // Groves of the filled slots: a large bush, two small ones and the painting's flowers;
  // those of the candidate slots wait hidden.
  const filled = filledSlots(description);
  const candidates = new Set(candidateSlots(terrain, description));
  const groves: Population['groves'] = new Map();
  for (const slot of terrain.slots) {
    if (slot.kind !== 'grove') continue;
    if (!filled.has(slot.index) && !candidates.has(slot.index)) continue;
    const center = terrain.surfaceAt(slot.x, slot.z);
    if (!center) continue;
    const pieces: { model: InstanceModel; index: number }[] = [];
    const add: typeof batch.add = (model, ...rest) => {
      pieces.push({ model, index: batch.count(model) });
      batch.add(model, ...rest);
    };
    groves.set(slot.index, pieces);
    const rng = draw('grove', slot.index);
    const turn = rng.range(0, TAU);
    const bushes: [ModelName, number, number][] = [
      ['Bush_1_B', 0.3, 1.9],
      ['Bush_4_D', 1.3, 1.1],
      ['Bush_2_D', 1.2, 1.0],
    ];
    bushes.forEach(([model, d, scale], i) => {
      const a = turn + (i * TAU) / 3;
      const x = slot.x + Math.cos(a) * d;
      const z = slot.z + Math.sin(a) * d;
      const surface = terrain.surfaceAt(x, z);
      if (!surface) return;
      const s = scale * slot.size;
      add(model, x, surface.y - 0.05, z, rng.range(0, TAU), s, s, col(rng, bushColumns(season)));
    });
    if (season === 'winter') continue;
    if (filled.has(slot.index)) flowerSpots.push({ x: slot.x, y: center.y, z: slot.z });
    for (let i = 0; i < 9; i++) {
      const a = turn + Math.PI / 3 + rng.range(-1.1, 1.1);
      const d = rng.range(1.5, 2.3);
      const x = slot.x + Math.cos(a) * d;
      const z = slot.z + Math.sin(a) * d;
      const surface = terrain.surfaceAt(x, z);
      if (surface?.kind !== 'grass') continue;
      const scale = rng.range(1.6, 2.2);
      add(
        flora.flower.model,
        x,
        surface.y - 0.02,
        z,
        rng.range(0, TAU),
        scale,
        scale,
        col(rng, leaves),
        swatchColumn(flora.petal),
      );
    }
  }
  const cover = quality.groundCover * terrain.cover;
  // Along the water, a larger diorama is dressed more sparsely.
  const bankStep = 0.9 * Math.max(1, terrain.cover);

  const CROPS = {
    tulip: { model: 'gen:tulip', step: 0.8, scale: [2.0, 2.5] },
    lavender: { model: 'gen:bellflower', step: 0.75, scale: [2.2, 2.8] },
    wheat: { model: 'Grass_1_A', step: 0.8, scale: [0.9, 1.15] },
  } as const satisfies Record<
    CropRow['crop'],
    { model: InstanceModel; step: number; scale: readonly [number, number] }
  >;
  // Cultivated strips: flowers or wheat in rows, a little irregular; bare under the snow.
  for (const [index, row] of season === 'winter' ? [] : terrain.crops.entries()) {
    const crop = CROPS[row.crop];
    const rng = draw('crop', index);
    for (let i = 0; i + 1 < row.points.length; i++) {
      const a = row.points[i];
      const b = row.points[i + 1];
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / crop.step));
      for (let s = 0; s < steps; s++) {
        const t = (s + rng.range(0.3, 0.7)) / steps;
        const x = a.x + (b.x - a.x) * t + rng.range(-0.1, 0.1);
        const z = a.z + (b.z - a.z) * t + rng.range(-0.1, 0.1);
        const surface = terrain.surfaceAt(x, z);
        if (surface?.kind !== 'field') continue;
        const scale = rng.range(crop.scale[0], crop.scale[1]);
        batch.add(
          crop.model,
          x,
          surface.y - 0.03,
          z,
          rng.range(0, TAU),
          scale,
          scale * (row.crop === 'wheat' ? 1.4 : 1),
          swatchColumn(row.crop === 'wheat' ? 'Gold' : rng.pick(leaves)),
          swatchColumn(row.petal),
        );
      }
    }
  }

  // Banks: small rocks and tall grass along the water.
  const reed: ModelName[] = ['Grass_2_A', 'Grass_2_A', 'Grass_2_A', 'Grass_2_A', 'Grass_2_B'];
  const pebbles: ModelName[] = ['Rock_3_E', 'Rock_1_A', 'Rock_2_C'];
  for (const [index, bank] of terrain.banks.entries()) {
    for (let i = 0; i + 1 < bank.points.length; i++) {
      const rng = draw(`bank${index}`, i);
      const a = bank.points[i];
      const b = bank.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const sx = -(b.z - a.z) / len;
      const sz = (b.x - a.x) / len;
      const steps = Math.max(1, Math.round(len / bankStep));
      for (let s = 0; s < steps; s++) {
        const t = (s + rng.next()) / steps;
        const cx = a.x + (b.x - a.x) * t;
        const cz = a.z + (b.z - a.z) * t;
        for (const side of [-1, 1]) {
          if (rng.chance(0.3)) {
            const d = bank.halfWidth + rng.range(0.05, 0.75);
            const x = cx + sx * d * side;
            const z = cz + sz * d * side;
            const surface = terrain.surfaceAt(x, z);
            if (surface && surface.kind !== 'water' && free(x, z, 0.3)) {
              const model = rng.pick(pebbles);
              const scale = model === 'Rock_2_C' ? rng.range(0.3, 0.55) : rng.range(0.55, 1.05);
              const sink = model === 'Rock_3_E' ? -0.05 : 0.08;
              batch.add(model, x, surface.y - sink * scale, z, rng.range(0, TAU), scale);
            }
          }
          if (rng.chance(0.5 * Math.min(1, ambience.grass + 0.35))) {
            const d = bank.halfWidth + rng.range(0.25, 1.2);
            const x = cx + sx * d * side;
            const z = cz + sz * d * side;
            const surface = terrain.surfaceAt(x, z);
            if (surface && surface.kind !== 'water' && surface.kind !== 'rock' && free(x, z, 0.2)) {
              const scale = rng.range(1.1, 1.8);
              batch.add(
                rng.pick(reed),
                x,
                surface.y - 0.03,
                z,
                rng.range(0, TAU),
                scale,
                scale,
                col(rng, leaves),
              );
            }
          }
        }
      }
    }
  }

  const sample = (rng: Rng): { x: number; z: number } => ({
    x: rng.range(-terrain.extent.x, terrain.extent.x),
    z: rng.range(-terrain.extent.z, terrain.extent.z),
  });

  // Grass tufts, in patches. Light tufts only (44 triangles): the meadow is large.
  const grassModels: ModelName[] = [
    'Grass_1_A',
    'Grass_1_A',
    'Grass_1_A',
    'Grass_1_A',
    'Grass_1_A',
    'Grass_1_A',
    'Grass_1_A',
    'Grass_2_A',
    'Grass_2_A',
    'Grass_2_A',
    'Grass_1_A',
  ];
  const grassTarget = Math.round(290 * ambience.grass * cover);
  for (let attempt = 0, placed = 0; attempt < grassTarget * 6 && placed < grassTarget; attempt++) {
    const rng = draw('grass', attempt);
    const { x, z } = sample(rng);
    // Near the lake, an attempt counts placed or not: the meadow stays the same, filled or not.
    const near = terrain.nearLake(x, z);
    if (near) placed++;
    if (valueNoise2(description.seed + 11, x / 3.2, z / 3.2) < 0.36) continue;
    const surface = terrain.surfaceAt(x, z);
    if (!surface || surface.kind !== 'grass' || surface.slope > 0.4 || !free(x, z, 0.1)) continue;
    const scale = rng.range(1.0, 1.7);
    batch.add(
      rng.pick(grassModels),
      x,
      surface.y - 0.03,
      z,
      rng.range(0, TAU),
      scale,
      scale * rng.range(0.9, 1.3),
      col(rng, leaves),
    );
    if (!near) placed++;
  }

  // Flowers, in drifts of one kind and mostly one colour; most of them the painting's favourite.
  const drifts = Math.round(15 * ambience.flowers * Math.sqrt(cover));
  for (let attempt = 0, made = 0; attempt < drifts * 8 && made < drifts; attempt++) {
    const rng = draw('flowers', attempt);
    const { x, z } = sample(rng);
    const near = terrain.nearLake(x, z);
    if (near) made++;
    const center = terrain.surfaceAt(x, z);
    if (!center || center.kind !== 'grass' || center.slope > 0.3 || !free(x, z, 0.8)) continue;
    const favourite = rng.chance(0.6);
    const kind = favourite ? flora.flower : rng.pick(FLOWERS);
    const color = favourite ? flora.petal : rng.pick(kind.colors);
    const count = rng.int(5, 9);
    flowerSpots.push({ x, y: center.y, z });
    if (!near) made++;
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, TAU);
      const d = Math.sqrt(rng.next()) * 1.5;
      const fx = x + Math.cos(a) * d;
      const fz = z + Math.sin(a) * d;
      const surface = terrain.surfaceAt(fx, fz);
      if (!surface || surface.kind !== 'grass' || !free(fx, fz, 0.15)) continue;
      const scale = rng.range(1.5, 2.2);
      const accent = swatchColumn(rng.chance(0.8) ? color : rng.pick(kind.colors));
      batch.add(
        kind.model,
        fx,
        surface.y - 0.02,
        fz,
        rng.range(0, TAU),
        scale,
        scale,
        col(rng, leaves),
        accent,
      );
    }
  }

  // Bushes, mostly at the foot of the trees and rocks.
  const bushModels: ModelName[] = [
    'Bush_1_B',
    'Bush_2_D',
    'Bush_3_B',
    'Bush_4_D',
    'Bush_1_B',
    'Bush_4_D',
    'Bush_2_D',
    'Bush_3_B',
    'Bush_1_E',
  ];
  // Neither the islet's tree nor the child's host anything: they move nothing else.
  const hosts = trees.filter((t) => !t.islet && t.slot === undefined);
  const anchors = [...hosts.filter((t) => t.age > 0), ...terrain.staticModels];
  const bushTarget = Math.round(30 * ambience.bushes * terrain.cover);
  for (let attempt = 0, placed = 0; attempt < bushTarget * 8 && placed < bushTarget; attempt++) {
    const rng = draw('bush', attempt);
    let x: number;
    let z: number;
    if (rng.chance(0.7) && anchors.length > 0) {
      const anchor = rng.pick(anchors);
      const a = rng.range(0, TAU);
      const d = rng.range(1.5, 3.0);
      x = anchor.x + Math.cos(a) * d;
      z = anchor.z + Math.sin(a) * d;
    } else {
      ({ x, z } = sample(rng));
    }
    const near = terrain.nearLake(x, z);
    if (near) placed++;
    const surface = terrain.surfaceAt(x, z);
    if (!surface || surface.kind !== 'grass' || surface.slope > 0.45 || !free(x, z, 0.9)) continue;
    const model = rng.pick(bushModels);
    const scale = model === 'Bush_1_B' ? rng.range(1.3, 2.0) : rng.range(0.85, 1.3);
    // Whole on the ground: never hanging over the edge of the diorama.
    const r = 0.8 * scale;
    if (
      [0, 1, 2, 3].some(
        (i) => !terrain.surfaceAt(x + r * Math.cos(i * 1.57), z + r * Math.sin(i * 1.57)),
      )
    ) {
      continue;
    }
    batch.add(
      model,
      x,
      surface.y - 0.05,
      z,
      rng.range(0, TAU),
      scale,
      scale,
      col(rng, bushColumns(season)),
    );
    blocked.push({ x, z, r: 0.8 });
    if (!near) placed++;
  }

  // Fallen logs and stumps: mossy under the trees, bare in the meadow, snowy in winter.
  const winter = season === 'winter';
  const woods = hosts.filter((t) => t.age > 0.5 && t.detail !== 'far');
  for (
    let attempt = 0, placed = 0;
    attempt < ambience.deadwood * 12 && placed < ambience.deadwood;
    attempt++
  ) {
    const rng = draw('deadwood', attempt);
    const stump = rng.chance(0.35);
    const meadow = woods.length === 0 || rng.chance(0.3);
    let x: number;
    let z: number;
    if (meadow) {
      ({ x, z } = sample(rng));
    } else {
      const tree = rng.pick(woods);
      const a = rng.range(0, TAU);
      const d = rng.range(1.6, 2.6);
      x = tree.x + Math.cos(a) * d;
      z = tree.z + Math.sin(a) * d;
    }
    const near = terrain.nearLake(x, z);
    if (near) placed++;
    const yaw = rng.range(0, TAU);
    const scale = stump ? rng.range(0.6, 0.8) : rng.range(0.65, 0.85);
    // A log lies on both its ends and its middle; a stump stands on its foot.
    const half = stump ? 0 : LOG_HALF_LENGTH * scale;
    const feet = [0, -1, 1].map((k) =>
      terrain.surfaceAt(x + Math.sin(yaw) * half * k, z + Math.cos(yaw) * half * k),
    );
    const room = stump ? 0.5 : half + 0.3;
    if (feet.some((f) => f?.kind !== 'grass' || f.slope > 0.3) || !free(x, z, room)) continue;
    const look = DEADWOOD[winter ? 'winter' : meadow ? 'meadow' : 'woods'];
    batch.add(
      stump ? look.stump : look.log,
      x,
      Math.min(...feet.map((f) => f!.y)) - 0.04,
      z,
      yaw,
      scale,
    );
    blocked.push({ x, z, r: room });
    if (!near) placed++;
  }

  // Around the lake, the beavers' work: freshly gnawed stumps.
  if (terrain.dam) {
    for (let i = 0; i < 3; i++) {
      const rng = draw('gnawed', i);
      const a = rng.range(0, TAU);
      const d = rng.range(2.6, 4.4);
      const x = terrain.dam.x + Math.cos(a) * d;
      const z = terrain.dam.z + Math.sin(a) * d;
      const surface = terrain.surfaceAt(x, z);
      if (surface?.kind !== 'grass' || surface.slope > 0.3) continue;
      if (!terrain.nearLake(x, z) || !free(x, z, 0.45)) continue;
      const scale = rng.range(0.45, 0.6);
      batch.add(winter ? 'Stump_Snow' : 'Stump', x, surface.y - 0.04, z, rng.range(0, TAU), scale);
      blocked.push({ x, z, r: 0.45 });
    }
  }

  // Mushrooms at the foot of the trees; a fairy ring at the last stage.
  const grown = hosts.filter((t) => t.age > 0.5);
  const mushroomTarget = Math.round(12 * ambience.mushrooms * terrain.cover);
  for (
    let attempt = 0, placed = 0;
    attempt < mushroomTarget * 8 && placed < mushroomTarget;
    attempt++
  ) {
    if (grown.length === 0) break;
    const rng = draw('mushroom', attempt);
    const tree = rng.pick(grown);
    const a = rng.range(0, TAU);
    const d = rng.range(1.0, 1.9);
    const x = tree.x + Math.cos(a) * d;
    const z = tree.z + Math.sin(a) * d;
    const near = terrain.nearLake(x, z);
    if (near) placed++;
    const surface = terrain.surfaceAt(x, z);
    if (!surface || surface.kind !== 'grass' || !free(x, z, 0.2)) continue;
    const toadstool = rng.chance(0.55);
    const scale = rng.range(1.4, 2.3);
    const accent = swatchColumn(
      toadstool ? 'PetalRed' : rng.pick(['Cream', 'PetalYellow', 'Cream']),
    );
    batch.add(
      toadstool ? 'gen:toadstool' : 'gen:mushrooms',
      x,
      surface.y - 0.02,
      z,
      rng.range(0, TAU),
      scale,
      scale,
      0,
      accent,
    );
    if (!near) placed++;
  }
  if (ambience.mushrooms > 1.2) {
    const host = hosts.find((t) => t.age > 0.5 && t.detail === 'full' && t.family !== 'Gnarly');
    if (host) {
      const rng = draw('ring', 0);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU + 0.2;
        const x = host.x + Math.cos(a) * 2.1;
        const z = host.z + Math.sin(a) * 2.1;
        const surface = terrain.surfaceAt(x, z);
        if (!surface || surface.kind !== 'grass') continue;
        const scale = rng.range(1.3, 1.9);
        batch.add(
          'gen:toadstool',
          x,
          surface.y - 0.02,
          z,
          rng.range(0, TAU),
          scale,
          scale,
          0,
          swatchColumn('PetalRed'),
        );
      }
    }
  }

  // A few stones in the meadow.
  for (let i = 0; i < Math.round(14 * terrain.cover); i++) {
    const rng = draw('stone', i);
    const { x, z } = sample(rng);
    const surface = terrain.surfaceAt(x, z);
    if (!surface || surface.kind !== 'grass' || !free(x, z, 0.5)) continue;
    const model = rng.pick(pebbles);
    const scale = model === 'Rock_2_C' ? rng.range(0.35, 0.6) : rng.range(0.6, 1.1);
    batch.add(
      model,
      x,
      surface.y - (model === 'Rock_3_E' ? -0.1 : 0.06) * scale,
      z,
      rng.range(0, TAU),
      scale,
    );
  }

  // Water lilies and water plants on the ponds.
  for (const [index, pond] of terrain.ponds.entries()) {
    const count = Math.round(8 * ambience.lilies * Math.min(1.8, pond.radius / 2.5));
    for (let i = 0; i < count; i++) {
      const rng = draw(`lily${index}`, i);
      const a = rng.range(0, TAU);
      const d = pond.radius * Math.sqrt(rng.range(0.15, 1));
      const x = pond.x + Math.cos(a) * d;
      const z = pond.z + Math.sin(a) * d;
      const surface = terrain.surfaceAt(x, z);
      if (!surface || surface.kind !== 'water') continue;
      const plant = rng.chance(0.25);
      const scale = plant ? rng.range(3.5, 5) : rng.range(4, 6.5);
      const model: ModelName = plant
        ? 'waterplant_A'
        : rng.chance(0.5)
          ? 'waterlily_A'
          : 'waterlily_B';
      batch.add(model, x, pond.y + 0.015, z, rng.range(0, TAU), scale);
    }
  }

  if (quality.contactShadows) {
    for (const tree of trees) {
      if (tree.age <= 0) continue;
      const r =
        (tree.family === 'Pine' ? 1.5 : tree.detail === 'far' ? 3 : 2.3) *
        tree.scale *
        (0.5 + 0.5 * tree.age);
      batch.add('gen:shadow', tree.x, tree.y + 0.12, tree.z, 0, r, 1);
    }
  }
  return { flowerSpots, groves };
}
