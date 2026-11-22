import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CATALOG, type ModelName } from './asset-catalog';
import { ASSET_FILE, MODELS } from './assets.gen';
import { paintAtlas } from './atlas';
import { bufferGeometryOf, meshDataOf, type MeshData } from './mesh-data';
import { placeholderModels } from './placeholders';

/** Models and atlas shared by a whole scene. */
export class AssetLibrary {
  private readonly geometries = new Map<ModelName, THREE.BufferGeometry>();

  constructor(
    private readonly models: Map<ModelName, MeshData>,
    readonly atlas: THREE.Texture,
    /** True when the KayKit packs are absent and stand-in shapes are used. */
    readonly placeholders: boolean,
  ) {}

  data(name: ModelName): MeshData {
    return this.models.get(name)!;
  }

  /** Shared GPU geometry of a model, for instancing. */
  geometry(name: ModelName): THREE.BufferGeometry {
    let geometry = this.geometries.get(name);
    if (!geometry) {
      geometry = bufferGeometryOf(this.data(name));
      this.geometries.set(name, geometry);
    }
    return geometry;
  }

  size(name: ModelName): [number, number, number] {
    const { min, max } = MODELS[name];
    return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    this.atlas.dispose();
  }
}

function tuneAtlas(texture: THREE.Texture): THREE.Texture {
  // Gradient cells do not alias, and mipmaps would bleed neighbouring cells.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export function createPlaceholderLibrary(): AssetLibrary {
  const size = 256;
  const texture = new THREE.DataTexture(paintAtlas(size), size, size, THREE.RGBAFormat);
  return new AssetLibrary(placeholderModels(), tuneAtlas(texture), true);
}

const GLB_MAGIC = 0x46546c67;

/**
 * Load the optimised models, or fall back to placeholders when the packs were not built
 * (or when placeholders are forced, to check that fallback).
 */
export async function loadAssets(
  baseUrl: string,
  forcePlaceholders = false,
): Promise<AssetLibrary> {
  if (forcePlaceholders || !__KAYKIT_ASSETS__) return createPlaceholderLibrary();
  let buffer: ArrayBuffer | null = null;
  try {
    const response = await fetch(baseUrl + ASSET_FILE);
    if (response.ok) buffer = await response.arrayBuffer();
  } catch {
    buffer = null;
  }
  // A dev server answers a missing file with the HTML page: check the GLB signature.
  if (!buffer || buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== GLB_MAGIC) {
    return createPlaceholderLibrary();
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const models = new Map<ModelName, MeshData>();
  let atlas: THREE.Texture | null = null;
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.name in CATALOG ? mesh.name : mesh.parent?.name) as ModelName;
    models.set(name, meshDataOf(mesh.geometry, mesh.matrixWorld));
    const material = mesh.material as THREE.MeshStandardMaterial;
    atlas ??= material.map;
    mesh.geometry.dispose();
    material.dispose();
  });
  const missing = (Object.keys(CATALOG) as ModelName[]).filter((name) => !models.has(name));
  if (missing.length > 0 || !atlas) {
    throw new Error(`Assets out of date (run "npm run assets"): ${missing.join(', ')}`);
  }
  return new AssetLibrary(models, tuneAtlas(atlas), false);
}
