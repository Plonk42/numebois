import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { AnimalLibrary } from './animals';
import type { AssetLibrary } from './assets';
import { swatchColor, type SwatchName } from './atlas';
import { composeScene, compositionTriangles } from './compose';
import { LAST_STAGE, type SceneDescription } from './description';
import { candidateSlots, childTreeAge } from './populate';
import { Backdrop, BACKDROP_TRIANGLES } from './render/backdrop';
import type { InstanceBatch } from './render/instancing';
import { animalState, Herd, planHerd, type AnimalState } from './render/ambient-life';
import { Lighting, sunDirection } from './render/lighting';
import { createMaterials, paletteColor, type SceneMaterials } from './render/materials';
import {
  applyFog,
  Flappers,
  Foam,
  GLOW_BURST,
  GLOW_FIREFLY,
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
import type { Terrain } from './terrain/types';
import type { Season } from './trees/builder';
import { Forest } from './trees/forest';

const GROWTH_SECONDS = 3.6;
const TAU = Math.PI * 2;

function foliagePalette(season: Season): readonly SwatchName[] {
  switch (season) {
    case 'spring':
      return ['Spring', 'Blossom', 'Blossom', 'Spring'];
    case 'summer':
      return ['Summer', 'Spring', 'Summer'];
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
  private readonly sprouting: { slot: number; start: number }[] = [];
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
    const ambience = ambienceFor(description.stage, season);
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
    for (const [slot, pieces] of population.groves) {
      if (!this.candidates.includes(slot)) continue;
      this.hiddenGroves.set(
        slot,
        pieces.map(({ model, index }) => {
          const mesh = instanced.find((m) => m.name === model)!;
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(index, matrix);
          mesh.setMatrixAt(index, hidden);
          mesh.instanceMatrix.needsUpdate = true;
          return { mesh, index, matrix };
        }),
      );
    }

    this.herd = new Herd(animals, planHerd(terrain, description.animals, seed));
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
    const leafColor = () => {
      const [r, g, b] = swatchColor(rng.pick(palette), rng.range(0.1, 0.45));
      return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    };
    const leaves: Leaf[] = [];
    const grown = planting.trees
      .map((tree, i) => ({ tree, info: this.forest.infos[i] }))
      .filter((t) => t.tree.age > 0.6 && t.tree.family !== 'Pine' && !t.tree.islet);
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
    this.fogged = [...effects, this.glow.points];

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
    this.backdrop.place(this.stage.camera, this.stage.distance, height);
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
    this.lighting.dispose();
    this.glow.dispose();
    this.leaves.dispose();
    this.batch.dispose();
    this.herd.dispose();
    for (const d of this.disposables) d.dispose();
    this.materials.dispose();
  }
}
