import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { AnimalName } from './animal-catalog';
import type { AnimalLibrary } from './animals';
import type { AssetLibrary } from './assets';
import { MODELS } from './assets.gen';
import { BIOMES } from './biomes';
import { swatchColor, type SwatchName } from './atlas';
import { composeScene, compositionTriangles } from './compose';
import { LAST_STAGE, type SceneDescription } from './description';
import { bufferGeometryOf, triangleCount } from './mesh-data';
import { candidateSlots, childTreeAge } from './populate';
import { GENERATED_DRIFTERS } from './props';
import { Backdrop, BACKDROP_TRIANGLES } from './render/backdrop';
import { CloudSea, CLOUD_SEA_TRIANGLES } from './render/cloud-sea';
import type { InstanceBatch } from './render/instancing';
import { animalState, Herd, planHerd, type AnimalState } from './render/ambient-life';
import { Lighting, sunDirection } from './render/lighting';
import { createMaterials, paletteColor, type SceneMaterials } from './render/materials';
import {
  applyFog,
  CANOPY_RAYS,
  CanopyRays,
  Flappers,
  Foam,
  GLOW_BURST,
  GLOW_FIREFLY,
  GLOW_LANTERN,
  GLOW_POLLEN,
  GLOW_SNOW,
  GLOW_SPARKLE,
  RAINBOW_TRIANGLES,
  GlowPoints,
  Leaves,
  Rainbow,
  SunRays,
  type Flapper,
  type GlowParticle,
  type Leaf,
} from './render/particles';
import type { QualitySettings } from './render/quality';
import { ambienceFor, type Ambience } from './render/richness';
import { Clouds, Sky } from './render/sky';
import type { Stage } from './render/stage';
import type { Drifter, Terrain } from './terrain/types';
import type { Season } from './trees/builder';
import { Forest } from './trees/forest';

const GROWTH_SECONDS = 3.6;
/** Bursts of the grand finale, and time left after the last one for its sparks to fall. */
const FINALE_BURSTS = 8;
const FINALE_LAST_BURST_S = 1.5;
const TAU = Math.PI * 2;
/** Reach of a touch around what it aims at, in CSS pixels at least: a child's finger. */
const TOUCH_PX = 36;
/** A touched plant sways (squash and stretch) for this long, in seconds. */
const SWAY_SECONDS = 1.4;

const sway = (t: number) => 0.14 * Math.sin(t * 15) * Math.exp(-t * 3);

/** What a touch of the child made react (#28). */
export type Touched = { kind: 'animal'; name: AnimalName } | { kind: 'plant' };

function foliagePalette(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Blossom', 'Blossom', 'Spring'];
    case 'summer':
      return ['Summer'];
    case 'autumn':
      return ['Orange', 'Red', 'Gold', 'Brown'];
    case 'winter':
      return ['Snow'];
  }
}

const PETALS: readonly SwatchName[] = [
  'PetalWhite',
  'PetalPink',
  'PetalYellow',
  'PetalViolet',
  'PetalRed',
  'PetalBlue',
];

export interface PaintingStats {
  /** Triangles of the scene (one pass, without the shadow map). */
  triangles: number;
  treeTriangles: number;
  groundTriangles: number;
  waterTriangles: number;
  /** Instanced vegetation and rocks. */
  instancedTriangles: number;
  cloudTriangles: number;
  /** Animals of the meadow (skinned, one draw call each). */
  animals: number;
  animalTriangles: number;
  trees: number;
  /** Largest tree, in triangles. */
  largestTree: number;
  treeGenerationMs: number;
  instances: number;
  placeholders: boolean;
}

/** Triangles of the small effect meshes (wings, leaves, foam puffs, sky and rays). */
export function effectTriangles(flappers: number, leaves: number, puffs: number): number {
  return flappers * 4 + leaves * 2 + puffs * 20 + 12;
}

/** Upper bound of `effectTriangles` at full quality, for the budget tests. */
export const MAX_EFFECT_TRIANGLES = effectTriangles(30, 150, 80) + RAINBOW_TRIANGLES;

/** Leaves spiralling down around a great tree, at most. */
export const MAX_SPIRAL_LEAVES = 60;

/**
 * A painting: the whole diorama built from its compact description. Building it twice from
 * the same description gives the same scene.
 */
export class Painting {
  readonly root = new THREE.Group();
  readonly stats: PaintingStats;
  readonly ambience: Ambience;
  readonly terrain: Terrain;

