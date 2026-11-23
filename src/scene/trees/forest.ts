import * as THREE from 'three';
import type { AssetLibrary } from '../assets';
import type { SceneMaterials } from '../render/materials';
import { buildTree, TreeWriter, type Season, type TreeInfo, type TreeSpec } from './builder';

export interface PlantedTree extends TreeSpec {
  /** Age at creation, 0 (not sprouted) to 1 (adult). */
  age: number;
  /** Brought by a grand moment: nothing is placed around it. */
  landmark?: boolean;
  /** Slot of the child holding it. */
  slot?: number;
}

/** Build the merged buffers of a forest (no GPU objects: usable in tests). */
export function buildForestBuffers(
  trees: readonly TreeSpec[],
  assets: AssetLibrary,
  season: Season,
): { writer: TreeWriter; infos: TreeInfo[] } {
  const writer = new TreeWriter(trees.length * 1800, trees.length * 7000);
  const infos = trees.map((tree, index) =>
    buildTree(writer, tree, assets, tree.season ?? season, index),
  );
  return { writer, infos };
}

/**
 * All the trees of a painting in one draw call. Ages live in a small data texture, so a
 * tree grows without touching the geometry.
 */
export class Forest {
  readonly mesh: THREE.Mesh;
  readonly infos: TreeInfo[];
  readonly triangles: number;
  /** Time spent generating the trees, in milliseconds. */
  readonly generationMs: number;
  private readonly data: Float32Array;
  private readonly texture: THREE.DataTexture;
  private readonly count: number;

  constructor(
    readonly trees: readonly PlantedTree[],
    assets: AssetLibrary,
    season: Season,
    materials: SceneMaterials,
  ) {
    const start = performance.now();
    const { writer, infos } = buildForestBuffers(trees, assets, season);
    this.generationMs = performance.now() - start;
    this.infos = infos;
    this.triangles = writer.triangles;
    this.count = Math.max(1, trees.length);

    const geometry = new THREE.BufferGeometry();
    const v = writer.vertexCount;
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(writer.positions.slice(0, v * 3), 3),
    );
    geometry.setAttribute('normal', new THREE.BufferAttribute(writer.normals.slice(0, v * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(writer.uvs.slice(0, v * 2), 2));
    geometry.setAttribute('aPivot', new THREE.BufferAttribute(writer.pivots.slice(0, v * 3), 3));
    geometry.setAttribute('aGrow', new THREE.BufferAttribute(writer.grow.slice(0, v * 4), 4, true));
    geometry.setAttribute('aTree', new THREE.BufferAttribute(writer.tree.slice(0, v), 1));
    geometry.setIndex(new THREE.BufferAttribute(writer.indices.slice(0, writer.indexCount), 1));
    // Vertices move in the shader: skip culling instead of trusting static bounds.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    this.data = new Float32Array(this.count * 2 * 4);
    trees.forEach((tree, i) => {
      this.data.set([tree.x, tree.y, tree.z, tree.age], i * 4);
      this.data.set([1, ((tree.seed % 1000) / 1000) * 6.283, 0, 0], (this.count + i) * 4);
    });
    this.texture = new THREE.DataTexture(
      this.data,
      this.count,
      2,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
    materials.treeData.value = this.texture;

    this.mesh = new THREE.Mesh(geometry, materials.tree);
    this.mesh.customDepthMaterial = materials.treeDepth;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'forest';
  }

  age(index: number): number {
    return this.data[index * 4 + 3];
  }

  setAge(index: number, age: number): void {
    this.data[index * 4 + 3] = age;
    this.texture.needsUpdate = true;
  }

  /** Vertical squash and stretch (1 = none), for the growth animation. */
  setStretch(index: number, stretch: number): void {
    this.data[(this.count + index) * 4] = stretch;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.texture.dispose();
  }
}
