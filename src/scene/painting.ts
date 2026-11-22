import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { AssetLibrary } from './assets';
import { swatchColor, type SwatchName } from './atlas';
import { composeScene, compositionTriangles } from './compose';
import type { SceneDescription } from './description';
import type { InstanceBatch } from './render/instancing';
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
  GlowPoints,
  Leaves,
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
export const MAX_EFFECT_TRIANGLES = effectTriangles(20, 120, 30);

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
  private readonly clouds: Clouds;
  private readonly lighting: Lighting;
  private readonly glow: GlowPoints;
  private readonly leaves: Leaves;
  private readonly batch: InstanceBatch;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly fog: THREE.Fog;
  private readonly fogged: THREE.Object3D[];
  private readonly demo: number[];
  private demoNext = 0;
  private readonly growing: { tree: number; start: number }[] = [];
  private readonly burstOrigin = new THREE.Vector3();

  constructor(
    private readonly stage: Stage,
    assets: AssetLibrary,
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
    this.forest = new Forest(planting.trees, assets, season, materials);
    this.root.add(this.forest.mesh);

    this.batch = composition.batch;
    const instanced = this.batch.build((model) => {
      if (model.startsWith('Rock')) return { material: materials.solid, castShadow: true };
      if (model === 'gen:shadow') return { material: materials.solid, castShadow: false };
      return {
        material: materials.vegetation,
        depthMaterial: materials.vegetationDepth,
        castShadow: model.startsWith('Bush'),
      };
    });
    this.root.add(...instanced);

    this.sky = new Sky(ambience);
    this.root.add(this.sky.mesh);
    const radius = Math.max(terrain.extent.x, terrain.extent.z);
    this.clouds = new Clouds(assets, materials.solid, seed, composition.clouds, radius);
    this.root.add(...this.clouds.meshes);

    const center = new THREE.Vector3(...terrain.shadow.center);
    this.lighting = new Lighting(ambience, center, terrain.shadow.radius, quality);
    this.lighting.addTo(stage.scene);
    const fog = new THREE.Fog(ambience.fog.color, 1, 1000);
    this.fog = fog;
    stage.scene.fog = fog;

    // Ambient life.
    const rng = new Rng(seed).fork('life');
    const shared = materials.shared;
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
      : new THREE.Color(description.stage === 4 ? 0xffe9a8 : 0xfff6d0);
    const pollen = Math.round((winter ? 200 : 110) * ambience.pollen * quality.particles);
    for (let i = 0; i < pollen; i++) {
      const p = meadow(winter ? 0 : rng.range(0.2, 2.5), 1);
      if (p) particles.push({ ...p, kind: winter ? GLOW_SNOW : GLOW_POLLEN, color: pollenColor });
    }
    const fireflies = Math.round(54 * ambience.fireflies * quality.particles);
    for (let i = 0; i < fireflies; i++) {
      const p = meadow(rng.range(0.5, 2.4));
      if (p) particles.push({ ...p, kind: GLOW_FIREFLY, color: new THREE.Color(0xf3ff8e) });
    }
    if (ambience.sparkle >= 0.3) {
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
    // Sparks of the growth burst: always there, growth effects are never cut.
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
    const butterflies = Math.round(14 * ambience.butterflies * quality.particles);
    for (let i = 0; i < butterflies && population.flowerSpots.length > 0; i++) {
      const spot = rng.pick(population.flowerSpots);
      const [r, g, b] = swatchColor(rng.pick(PETALS), 0.35);
      flappers.push({
        x: spot.x,
        y: spot.y + rng.range(0.7, 1.5),
        z: spot.z,
        radius: rng.range(0.8, 2.2),
        speed: rng.range(0.45, 0.9),
        size: rng.range(0.2, 0.3),
        color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
        bird: false,
      });
    }
    const birds = Math.round(4 * ambience.birds);
    for (let i = 0; i < birds; i++) {
      flappers.push({
        x: rng.range(-6, 6),
        y: terrain.frame.center[1] + rng.range(9, 13),
        z: rng.range(-8, 2),
        radius: rng.range(12, 19),
        speed: rng.range(0.14, 0.22),
        size: rng.range(0.55, 0.75),
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
    const leafColor = () => {
      const [r, g, b] = swatchColor(rng.pick(palette), rng.range(0.1, 0.45));
      return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    };
    const leaves: Leaf[] = [];
    const grown = planting.trees
      .map((tree, i) => ({ tree, info: this.forest.infos[i] }))
      .filter((t) => t.tree.age > 0.6 && t.tree.family !== 'Pine');
    const falling = Math.round(46 * ambience.fallingLeaves * quality.particles);
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
    for (const fall of terrain.waterfalls) {
      const count = Math.max(5, Math.round((fall.splash ? 12 : 9) * quality.particles));
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
        effectTriangles(flappers.length, leaves.length, puffs.length),
      treeTriangles: this.forest.triangles,
      groundTriangles: parts.ground,
      waterTriangles: parts.water,
      instancedTriangles: parts.instances,
      cloudTriangles: parts.clouds,
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
    this.glow.setViewport(height, this.stage.camera);
    this.sky.setAspect(this.stage.camera.aspect);
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
    const spec = this.forest.trees[tree];
    this.forest.setAge(tree, 0);
    for (let i = this.growing.length - 1; i >= 0; i--) {
      if (this.growing[i].tree === tree) this.growing.splice(i, 1);
    }
    this.growing.push({ tree, start: time });
    this.burstOrigin.set(spec.x, spec.y + 0.4, spec.z);
    this.glow.burst(this.burstOrigin, time);
    this.leaves.burst(this.burstOrigin, time);
    this.burstOrigin.y += 1.6;
    this.stage.focus(this.burstOrigin, time);
  }

  /** Per-frame update: uniforms and a few matrices only, no allocation. */
  update(time: number): void {
    this.materials.shared.uTime.value = time;
    this.clouds.update(time);
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i];
      const a = Math.min(1, Math.max(0, (time - g.start) / GROWTH_SECONDS));
      // Fast sprout, slow finish; stretched upwards while it shoots, with a small bounce.
      const age = 1 - Math.pow(1 - a, 2.6);
      const stretch =
        1 +
        0.32 * Math.sin(Math.PI * Math.min(1, a * 1.5)) * (1 - a) +
        0.05 * Math.sin(a * 22) * (1 - a) * (1 - a);
      this.forest.setAge(g.tree, age);
      this.forest.setStretch(g.tree, stretch);
      if (a >= 1) this.growing.splice(i, 1);
    }
    this.lighting.beforeRender(this.stage.renderer);
  }

  dispose(): void {
    this.stage.scene.remove(this.root);
    this.stage.scene.remove(this.lighting.hemisphere, this.lighting.sun, this.lighting.sun.target);
    this.stage.scene.fog = null;
    this.forest.dispose();
    this.sky.dispose();
    this.clouds.dispose();
    this.lighting.dispose();
    this.glow.dispose();
    this.leaves.dispose();
    this.batch.dispose();
    for (const d of this.disposables) d.dispose();
    this.materials.dispose();
  }
}
