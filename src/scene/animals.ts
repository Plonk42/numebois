import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { ANIMAL_CLIPS, ANIMAL_NAMES, type AnimalClip, type AnimalName } from './animal-catalog';
import { ANIMAL_FILE, ANIMALS } from './animals.gen';

/** One animal in the scene: a model posed by blending its clips. */
export interface AnimalBody {
  readonly object: THREE.Object3D;
  readonly triangles: number;
  /** Add a clip at a time (seconds, looped) with a weight; then `apply` once per frame. */
  pose(clip: AnimalClip, time: number, weight: number): void;
  apply(): void;
  dispose(): void;
}

interface Template {
  scene: THREE.Object3D;
  clips: Map<AnimalClip, THREE.AnimationClip>;
}

class SkinnedBody implements AnimalBody {
  readonly object: THREE.Object3D;
  readonly triangles: number;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<AnimalClip, THREE.AnimationAction>();

  constructor(template: Template, material: THREE.Material, name: AnimalName) {
    this.object = cloneSkinned(template.scene);
    this.object.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    this.triangles = ANIMALS[name].triangles;
    this.mixer = new THREE.AnimationMixer(this.object);
    for (const [clip, animation] of template.clips) {
      const action = this.mixer.clipAction(animation);
      action.play();
      action.setEffectiveWeight(0);
      this.actions.set(clip, action);
    }
  }

  pose(clip: AnimalClip, time: number, weight: number): void {
    const action = this.actions.get(clip)!;
    action.time = time % action.getClip().duration;
    action.setEffectiveWeight(weight);
  }

  apply(): void {
    this.mixer.update(0);
    for (const action of this.actions.values()) action.setEffectiveWeight(0);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
  }
}

/** Stand-in without the pack: a rounded body on four legs, bobbing as it walks, hopping. */
class PlaceholderBody implements AnimalBody {
  readonly object: THREE.Mesh;
  readonly triangles: number;
  private walk = 0;
  private walkTime = 0;
  private jump = 0;
  private jumpTime = 0;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.object = new THREE.Mesh(geometry, material);
    this.object.castShadow = true;
    this.triangles = geometry.attributes.position.count / 3;
  }

  pose(clip: AnimalClip, time: number, weight: number): void {
    if (clip === 'jump') {
      this.jump = weight;
      this.jumpTime = time;
    }
    if (clip !== 'walk') return;
    this.walk = weight;
    this.walkTime = time;
  }

  apply(): void {
    this.object.position.y +=
      this.walk * 0.04 * Math.abs(Math.sin(this.walkTime * Math.PI * 2)) +
      this.jump * 0.5 * Math.sin(Math.min(1, this.jumpTime) * Math.PI);
    this.walk = 0;
    this.jump = 0;
  }

  dispose(): void {
    // The geometry belongs to the library.
  }
}

function placeholderGeometry(name: AnimalName): THREE.BufferGeometry {
  const { min, max } = ANIMALS[name];
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const l = max[2] - min[2];
  const part = (sx: number, sy: number, sz: number, x: number, y: number, z: number) =>
    new THREE.IcosahedronGeometry(0.5, 1).scale(sx, sy, sz).translate(x, y, z);
  const body = part(w * 0.8, h * 0.35, l * 0.6, 0, min[1] + h * 0.55, min[2] + l * 0.45);
  const head = part(w * 0.6, h * 0.25, l * 0.22, 0, min[1] + h * 0.85, max[2] - l * 0.12);
  const legs = [-1, 1].flatMap((side) =>
    [0.25, 0.65].map((at) =>
      new THREE.CylinderGeometry(w * 0.08, w * 0.06, h * 0.45, 5)
        .translate(0, h * 0.225, 0)
        .translate(side * w * 0.25, min[1], min[2] + l * at),
    ),
  );
  const merged = mergeGeometries(
    [body, head, ...legs].map((g) => (g.index ? g.toNonIndexed() : g)),
  );
  return merged;
}

/** Animals shared by a whole scene: real models from the pack, or placeholders. */
export class AnimalLibrary {
  private readonly geometries = new Map<AnimalName, THREE.BufferGeometry>();

  constructor(
    private readonly templates: Map<AnimalName, Template> | null,
    private readonly material: THREE.Material,
  ) {}

  /** True when the pack is absent and stand-in shapes are used. */
  get placeholders(): boolean {
    return this.templates === null;
  }

  create(name: AnimalName): AnimalBody {
    if (this.templates) return new SkinnedBody(this.templates.get(name)!, this.material, name);
    let geometry = this.geometries.get(name);
    if (!geometry) {
      geometry = placeholderGeometry(name);
      this.geometries.set(name, geometry);
    }
    return new PlaceholderBody(geometry, this.material);
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.templates?.forEach((t) => t.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose()));
    this.material.dispose();
  }
}

export function createPlaceholderAnimals(): AnimalLibrary {
  return new AnimalLibrary(null, new THREE.MeshLambertMaterial({ color: 0xa0683c }));
}

const GLB_MAGIC = 0x46546c67;

/** Load the optimised animals, or fall back to placeholders when the pack was not built. */
export async function loadAnimals(
  baseUrl: string,
  forcePlaceholders = false,
): Promise<AnimalLibrary> {
  if (forcePlaceholders || !__ANIMAL_ASSETS__) return createPlaceholderAnimals();
  let buffer: ArrayBuffer | null = null;
  try {
    const response = await fetch(baseUrl + ANIMAL_FILE);
    if (response.ok) buffer = await response.arrayBuffer();
  } catch {
    buffer = null;
  }
  if (!buffer || buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== GLB_MAGIC) {
    return createPlaceholderAnimals();
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  const templates = new Map<AnimalName, Template>();
  for (const name of ANIMAL_NAMES) {
    const scene = gltf.scenes.find((s) => s.name === name);
    const clips = new Map<AnimalClip, THREE.AnimationClip>();
    for (const clip of ANIMAL_CLIPS) {
      const animation = gltf.animations.find((a) => a.name === `${name}:${clip}`);
      if (animation) clips.set(clip, animation);
    }
    if (!scene || clips.size !== ANIMAL_CLIPS.length) {
      throw new Error(`Animals out of date (run "npm run assets"): ${name}`);
    }
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.Material).dispose();
    });
    templates.set(name, { scene, clips });
  }
  // Colours are in the vertices: one material for every animal.
  return new AnimalLibrary(templates, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
