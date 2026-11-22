import { hashSeed, Rng, valueNoise2 } from '../core/rng';
import type { ModelName } from './asset-catalog';
import { swatchColumn, swatchUV, type SwatchName } from './atlas';
import type { SceneDescription } from './description';
import { MeshWriter, type MeshData } from './mesh-data';
import { GENERATED_PROPS } from './props';
import type { InstanceBatch, InstanceModel } from './render/instancing';
import type { QualitySettings } from './render/quality';
import type { Ambience } from './render/richness';
import { groundSwatch } from './terrain/clearing';
import type { Terrain } from './terrain/types';
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
const DEMO_FAMILIES: readonly FamilyName[] = ['Round', 'Cube', 'Umbrella', 'Birch'];
const FAVOURITES: readonly FamilyName[] = ['Round', 'Cube', 'Birch', 'Umbrella'];

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
  /** Indices of the hidden trees used by the growth demonstration. */
  demo: number[];
}

/** Trees of the painting for its stage: the forest, the clearing trees, the demo slots. */
export function plantTrees(
  terrain: Terrain,
  description: SceneDescription,
  ambience: Ambience,
): Planting {
  const trees: PlantedTree[] = [];
  const demo: number[] = [];
  const flora = floraOf(description.seed);
  const clearingSpots = terrain.treeSpots.filter((s) => s.role === 'clearing');
  const clearingCount = Math.round(clearingSpots.length * ambience.clearingTrees);
  const counters = { clearing: 0, hero: 0, demo: 0 };
  for (const spot of terrain.treeSpots) {
    // Numbers drawn from the place itself, so a tree keeps its shape from stage to stage.
    const rng = new Rng(
      hashSeed(description.seed, `tree:${Math.round(spot.x * 8)}:${Math.round(spot.z * 8)}`),
    );
    const seed = rng.int(1, 1e9);
    const yaw = rng.range(0, TAU);
    const pick = rng.next();
    const ageDraw = rng.next();
    const surface = terrain.surfaceAt(spot.x, spot.z);
    if (!surface) continue;
    let family: FamilyName;
    let age: number;
    let detail: PlantedTree['detail'] = spot.detail ?? 'full';
    if (spot.role === 'edge') {
      if (spot.rank !== undefined && spot.rank >= ambience.edgeTrees) continue;
      detail = spot.detail ?? 'light';
      const families = detail === 'far' ? FAR_FAMILIES : flora.edge;
      family = spot.conifer ? 'Pine' : families[Math.floor(pick * families.length)];
      age = ambience.edgeAge[0] + (ambience.edgeAge[1] - ambience.edgeAge[0]) * ageDraw;
    } else if (spot.role === 'hero') {
      const slot = spot.slot ?? counters.hero++;
      family = HERO_FAMILIES[(slot + flora.shift) % HERO_FAMILIES.length];
      age = Math.max(ambience.edgeAge[0], 0.85);
    } else if (spot.role === 'clearing') {
      const index = counters.clearing++;
      // The first trees planted are the oldest.
      let t: number;
      if (spot.rank !== undefined) {
        if (spot.rank >= ambience.clearingTrees) continue;
        t = spot.rank / ambience.clearingTrees;
      } else {
        if (index >= clearingCount) continue;
        t = clearingCount > 1 ? index / (clearingCount - 1) : 0;
      }
      const slot = spot.slot ?? index;
      family =
        slot % 3 === 1
          ? flora.favourite
          : CLEARING_FAMILIES[(slot + flora.shift) % CLEARING_FAMILIES.length];
      age = ambience.clearingAge[1] - (ambience.clearingAge[1] - ambience.clearingAge[0]) * t;
    } else {
      family = DEMO_FAMILIES[(spot.slot ?? counters.demo++) % DEMO_FAMILIES.length];
      age = 0;
      demo.push(trees.length);
    }
    trees.push({
      family,
      seed,
      x: spot.x,
      // On a slope, the foot of the trunk stays in the ground.
      y: surface.y - 0.05 - 0.4 * surface.slope,
      z: spot.z,
      yaw,
      scale: spot.size * (family === 'Pine' ? 1.25 : 1),
      detail,
      age,
    });
  }
  return { trees, demo };
}

function leafColumns(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Spring', 'Spring', 'Summer'];
    case 'summer':
      return ['Summer', 'Summer', 'Spring'];
    case 'autumn':
      return ['Gold', 'Orange', 'Brown', 'Gold', 'Summer'];
    case 'winter':
      return ['Snow'];
  }
}

