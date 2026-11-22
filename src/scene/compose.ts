import type { AssetLibrary } from './assets';
import type { SceneDescription } from './description';
import { MeshWriter, triangleCount } from './mesh-data';
import { plantTrees, scatterVegetation, type Planting, type Population } from './populate';
import { InstanceBatch } from './render/instancing';
import type { QualitySettings } from './render/quality';
import type { Ambience } from './render/richness';
import { WaterBuilder } from './render/water';
import { createClearing } from './terrain/clearing';
import { createHexIsland, remapHexGrass } from './terrain/hex';
import type { Terrain } from './terrain/types';

export function createTerrain(description: SceneDescription, assets: AssetLibrary): Terrain {
  return description.form === 'hex'
    ? createHexIsland(description.seed, assets)
    : createClearing(description.seed);
}

/** Everything of a painting that is plain data: no GPU object, usable in tests. */
export interface Composition {
  terrain: Terrain;
  /** Ground and large rocks, merged. */
  ground: MeshWriter;
  water: WaterBuilder;
  planting: Planting;
  batch: InstanceBatch;
  population: Population;
  /** Number of clouds of each model. */
  clouds: { cloud_big: number; cloud_small: number };
}

/** Compose a painting from its description: a pure function of its arguments. */
export function composeScene(
  description: SceneDescription,
  assets: AssetLibrary,
  ambience: Ambience,
  quality: QualitySettings,
): Composition {
  const terrain = createTerrain(description, assets);
  const ground = new MeshWriter(24000, 24000);
  terrain.buildGround(ground, description.season);
  const firstModel = ground.vertexCount;
  for (const m of terrain.staticModels) {
    ground.append(
      assets.data(m.model),
      m.x,
      m.y,
      m.z,
      m.yaw,
      m.scale,
      m.scaleY ?? m.scale,
      m.scale,
    );
  }
  if (description.form === 'hex') remapHexGrass(ground, firstModel, description.season);

  const water = new WaterBuilder(2048, 4096);
  terrain.buildWater(water);

  const planting = plantTrees(terrain, description, ambience);
  const batch = new InstanceBatch(assets);
  const population = scatterVegetation(
    batch,
    terrain,
    description,
    ambience,
    quality,
    planting.trees,
  );
  const cloudCount = Math.round(16 * ambience.clouds * quality.clouds);
  return {
    terrain,
    ground,
    water,
    planting,
    batch,
    population,
    clouds: {
      cloud_big: Math.max(1, Math.round(cloudCount * 0.45)),
      cloud_small: Math.max(1, Math.round(cloudCount * 0.55)),
    },
  };
}

/** Triangles of the composed scene, by part (trees are counted by the forest). */
export function compositionTriangles(
  c: Composition,
  assets: AssetLibrary,
): { ground: number; water: number; instances: number; clouds: number } {
  return {
    ground: c.ground.triangles,
    water: c.water.triangles,
    instances: c.batch.countTriangles(),
    clouds:
      c.clouds.cloud_big * triangleCount(assets.data('cloud_big')) +
      c.clouds.cloud_small * triangleCount(assets.data('cloud_small')),
  };
}
