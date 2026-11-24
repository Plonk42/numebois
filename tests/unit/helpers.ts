import * as THREE from 'three';
import type { ExerciseContext } from '../../src/core/types';
import { CATALOG, type ModelName } from '../../src/scene/asset-catalog';
import { AssetLibrary } from '../../src/scene/assets';
import { MODELS } from '../../src/scene/assets.gen';
import { BIOMES } from '../../src/scene/biomes';
import type { MeshData } from '../../src/scene/mesh-data';

/** Questions asked in the clearing. */
export const CLEARING: ExerciseContext = { vocabulary: BIOMES.clearing.vocabulary };

/**
 * Library whose models have the bounding box and the triangle count of the real KayKit
 * models (from the manifest), so triangle budgets are checked without the packs.
 */
export function createBudgetLibrary(): AssetLibrary {
  const models = new Map<ModelName, MeshData>();
  for (const name of Object.keys(CATALOG) as ModelName[]) {
    const { min, max, triangles } = MODELS[name];
    const indices = new Uint32Array(triangles * 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i % 3;
    models.set(name, {
      positions: new Float32Array([...min, ...max, min[0], max[1], min[2]]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      uvs: new Float32Array(6),
      indices,
    });
  }
  return new AssetLibrary(models, new THREE.Texture(), true);
}

/** FNV-1a hash of a float array, to compare generated geometry. */
export function hashFloats(values: Float32Array): number {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let h = 0x811c9dc5;
  for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h;
}