  private readonly materials: SceneMaterials;
  private readonly forest: Forest;
  private readonly sky: Sky;
  private readonly backdrop: Backdrop;
  private readonly clouds: Clouds;
  private readonly lighting: Lighting;
  private readonly glow: GlowPoints;
  private readonly leaves: Leaves;
  private readonly batch: InstanceBatch;
  private readonly herd: Herd;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly fog: THREE.Fog;
  private readonly fogged: THREE.Object3D[];
  private readonly demo: number[];
  private demoNext = 0;
  /** Trees whose age moves: a sprout stretches as it shoots, the others just grow. */
  private readonly growing: {
    tree: number;
    from: number;
    to: number;
    start: number;
    sprout: boolean;
  }[] = [];
  private readonly slotTrees: Map<number, number>;
  /** Instances of the hidden groves, with their full matrix. */
  private readonly hiddenGroves = new Map<
    number,
    { mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }[]
  >();
  /** Instances of the groves placed by the child, with their matrix, to sway when touched. */
  private readonly groves = new Map<
    number,
    { mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }[]
  >();
  private readonly swaying: { tree: number; slot: number; start: number }[] = [];
  private readonly touchPoint = new THREE.Vector3();
  private readonly sprouting: { slot: number; start: number }[] = [];
  private readonly spinners: { pivot: THREE.Group; speed: number }[] = [];
  private readonly drifters: { mesh: THREE.Mesh; drifter: Drifter }[] = [];
  private readonly cloudSea: CloudSea | null = null;
  /** Bursts of the grand finale still to come, the first one last. */
  private readonly finaleBursts: { point: THREE.Vector3; at: number }[] = [];
  private readonly burstOrigin = new THREE.Vector3();
  private readonly scratch = new THREE.Matrix4();
  /** Free slots offered for the next element, prepared hidden. */
  readonly candidates: readonly number[];