function bushColumns(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Spring', 'Summer', 'Spring', 'Blossom'];
    case 'summer':
      return ['Summer', 'Summer', 'Spring'];
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
  const rng = new Rng(description.seed).fork('scatter');
  const season = description.season;
  for (const [name, make] of Object.entries(GENERATED_PROPS)) {
    batch.register(name as keyof typeof GENERATED_PROPS, make());
  }
  batch.register('gen:shadow', contactShadow(season));

  const blocked: { x: number; z: number; r: number }[] = [];
  for (const tree of trees) blocked.push({ x: tree.x, z: tree.z, r: tree.age > 0 ? 0.9 : 1.4 });
  for (const model of terrain.staticModels)
    blocked.push({ x: model.x, z: model.z, r: 1.3 * model.scale });
  const free = (x: number, z: number, r: number) =>
    !blocked.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r);
  const col = (names: readonly SwatchName[]) => swatchColumn(rng.pick(names));
  const leaves = leafColumns(season);
  const cover = quality.groundCover * terrain.cover;
  // Along the water, a larger diorama is dressed more sparsely.
  const bankStep = 0.9 * Math.max(1, terrain.cover);

  // Banks: small rocks and tall grass along the water.
  const reed: ModelName[] = ['Grass_2_A', 'Grass_2_A', 'Grass_2_A', 'Grass_2_A', 'Grass_2_B'];
  const pebbles: ModelName[] = ['Rock_3_E', 'Rock_1_A', 'Rock_2_C'];
  for (const bank of terrain.banks) {
    for (let i = 0; i + 1 < bank.points.length; i++) {
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
                col(leaves),
              );
            }
          }
        }
      }
    }
  }

  const sample = (): { x: number; z: number } => ({
    x: rng.range(-terrain.extent.x, terrain.extent.x),
    z: rng.range(-terrain.extent.z, terrain.extent.z),
  });

  // Grass tufts, in patches. The heavy tuft is rare: the meadow is large.
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
    'Grass_1_B',
  ];
  const grassTarget = Math.round(290 * ambience.grass * cover);
  for (let attempt = 0, placed = 0; attempt < grassTarget * 6 && placed < grassTarget; attempt++) {
    const { x, z } = sample();
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
      col(leaves),
    );
    placed++;
  }

  // Flowers, in drifts of one kind and mostly one colour; most of them the painting's favourite.
  const flora = floraOf(description.seed);
  const flowerSpots: Population['flowerSpots'] = [];
  const drifts = Math.round(15 * ambience.flowers * Math.sqrt(cover));
  for (let attempt = 0; attempt < drifts * 8 && flowerSpots.length < drifts; attempt++) {
    const { x, z } = sample();
    const center = terrain.surfaceAt(x, z);
    if (!center || center.kind !== 'grass' || center.slope > 0.3 || !free(x, z, 0.8)) continue;
    const favourite = rng.chance(0.6);
    const kind = favourite ? flora.flower : rng.pick(FLOWERS);
    const color = favourite ? flora.petal : rng.pick(kind.colors);
    const count = rng.int(5, 9);
    flowerSpots.push({ x, y: center.y, z });
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
        col(leaves),
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
  const anchors = [...trees.filter((t) => t.age > 0), ...terrain.staticModels];
  const bushTarget = Math.round(30 * ambience.bushes * terrain.cover);
  for (let attempt = 0, placed = 0; attempt < bushTarget * 8 && placed < bushTarget; attempt++) {
    let x: number;
    let z: number;
    if (rng.chance(0.7) && anchors.length > 0) {
      const anchor = rng.pick(anchors);
      const a = rng.range(0, TAU);
      const d = rng.range(1.5, 3.0);
      x = anchor.x + Math.cos(a) * d;
      z = anchor.z + Math.sin(a) * d;
    } else {
      ({ x, z } = sample());
    }
    const surface = terrain.surfaceAt(x, z);
    if (!surface || surface.kind !== 'grass' || surface.slope > 0.45 || !free(x, z, 0.9)) continue;
    const model = rng.pick(bushModels);
    const scale = model === 'Bush_1_B' ? rng.range(1.3, 2.0) : rng.range(0.85, 1.3);
    batch.add(
      model,
      x,
      surface.y - 0.05,
      z,
      rng.range(0, TAU),
      scale,
      scale,
      col(bushColumns(season)),
    );
    blocked.push({ x, z, r: 0.8 });
    placed++;
  }

  // Mushrooms at the foot of the trees; a fairy ring at the last stage.
  const grown = trees.filter((t) => t.age > 0.5);
  const mushroomTarget = Math.round(12 * ambience.mushrooms * terrain.cover);
  for (
    let attempt = 0, placed = 0;
    attempt < mushroomTarget * 8 && placed < mushroomTarget;
    attempt++
  ) {
    if (grown.length === 0) break;
    const tree = rng.pick(grown);
    const a = rng.range(0, TAU);
    const d = rng.range(1.0, 1.9);
    const x = tree.x + Math.cos(a) * d;
    const z = tree.z + Math.sin(a) * d;
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
    placed++;
  }
  if (ambience.mushrooms > 1.2) {
    const host = trees.find((t) => t.age > 0.5 && t.detail === 'full' && t.family !== 'Gnarly');
    if (host) {
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
    const { x, z } = sample();
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
  for (const pond of terrain.ponds) {
    const count = Math.round(8 * ambience.lilies * Math.min(1.8, pond.radius / 2.5));
    for (let i = 0; i < count; i++) {
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
  return { flowerSpots };
}