  constructor(
    private readonly stage: Stage,
    assets: AssetLibrary,
    animals: AnimalLibrary,
    readonly description: SceneDescription,
    quality: QualitySettings,
  ) {
    const { seed, season } = description;
    const ambience = ambienceFor(description.stage, season, BIOMES[description.biome]);
    this.ambience = ambience;
    const composition = composeScene(description, assets, ambience, quality);
    const { terrain, ground, water, planting, population } = composition;
    this.terrain = terrain;
    const materials = createMaterials(assets.atlas, seed);
    this.materials = materials;
    materials.shared.uWindStrength.value = quality.wind ? ambience.wind : 0;
    materials.waterUniforms.uWave.value = quality.waterWaves ? 1 : 0;
    materials.waterUniforms.uSparkle.value = ambience.sparkle;
    if (season === 'winter') {
      materials.waterUniforms.uDeep.value.copy(paletteColor('HexWaterLight', 0.6));
      materials.waterUniforms.uShallow.value.copy(paletteColor('HexCloud', 0.7));
    }

    // Static scenery: ground and large rocks, one mesh.
    const groundMesh = new THREE.Mesh(ground.toGeometry(), materials.solid);
    groundMesh.castShadow = true;
    groundMesh.receiveShadow = true;
    groundMesh.name = 'ground';
    this.root.add(groundMesh);

    const waterMesh = water.build(materials.water);
    this.root.add(waterMesh);

    for (const s of terrain.spinners) {
      const { min, max } = MODELS[s.model];
      const hub = new THREE.Vector3(
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      );
      const mesh = new THREE.Mesh(assets.geometry(s.model), materials.solid);
      mesh.position.copy(hub).negate();
      mesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.copy(hub);
      pivot.add(mesh);
      const holder = new THREE.Group();
      holder.position.set(s.x, s.y, s.z);
      holder.rotation.y = s.yaw;
      holder.scale.setScalar(s.scale);
      holder.add(pivot);
      this.root.add(holder);
      this.spinners.push({ pivot, speed: s.speed * TAU });
    }
    let drifterTriangles = 0;
    for (const drifter of terrain.drifters) {
      const data = GENERATED_DRIFTERS[drifter.model]();
      drifterTriangles += triangleCount(data);
      const mesh = new THREE.Mesh(bufferGeometryOf(data), materials.solid);
      mesh.castShadow = true;
      mesh.scale.setScalar(drifter.scale);
      mesh.name = drifter.model;
      this.root.add(mesh);
      this.drifters.push({ mesh, drifter });
      this.disposables.push({ dispose: () => mesh.geometry.dispose() });
    }

    this.demo = planting.demo;
    this.slotTrees = planting.slotTrees;
    this.candidates = candidateSlots(terrain, description);
    this.forest = new Forest(planting.trees, assets, season, materials);
    this.root.add(this.forest.mesh);

    this.batch = composition.batch;
    // Small rocks, logs and bushes cast no shadow: barely visible from the camera, and costly.
    const instanced = this.batch.build((model) =>
      /^(Rock|Log|Stump)/.test(model) || model === 'gen:shadow' || model === 'gen:dam'
        ? materials.solid
        : materials.vegetation,
    );
    this.root.add(...instanced);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const placed = new Set(description.elements.map((element) => element.slot));
    for (const [slot, pieces] of population.groves) {
      const candidate = this.candidates.includes(slot);
      if (!candidate && !placed.has(slot)) continue;
      (candidate ? this.hiddenGroves : this.groves).set(
        slot,
        pieces.map(({ model, index }) => {
          const mesh = instanced.find((m) => m.name === model)!;
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(index, matrix);
          if (candidate) {
            mesh.setMatrixAt(index, hidden);
            mesh.instanceMatrix.needsUpdate = true;
          }
          return { mesh, index, matrix };
        }),
      );
    }

    this.herd = new Herd(animals, planHerd(terrain, description.animals, seed), terrain);
    this.root.add(this.herd.group);

    this.sky = new Sky(ambience);
    this.root.add(this.sky.mesh);
    this.backdrop = new Backdrop(
      seed,
      season,
      terrain.chain,
      assets.atlas,
      ambience,
      materials.shared,
    );
    this.root.add(this.backdrop.root);
    const radius = Math.max(terrain.extent.x, terrain.extent.z);
    this.clouds = new Clouds(assets, materials.solid, seed, composition.clouds, radius);
    this.root.add(...this.clouds.meshes);
    if (terrain.cloudSea !== null) {
      this.cloudSea = new CloudSea(terrain.cloudSea, ambience, materials.shared, quality.cloudSea);
      this.root.add(this.cloudSea.mesh);
    }

    const center = new THREE.Vector3(...terrain.shadow.center);
    this.lighting = new Lighting(ambience, center, terrain.shadow.radius, quality);
    this.lighting.addTo(stage.scene);
    const fog = new THREE.Fog(ambience.fog.color, 1, 1000);
    this.fog = fog;
    stage.scene.fog = fog;

    // Ambient life, in proportion to the diorama.
    // One generator per kind of life, so the lake filling only changes its own.
    const drawn = (label: string) => new Rng(seed).fork(`life:${label}`);
    let rng = drawn('pollen');
    const shared = materials.shared;
    const life = terrain.cover * quality.particles;
    const size = terrain.extent.x / 20;
    const meadow = (lift: number, spread = 0.8): { x: number; y: number; z: number } | null => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = rng.range(-terrain.extent.x, terrain.extent.x) * spread;
        const z = rng.range(-terrain.extent.z, terrain.extent.z) * spread;
        const surface = terrain.surfaceAt(x, z);
        if (surface) return { x, y: surface.y + lift, z };
      }
      return null;
    };
    const particles: GlowParticle[] = [];
    const winter = season === 'winter';
    const pollenColor = winter
      ? new THREE.Color(0xffffff)
      : new THREE.Color(description.stage === LAST_STAGE ? 0xffe9a8 : 0xfff6d0);
    const pollen = Math.round((winter ? 200 : 110) * ambience.pollen * life);
    for (let i = 0; i < pollen; i++) {
      const p = meadow(winter ? 0 : rng.range(0.2, 2.5), 1);
      if (p) particles.push({ ...p, kind: winter ? GLOW_SNOW : GLOW_POLLEN, color: pollenColor });
    }
    const fireflies = Math.round(54 * ambience.fireflies * life);
    rng = drawn('fireflies');
    for (let i = 0; i < fireflies; i++) {
      const p = meadow(rng.range(0.5, 2.4));
      if (p) particles.push({ ...p, kind: GLOW_FIREFLY, color: new THREE.Color(0xf3ff8e) });
    }
    if (ambience.sparkle >= 0.3) {
      rng = drawn('falls');
      const perFall = Math.round(26 * ambience.sparkle * Math.max(0.5, quality.particles));
      for (const fall of terrain.waterfalls) {
        for (let i = 0; i < perFall; i++) {
          const t = Math.pow(rng.next(), 1.6);
          particles.push({
            x:
              fall.foot[0] + (fall.top[0] - fall.foot[0]) * t + rng.range(-1, 1) * fall.width * 0.9,
            y: fall.foot[1] + (fall.top[1] - fall.foot[1]) * t + rng.range(0.1, 1.2),
            z:
              fall.foot[2] + (fall.top[2] - fall.foot[2]) * t + rng.range(-1, 1) * fall.width * 0.9,
            kind: GLOW_SPARKLE,
            color: new THREE.Color(rng.chance(0.5) ? 0xffffff : 0xffe8a0),
          });
        }
      }
    }
    // Grand moments coming at the next stage: golden sparkles float over them.
    for (const a of terrain.announcements) {
      rng = drawn(a.label);
      for (let i = 0; i < 26; i++) {
        const angle = rng.range(0, TAU);
        const d = a.radius * Math.sqrt(rng.next());
        particles.push({
          x: a.x + Math.cos(angle) * d,
          y: a.y + rng.range(-0.3, 1.4),
          z: a.z + Math.sin(angle) * d,
          kind: GLOW_SPARKLE,
          color: new THREE.Color(rng.chance(0.35) ? 0xffffff : 0xffe08a),
        });
      }
    }
    // Lanterns lit at dusk: a warm halo each, just in front of the paper (the camera is on +z),
    // kept at every quality.
    for (const l of terrain.lanterns) {
      particles.push({
        x: l.x,
        y: l.y,
        z: l.z + 0.3,
        kind: GLOW_LANTERN,
        color: new THREE.Color(0xffb35c),
      });
    }
    // Sparks of the growth burst: always there, growth effects are never cut.
    rng = drawn('burst');
    for (let i = 0; i < 48; i++) {
      particles.push({
        x: 0,
        y: -100,
        z: 0,
        kind: GLOW_BURST,
        color: new THREE.Color(rng.chance(0.6) ? 0xfff2a8 : 0xffffff),
      });
    }
    this.glow = new GlowPoints(particles, seed, shared);
    this.root.add(this.glow.points);

    const effects: THREE.Object3D[] = [];
    const flappers: Flapper[] = [];
    const butterflies = Math.round(14 * ambience.butterflies * life);
    rng = drawn('butterflies');
    for (let i = 0; i < butterflies && population.flowerSpots.length > 0; i++) {
      const spot = rng.pick(population.flowerSpots);
      const [r, g, b] = swatchColor(rng.pick(PETALS), 0.35);
      flappers.push({
        x: spot.x,
        y: spot.y + rng.range(0.7, 1.5),
        z: spot.z,
        radius: rng.range(0.8, 2.2),
        speed: rng.range(0.45, 0.9),
        size: rng.range(0.2, 0.3) * Math.sqrt(size),
        color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
        bird: false,
      });
    }
    const birds = Math.round(4 * ambience.birds * Math.sqrt(terrain.cover));
    rng = drawn('birds');
    for (let i = 0; i < birds; i++) {
      flappers.push({
        x: rng.range(-6, 6) * size,
        y: terrain.frame.center[1] + rng.range(9, 13) * size,
        z: rng.range(-8, 2) * size,
        radius: rng.range(12, 19) * size,
        speed: rng.range(0.14, 0.22),
        size: rng.range(0.55, 0.75) * Math.sqrt(size),
        color: new THREE.Color(rng.chance(0.5) ? 0x3c4a60 : 0xf4f6fa),
        bird: true,
      });
    }
    if (flappers.length > 0) {
      const mesh = new Flappers(flappers, seed, shared);
      this.disposables.push(mesh);
      effects.push(mesh.mesh);
    }

    const palette = foliagePalette(season);
    rng = drawn('leaves');
    const leafColor = (names = palette) => {
      const [r, g, b] = swatchColor(rng.pick(names), rng.range(0.1, 0.45));
      return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    };
    const leaves: Leaf[] = [];
    const grown = planting.trees
      .map((tree, i) => ({ tree, info: this.forest.infos[i] }))
      .filter(
        (t) => t.tree.age > 0.6 && t.tree.family !== 'Pine' && !t.tree.islet && !t.tree.giant,
      );
    const falling = Math.round(46 * ambience.fallingLeaves * life);
    for (let i = 0; i < falling && grown.length > 0; i++) {
      const { tree, info } = rng.pick(grown);
      const fall = info.height * 0.7;
      leaves.push({
        x: tree.x + rng.range(-1.6, 1.6),
        y: tree.y + fall,
        z: tree.z + rng.range(-1.6, 1.6),
        fall,
        color: leafColor(),
        burst: false,
      });
    }
    // Trees in blossom shed their petals in the wind.
    const blossoming = grown.filter((t) => t.tree.foliage?.includes('Blossom'));
    const petals = Math.round(70 * life * Math.min(1, blossoming.length / 12));
    for (let i = 0; i < petals; i++) {
      const { tree, info } = rng.pick(blossoming);
      const fall = info.height * 0.8;
      leaves.push({
        x: tree.x + rng.range(-1.4, 1.4),
        y: tree.y + fall,
        z: tree.z + rng.range(-1.4, 1.4),
        fall,
        color: leafColor(['Blossom', 'PetalPink', 'PetalWhite']),
        burst: false,
      });
    }
    // Leaves of a great tree spiral down around its trunk.
    const canopy = terrain.canopy;
    if (canopy) {
      const ground = terrain.surfaceAt(canopy.x, canopy.z)?.y ?? 0;
      const spiralling = Math.min(
        MAX_SPIRAL_LEAVES,
        Math.round(40 * life * Math.min(1, ambience.fallingLeaves * 1.6)),
      );
      for (let i = 0; i < spiralling; i++) {
        const y = canopy.y + rng.range(-1, 1.5);
        leaves.push({
          x: canopy.x,
          y,
          z: canopy.z,
          fall: y - ground,
          color: leafColor(),
          burst: false,
          spiral: {
            x: canopy.x,
            z: canopy.z,
            radius: rng.range(canopy.trunk + 1.2, Math.max(canopy.trunk + 2, canopy.radius * 0.55)),
            turns: rng.range(1.2, 2.2) * (rng.chance(0.5) ? 1 : -1),
          },
        });
      }
    }
    for (let i = 0; i < 28; i++) {
      leaves.push({ x: 0, y: -100, z: 0, fall: 0, color: leafColor(), burst: true });
    }
    this.leaves = new Leaves(leaves, seed, shared);
    effects.push(this.leaves.mesh);

    const puffs: { x: number; y: number; z: number }[] = [];
    rng = drawn('foam');
    for (const fall of terrain.waterfalls) {
      const count = Math.max(4, Math.round(6.5 * fall.width * quality.particles));
      for (let i = 0; i < count; i++) {
        puffs.push({
          x: fall.foot[0] + rng.range(-0.5, 0.5) * fall.width,
          y: fall.foot[1] + (fall.splash ? 0.02 : rng.range(-0.6, 0.6)),
          z: fall.foot[2] + rng.range(-0.5, 0.5) * fall.width,
        });
      }
    }
    const foam = new Foam(puffs, seed, shared);
    this.disposables.push(foam);
    effects.push(foam.mesh);

    if (ambience.sunRays > 0 && quality.sunRays) {
      const rays = new SunRays(
        seed,
        sunDirection(ambience),
        stage.viewOffset,
        terrain.extent,
        new THREE.Color(ambience.sun.color),
        0.075 * ambience.sunRays,
        shared,
      );
      this.disposables.push(rays);
      this.root.add(rays.mesh);
    }
    let canopyRayTriangles = 0;
    if (canopy && ambience.canopyRays > 0 && quality.canopyRays) {
      const rays = new CanopyRays(
        seed,
        sunDirection(ambience),
        stage.viewOffset,
        canopy,
        terrain.surfaceAt(canopy.x, canopy.z)?.y ?? 0,
        new THREE.Color(ambience.sun.color),
        0.11 * ambience.canopyRays,
        shared,
      );
      this.disposables.push(rays);
      this.root.add(rays.mesh);
      canopyRayTriangles = CANOPY_RAYS * 2;
    }
    // Rainbow over the widest fall landing in water.
    const cascade = terrain.waterfalls
      .filter((fall) => fall.splash)
      .sort((a, b) => b.width - a.width)[0];
    let rainbowTriangles = 0;
    if (ambience.rainbow > 0 && quality.rainbow && cascade) {
      const rainbow = new Rainbow(
        new THREE.Vector3(cascade.foot[0], cascade.foot[1] - 1.5, cascade.foot[2] + 1.5),
        Math.max(6, (cascade.top[1] - cascade.foot[1]) * 1.9),
        0.5 * ambience.rainbow,
        shared,
      );
      this.disposables.push(rainbow);
      this.root.add(rainbow.mesh);
      rainbowTriangles = RAINBOW_TRIANGLES;
    }
    this.root.add(...effects);
    this.fogged = [...effects, this.glow.points, ...(this.cloudSea ? [this.cloudSea.mesh] : [])];

    stage.scene.add(this.root);

    const infos = this.forest.infos;
    const parts = compositionTriangles(composition, assets);
    this.stats = {
      triangles:
        parts.ground +
        parts.water +
        this.forest.triangles +
        parts.instances +
        parts.clouds +
        this.herd.triangles +
        effectTriangles(flappers.length, leaves.length, puffs.length) +
        rainbowTriangles +
        canopyRayTriangles +
        drifterTriangles +
        (this.cloudSea ? CLOUD_SEA_TRIANGLES : 0) +
        BACKDROP_TRIANGLES,
      treeTriangles: this.forest.triangles,
      groundTriangles: parts.ground,
      waterTriangles: parts.water,
      instancedTriangles: parts.instances,
      cloudTriangles: parts.clouds,
      animals: this.herd.group.children.length,
      animalTriangles: this.herd.triangles,
      trees: planting.trees.length,
      largestTree: infos.reduce((max, info) => Math.max(max, info.triangles), 0),
      treeGenerationMs: this.forest.generationMs,
      instances: instanced.reduce((sum, mesh) => sum + mesh.count, 0),
      placeholders: assets.placeholders,
    };
    this.disposables.push(
      { dispose: () => groundMesh.geometry.dispose() },
      { dispose: () => waterMesh.geometry.dispose() },
      { dispose: () => instanced.forEach((mesh) => mesh.dispose()) },
    );
  }

  /** Family, detail and triangle count of each tree. */
  treeInfos(): { family: string; detail: string; triangles: number }[] {
    return this.forest.trees.map((tree, i) => ({
      family: tree.family,
      detail: tree.detail,
      triangles: this.forest.infos[i].triangles,
    }));
  }

  /** Call after framing or a resize: sprites and fog depend on the camera distance. */
  resized(): void {
    const height = this.stage.renderer.domElement.height;
    this.glow.setViewport(
      height,
      this.stage.camera,
      Math.sqrt(Math.max(1, this.terrain.extent.x / 20)),
    );
    this.sky.setAspect(this.stage.camera.aspect);
    this.backdrop.place(this.stage.home, this.stage.distance, height);
    this.fog.near = this.ambience.fog.near * this.stage.distance;
    this.fog.far = this.ambience.fog.far * this.stage.distance;
    applyFog(this.fogged, this.fog);
  }

  /**
   * Growth demonstration: the next demo tree sprouts with a stretch, a burst of sparks and
   * leaves, and a slight camera move. A visual effect, not a game mechanic.
   */
  grow(time: number): void {
    if (this.demo.length === 0) return;
    const tree = this.demo[this.demoNext++ % this.demo.length];
    this.forest.setAge(tree, 0);
    this.startGrowth(tree, 0, 1, time, true);
    const spec = this.forest.trees[tree];
    this.celebrate(spec.x, spec.y, spec.z, time);
  }

  /** Ground point of a slot of the painting, null when it is not open. */
  slotPoint(slot: number): THREE.Vector3 | null {
    const spot = this.terrain.slots.find((s) => s.index === slot);
    const surface = spot && this.terrain.surfaceAt(spot.x, spot.z);
    return spot && surface ? new THREE.Vector3(spot.x, surface.y, spot.z) : null;
  }

  /**
   * The child's new element sprouts in a candidate slot, with a stretch, a burst of sparks
   * and leaves and a slight camera move; the trees placed before grow a little older.
   * `next` is the description with the element. False when the slot was not prepared.
   */
  plant(next: SceneDescription, slot: number, time: number): boolean {
    const point = this.slotPoint(slot);
    const tree = this.slotTrees.get(slot);
    if (!point || !this.candidates.includes(slot)) return false;
    if (tree !== undefined) {
      this.startGrowth(tree, 0, childTreeAge(next, slot), time, true);
    } else if (this.hiddenGroves.has(slot)) {
      this.sprouting.push({ slot, start: time });
      this.groves.set(slot, this.hiddenGroves.get(slot)!);
    } else {
      return false;
    }
    for (const [other, index] of this.slotTrees) {
      const age = this.forest.age(index);
      if (other !== slot && age > 0) {
        this.startGrowth(index, age, childTreeAge(next, other), time, false);
      }
    }
    this.celebrate(point.x, point.y, point.z, time);
    return true;
  }

  /**
   * A bought animal comes into the meadow, where its own draw puts it, with a burst of sparks
   * and the camera leaning towards it. `next` is the description with the animal. False when
   * it found no place.
   */
  adopt(next: SceneDescription, time: number): boolean {
    const plan = planHerd(this.terrain, next.animals, next.seed);
    if (plan.length <= this.herd.size) return false;
    const before = this.herd.triangles;
    for (const member of plan.slice(this.herd.size)) this.herd.add(member);
    this.stats.animals = this.herd.size;
    this.stats.animalTriangles = this.herd.triangles;
    this.stats.triangles += this.herd.triangles - before;
    const at = animalState(plan.at(-1)!, time, {} as AnimalState);
    this.celebrate(at.x, at.y, at.z, time);
    return true;
  }

  /**
   * The grand finale of a complete painting (#33): sparks and leaves burst over its elements
   * one after the other, from left to right while the camera tours it (`Stage.tour`).
   */
  finale(time: number, seconds: number): void {
    const points = this.description.elements
      .map((element) => this.slotPoint(element.slot))
      .filter((point) => point !== null)
      .sort((a, b) => a.x - b.x);
    const count = Math.min(FINALE_BURSTS, points.length);
    const step = (seconds - FINALE_LAST_BURST_S) / Math.max(1, count);
    this.finaleBursts.length = 0;
    for (let i = count - 1; i >= 0; i--) {
      const point = points[Math.floor(((i + 0.5) * points.length) / count)];
      this.finaleBursts.push({ point, at: time + step * (i + 0.5) });
    }
  }

  /** Where the animals stand, and how tall they are. */
  animalSpots(): ReturnType<Herd['spots']> {
    return this.herd.spots();
  }

  /**
   * A touch of the child at (x, y), CSS pixels on the canvas (#28): the animal or the plant
   * nearest to it reacts. An animal jumps (`Herd.react`); a tree or a grove sways and throws
   * a few leaves. Null when nothing is in reach or it already reacts.
   */
  touch(x: number, y: number, time: number): Touched | null {
    const camera = this.stage.camera;
    const width = this.stage.canvas.clientWidth;
    const height = this.stage.canvas.clientHeight;
    const p = this.touchPoint;
    const best = { score: 1, react: null as (() => Touched | null) | null };
    /**
     * Distance from the touch to the upright stroke `tall` high at (px, py, pz), in reaches:
     * `girth` of its length on the screen around it (an animal is as long as it is tall).
     */
    const consider = (
      px: number,
      py: number,
      pz: number,
      tall: number,
      girth: number,
      react: () => Touched | null,
    ) => {
      p.set(px, py, pz).project(camera);
      if (p.z > 1) return;
      const fx = ((p.x + 1) / 2) * width;
      const fy = ((1 - p.y) / 2) * height;
      p.set(px, py + tall, pz).project(camera);
      const tx = ((p.x + 1) / 2) * width;
      const ty = ((1 - p.y) / 2) * height;
      const length = Math.hypot(tx - fx, ty - fy);
      const along =
        length > 0
          ? Math.max(0, Math.min(1, ((x - fx) * (tx - fx) + (y - fy) * (ty - fy)) / length ** 2))
          : 0;
      const distance = Math.hypot(x - fx - (tx - fx) * along, y - fy - (ty - fy) * along);
      const score = distance / Math.max(TOUCH_PX, girth * length);
      if (score < best.score) {
        best.score = score;
        best.react = react;
      }
    };
    // Animals first: they win a tie.
    this.herd
      .spots()
      .forEach((spot, i) =>
        consider(spot.x, spot.y, spot.z, spot.height, 0.8, () =>
          this.herd.react(i, time, camera.position) ? { kind: 'animal', name: spot.name } : null,
        ),
      );
    this.forest.trees.forEach((tree, i) => {
      const age = this.forest.age(i);
      if (age <= 0.05) return;
      const tall = this.forest.infos[i].height * Math.max(0.3, Math.min(1, age));
      consider(tree.x, tree.y, tree.z, tall, 0.3, () => this.sway(i, -1, tall, time));
    });
    for (const slot of this.groves.keys()) {
      const point = this.slotPoint(slot);
      if (point)
        consider(point.x, point.y, point.z, 1.5, 0.6, () => this.sway(-1, slot, 1.5, time));
    }
    return best.react?.() ?? null;
  }

  /** A tree (or a grove: `slot`) sways and a few leaves fly out of it. */
  private sway(tree: number, slot: number, tall: number, time: number): Touched | null {
    if (this.swaying.some((s) => s.tree === tree && s.slot === slot)) return null;
    if (this.growing.some((g) => g.tree === tree) || this.sprouting.some((s) => s.slot === slot)) {
      return null;
    }
    this.swaying.push({ tree, slot, start: time });
    const spot = tree >= 0 ? this.forest.trees[tree] : this.slotPoint(slot)!;
    this.burstOrigin.set(spot.x, spot.y + tall * 0.6, spot.z);
    this.leaves.burst(this.burstOrigin, time);
    return { kind: 'plant' };
  }

  private startGrowth(tree: number, from: number, to: number, time: number, sprout: boolean) {
    for (let i = this.growing.length - 1; i >= 0; i--) {
      if (this.growing[i].tree === tree) this.growing.splice(i, 1);
    }
    if (to !== from) this.growing.push({ tree, from, to, start: time, sprout });
  }

  /** Sparks, leaves and the camera leaning towards what grows. */
  private celebrate(x: number, y: number, z: number, time: number): void {
    this.burstOrigin.set(x, y + 0.4, z);
    this.glow.burst(this.burstOrigin, time);
    this.leaves.burst(this.burstOrigin, time);
    this.burstOrigin.y += 1.6;
    this.stage.focus(this.burstOrigin, time);
  }

  /** Per-frame update: uniforms and a few matrices only, no allocation. */
  update(time: number): void {
    this.materials.shared.uTime.value = time;
    this.clouds.update(time);
    this.herd.update(time);
    for (const s of this.spinners) s.pivot.rotation.z = time * s.speed;
    for (const { mesh, drifter: d } of this.drifters) {
      const a = time * d.speed * TAU;
      mesh.position.set(
        d.x + Math.cos(a) * d.rx,
        d.y + Math.sin(time * 0.6) * 0.35,
        d.z + Math.sin(a) * d.rz,
      );
      mesh.rotation.y = a * 0.5;
    }
    const burst = this.finaleBursts.at(-1);
    if (burst && time >= burst.at) {
      this.finaleBursts.pop();
      this.burstOrigin.copy(burst.point).y += 0.4;
      this.glow.burst(this.burstOrigin, time);
      this.leaves.burst(this.burstOrigin, time);
    }
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i];
      const a = Math.min(1, Math.max(0, (time - g.start) / GROWTH_SECONDS));
      // Fast sprout, slow finish; stretched upwards while it shoots, with a small bounce.
      const eased = 1 - Math.pow(1 - a, 2.6);
      this.forest.setAge(g.tree, g.from + (g.to - g.from) * eased);
      if (g.sprout) {
        const stretch =
          1 +
          0.32 * Math.sin(Math.PI * Math.min(1, a * 1.5)) * (1 - a) +
          0.05 * Math.sin(a * 22) * (1 - a) * (1 - a);
        this.forest.setStretch(g.tree, stretch);
      }
      if (a >= 1) this.growing.splice(i, 1);
    }
    for (let i = this.sprouting.length - 1; i >= 0; i--) {
      const s = this.sprouting[i];
      const a = Math.min(1, Math.max(0, (time - s.start) / (GROWTH_SECONDS * 0.7)));
      // Out of the ground with a little overshoot.
      const scale = a >= 1 ? 1 : 1 + 2.4 * Math.pow(a - 1, 3) + 1.4 * Math.pow(a - 1, 2);
      for (const piece of this.hiddenGroves.get(s.slot)!) {
        this.scratch.makeScale(scale, scale, scale).premultiply(piece.matrix);
        piece.mesh.setMatrixAt(piece.index, this.scratch);
        piece.mesh.instanceMatrix.needsUpdate = true;
      }
      if (a >= 1) this.sprouting.splice(i, 1);
    }
    for (let i = this.swaying.length - 1; i >= 0; i--) {
      const s = this.swaying[i];
      const t = time - s.start;
      const stretch = t >= SWAY_SECONDS ? 1 : 1 + sway(t);
      if (s.tree >= 0) {
        // A great tree only throws its leaves: its decks do not stretch.
        if (!this.forest.trees[s.tree].giant) this.forest.setStretch(s.tree, stretch);
      } else {
        for (const piece of this.groves.get(s.slot)!) {
          this.scratch.makeScale(2 - stretch, stretch, 2 - stretch).premultiply(piece.matrix);
          piece.mesh.setMatrixAt(piece.index, this.scratch);
          piece.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      if (t >= SWAY_SECONDS) this.swaying.splice(i, 1);
    }
    this.lighting.beforeRender(this.stage.renderer);
  }

  dispose(): void {
    this.stage.scene.remove(this.root);
    this.stage.scene.remove(this.lighting.hemisphere, this.lighting.sun, this.lighting.sun.target);
    this.stage.scene.fog = null;
    this.forest.dispose();
    this.sky.dispose();
    this.backdrop.dispose();
    this.clouds.dispose();
    this.cloudSea?.dispose();
    this.lighting.dispose();
    this.glow.dispose();
    this.leaves.dispose();
    this.batch.dispose();
    this.herd.dispose();
    for (const d of this.disposables) d.dispose();
    this.materials.dispose();
  }
}
