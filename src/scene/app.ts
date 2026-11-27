import * as THREE from 'three';
import type { AnimalName } from './animal-catalog';
import { loadAnimals, type AnimalLibrary } from './animals';
import { loadAssets, type AssetLibrary } from './assets';
import { Soundscape } from './audio/soundscape';
import {
  choose,
  isBought,
  parseDescription,
  stageFor,
  type RareName,
  type SceneDescription,
  type SeasonChoice,
} from './description';
import { Painting, type PaintingStats, type Touched } from './painting';
import { animalPortrait } from './render/portrait';
import { parseViewShares, type View } from './render/explore';
import { QUALITY, QualityGovernor, parseQuality, type Quality } from './render/quality';
import { APPROACH_ARRIVAL_SECONDS, APPROACH_SECONDS, Stage, TOUR_SECONDS } from './render/stage';
import { trailArt, type TrailArt } from './render/trail-art';
import {
  factTreeTufts,
  factTreeWood,
  type TuftSprites,
  type WoodPiece,
} from './render/fact-tree-art';

export interface SceneCounters extends PaintingStats {
  fps: number;
  /** Draw calls and triangles of the last frame, shadow pass included. */
  drawCalls: number;
  renderedTriangles: number;
  /** Estimated GPU memory of the scene (geometries, textures, shadow map), in megabytes. */
  sceneMemoryMb: number;
  /** Estimated drawing buffer (colour and depth), in megabytes. */
  bufferMemoryMb: number;
  quality: Quality;
  autoQuality: boolean;
  pixelRatio: number;
}

function textureBytes(texture: THREE.Texture | null | undefined): number {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height) return 0;
  const bytes = texture!.type === THREE.FloatType ? 16 : 4;
  return image.width * image.height * bytes * (texture!.generateMipmaps ? 4 / 3 : 1);
}

/** Growth of a new element, then the veil of light of a new stage, in milliseconds. */
const GROWTH_MS = 3600;
const VEIL_IN_MS = 700;
const VEIL_OUT_MS = 1400;
/** A bought animal that found no place: the time of its arrival all the same. */
const ARRIVAL_MS = 3200;
/** Side of the animal portraits of the shop, in pixels of the image. */
const PORTRAIT_PX = 256;
/** Width of the pictures of whole paintings (Album, next painting), in pixels. */
const PICTURE_PX = 480;

/** Quality chosen in the parent menu or the debug panel: a setting of the device, not of the save. */
const QUALITY_KEY = 'numebois.quality';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The demonstration scene: loads the assets, builds the painting, runs the frame loop. */
export class SceneApp {
  readonly stage: Stage;
  readonly sound = new Soundscape();
  /** The painting in progress. */
  description: SceneDescription;
  /** Another painting shown instead for a while (Album, next painting), null for the one in progress. */
  private other: SceneDescription | null = null;
  painting: Painting | null = null;
  assets: AssetLibrary | null = null;
  animals: AnimalLibrary | null = null;
  quality: Quality;
  onCounters: ((counters: SceneCounters) => void) | null = null;
  /** What the child's touches made react, for the tests. */
  readonly touches: Touched[] = [];

  private governor: QualityGovernor | null = null;
  private time = 0;
  private last = 0;
  private running = false;
  private frameRequest = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private readonly fixedTime: number | null;
  /** Promises waiting for a time of the scene (`after`). */
  private readonly timers: { at: number; resolve: () => void }[] = [];
  private readonly forcePlaceholders: boolean;
  /** Light over the whole scene while a new stage is built. */
  private readonly veil: HTMLElement;
  private readonly portraits = new Map<AnimalName, string>();
  private readonly trails = new Map<number, TrailArt>();
  private readonly factTrees = new Map<string, string>();
  private tufts: TuftSprites | null = null;
  /** `view=yaw,pitch,zoom,x,z`: an explored view as shares of its limits, for captures. */
  private readonly viewShares: number[] | null;

  constructor(
    canvas: HTMLCanvasElement,
    params: URLSearchParams,
    private readonly baseUrl: string,
  ) {
    this.stage = new Stage(canvas);
    // Only while the child explores: never during a question (#28).
    this.stage.explorer.onTap = (x, y) => {
      const touched = this.painting?.touch(x, y, this.time);
      if (!touched) return;
      this.touches.push(touched);
      if (touched.kind === 'plant') this.sound.song((2 * x) / canvas.clientWidth - 1);
    };
    this.veil = document.createElement('div');
    this.veil.id = 'veil';
    this.veil.append(
      Object.assign(document.createElement('p'), { textContent: 'Ton paysage grandit !' }),
    );
    canvas.after(this.veil);
    this.description = parseDescription(params);
    // `?quality=` (captures, tests) wins over the saved choice.
    const requested = parseQuality(params.get('quality') ?? localStorage.getItem(QUALITY_KEY));
    this.quality = requested === 'auto' ? 'high' : requested;
    if (requested === 'auto') {
      this.governor = new QualityGovernor('high', (quality) => {
        this.quality = quality;
        this.rebuild();
      });
    }
    // `time=…` freezes the animation at a given time, for reproducible captures.
    const fixed = params.get('time');
    this.fixedTime = fixed !== null && Number.isFinite(Number(fixed)) ? Number(fixed) : null;
    this.forcePlaceholders = params.get('assets') === 'placeholder';
    this.viewShares = parseViewShares(params.get('view'));
  }

  async start(): Promise<void> {
    [this.assets, this.animals] = await Promise.all([
      loadAssets(this.baseUrl, this.forcePlaceholders),
      loadAnimals(this.baseUrl, this.forcePlaceholders),
    ]);
    this.rebuild();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onVisibility();
  }

  /** Rebuild the painting shown (stage, season, seed or quality change). */
  rebuild(): void {
    if (!this.assets || !this.animals) return;
    this.painting?.dispose();
    const settings = QUALITY[this.quality];
    this.stage.setQuality(settings);
    this.painting = new Painting(this.stage, this.assets, this.animals, this.shown, settings);
    this.sound.setLevels(this.painting.ambience.sound);
    this.stage.frame(this.painting.terrain.frame);
    if (this.viewShares && this.stage.explorer.active) {
      this.stage.explorer.showShares(this.viewShares);
    }
    this.painting.resized();
    this.renderFrame(0);
  }

  /** A new painting in progress, shown at once. */
  setDescription(description: SceneDescription): void {
    this.description = description;
    this.other = null;
    this.rebuild();
  }

  /** The painting on screen: the one in progress, or another shown for a while. */
  get shown(): SceneDescription {
    return this.other ?? this.description;
  }

  /**
   * Shows another painting (Album, choice of the next one), built at once; null comes back to
   * the painting in progress. The game covers the screen while it is built.
   */
  show(description: SceneDescription | null): void {
    if (description === this.other) return;
    this.other = description;
    this.rebuild();
  }

  /** The painting shown, at its framing, as a small WebP image. */
  picture(): string {
    return this.stage.capture(PICTURE_PX);
  }

  get qualityChoice(): Quality | 'auto' {
    return this.governor ? 'auto' : this.quality;
  }

  /** Changes the quality tier and keeps the choice on this device. */
  setQuality(quality: Quality | 'auto'): void {
    localStorage.setItem(QUALITY_KEY, quality);
    if (quality === 'auto') {
      this.quality = 'high';
      this.governor = new QualityGovernor('high', (q) => {
        this.quality = q;
        this.rebuild();
      });
    } else {
      this.quality = quality;
      this.governor = null;
    }
    this.rebuild();
  }

  /**
   * The child explores the forest (#72), told when the view leaves or comes back to the
   * framing; null stops the gestures and the view glides back to the framing.
   */
  explore(onAway: ((away: boolean) => void) | null): void {
    if (onAway) this.stage.explorer.enable(onAway);
    else this.stage.explorer.disable();
  }

  /** Back to the framing, gliding. */
  recenter(): void {
    this.stage.explorer.recenter();
  }

  /** The explored view: where it is, where it goes, whether gestures move it, the orbit. */
  view(): { now: View; goal: View; active: boolean; orbit: number } {
    const explorer = this.stage.explorer;
    return {
      now: { ...explorer.view },
      goal: { ...explorer.destination },
      active: explorer.active,
      orbit: this.stage.orbiting,
    };
  }

  /** Growth demonstration (debug key or button). */
  grow(): void {
    this.painting?.grow(this.time);
    this.sound.reward('element');
  }

  /** Free slots offered for the next element; the painting is rebuilt first if needed. */
  candidates(): readonly number[] {
    if (this.painting && this.painting.description !== this.description) this.rebuild();
    return this.painting?.candidates ?? [];
  }

  /** What grows in a slot: a tree or a grove. */
  slotKind(slot: number): 'tree' | 'grove' | null {
    return this.painting?.terrain.slots.find((s) => s.index === slot)?.kind ?? null;
  }

  /** Where a slot shows on the screen, in CSS pixels, a little above the ground. */
  slotOnScreen(slot: number): { x: number; y: number } | null {
    const point = this.painting?.slotPoint(slot);
    if (!point) return null;
    point.y += 1.2;
    point.project(this.stage.camera);
    const canvas = this.stage.canvas;
    return {
      x: ((point.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - point.y) / 2) * canvas.clientHeight,
    };
  }

  /** Where each animal shows on the screen, in CSS pixels, at half its height. */
  animalsOnScreen(): { name: AnimalName; x: number; y: number }[] {
    const canvas = this.stage.canvas;
    return (this.painting?.animalSpots() ?? []).map((spot) => {
      const point = new THREE.Vector3(spot.x, spot.y + spot.height / 2, spot.z);
      point.project(this.stage.camera);
      return {
        name: spot.name,
        x: ((point.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - point.y) / 2) * canvas.clientHeight,
      };
    });
  }

  /**
   * The child places an element in a candidate slot: it grows, then a new stage comes under
   * a veil of light when due. Resolves once everything is over, with the new description.
   */
  async plant(slot: number, day: number): Promise<SceneDescription> {
    const before = this.description;
    const elements = [...before.elements, { slot, day }];
    const next = { ...before, elements, stage: stageFor(elements.length) };
    if (!this.candidates().includes(slot) || !this.painting!.plant(next, slot, this.time)) {
      throw new Error(`emplacement ${slot} non préparé`);
    }
    this.description = next;
    this.sound.reward('element');
    await wait(GROWTH_MS);
    if (next.stage !== before.stage) {
      this.veil.classList.add('on');
      await wait(VEIL_IN_MS);
      this.rebuild();
      this.veil.classList.remove('on');
      this.sound.reward('stage');
      await wait(VEIL_OUT_MS);
    }
    return next;
  }

  /**
   * The grand finale of a complete painting (#33): its sound, the camera tours the painting
   * while sparks burst over the elements. Resolves once the camera is back.
   */
  async finale(): Promise<void> {
    this.sound.reward('finale');
    this.stage.tour(this.time);
    this.painting?.finale(this.time, TOUR_SECONDS);
    await wait(TOUR_SECONDS * 1000);
  }

  /** The light over the whole scene, without words: the game covers a change with it. */
  cover(on: boolean): void {
    this.veil.classList.add('quiet');
    this.veil.classList.toggle('on', on);
    if (!on) {
      setTimeout(() => {
        if (!this.veil.classList.contains('on')) this.veil.classList.remove('quiet');
      }, VEIL_OUT_MS);
    }
  }

  /**
   * A bought animal comes into the meadow: the camera comes close, it appears, then the camera
   * goes back. Resolves once the camera is back, with the new description.
   */
  async adopt(animal: AnimalName): Promise<SceneDescription> {
    const next = { ...this.description, animals: [...this.description.animals, animal] };
    const coming = this.painting?.adopt(next, this.time) ?? false;
    this.description = next;
    if (coming) {
      await this.after(APPROACH_ARRIVAL_SECONDS);
      // With the time frozen (captures), the painting does not make it appear by itself.
      this.painting?.arrive(this.time);
    }
    this.sound.reward('element');
    await (coming ? this.after(APPROACH_SECONDS - APPROACH_ARRIVAL_SECONDS) : wait(ARRIVAL_MS));
    return next;
  }

  /**
   * Resolves after `seconds` of the scene's own time, which falls behind the clock when the
   * frames are slow: what waits for the camera stays in step with it.
   */
  private after(seconds: number): Promise<void> {
    if (this.fixedTime !== null) return wait(seconds * 1000).then(() => undefined);
    return new Promise((resolve) => this.timers.push({ at: this.time + seconds, resolve }));
  }

  /** Where the camera is, for the tests. */
  camera(): [number, number, number] {
    return this.stage.camera.position.toArray();
  }

  /** Where the camera is at the framing, without orbit nor exploration, for the tests. */
  framing(): [number, number, number] {
    return this.stage.home.position.toArray();
  }

  /**
   * The painting takes another of its seasons or the night, under the veil, without moving
   * anything; a bought one joins them. Resolves once the veil is gone, with the new description.
   */
  async changeSeason(choice: SeasonChoice): Promise<SceneDescription> {
    const before = this.description;
    const next = choose(before, choice);
    if (!isBought(before, choice)) this.sound.reward('element');
    await this.veiled(next);
    return next;
  }

  /** A bought rare element comes into the painting, under the veil (#46). */
  async addRare(rare: RareName): Promise<SceneDescription> {
    const next = { ...this.description, rares: [...this.description.rares, rare] };
    this.sound.reward('element');
    await this.veiled(next);
    return next;
  }

  /** The painting becomes `next` under the veil; resolves once the veil is gone. */
  private async veiled(next: SceneDescription): Promise<void> {
    this.veil.classList.add('on', 'quiet');
    await wait(VEIL_IN_MS);
    this.description = next;
    this.rebuild();
    this.veil.classList.remove('on');
    await wait(VEIL_OUT_MS);
    this.veil.classList.remove('quiet');
  }

  /** Portrait of an animal for the shop, made once; null before the animals are loaded. */
  portrait(animal: AnimalName): string | null {
    let url = this.portraits.get(animal);
    if (!url && this.animals) {
      url = animalPortrait(this.stage, this.animals, animal, PORTRAIT_PX);
      this.portraits.set(animal, url);
      // The portrait was drawn in a corner of the canvas: the forest covers it again at once.
      this.renderFrame(0);
    }
    return url ?? null;
  }

  /** The trail of `stones` stones drawn with the models of the forest, null while they load. */
  trailArt(stones: number): TrailArt | null {
    let art = this.trails.get(stones);
    if (!art && this.assets) {
      art = trailArt(this.stage, this.assets, stones);
      this.trails.set(stones, art);
      this.renderFrame(0);
    }
    return art ?? null;
  }

  /**
   * The wood of a tree of what is known by heart (#151), `width × height`, drawn once per
   * `key`; null while the models load.
   */
  factTree(
    key: string,
    wood: readonly WoodPiece[],
    width: number,
    height: number,
    ground: boolean,
  ): string | null {
    let url = this.factTrees.get(key);
    if (!url && this.assets) {
      url = factTreeWood(this.stage, this.assets, wood, width, height, ground);
      this.factTrees.set(key, url);
      this.renderFrame(0);
    }
    return url ?? null;
  }

  /** The tufts the facts grow on that tree, null while the models load. */
  factTufts(): TuftSprites | null {
    if (!this.tufts && this.assets) {
      this.tufts = factTreeTufts(this.stage, this.assets);
      this.renderFrame(0);
    }
    return this.tufts;
  }

  private readonly onResize = () => {
    this.stage.resize();
    this.painting?.resized();
    if (!this.running) this.renderFrame(0);
  };

  /** The animation and the sound pause while the tab is hidden. */
  private readonly onVisibility = () => {
    const visible = document.visibilityState === 'visible';
    this.sound.setHidden(!visible);
    if (visible && !this.running) {
      this.running = true;
      this.last = performance.now();
      this.frameRequest = requestAnimationFrame(this.loop);
    } else if (!visible && this.running) {
      this.running = false;
      cancelAnimationFrame(this.frameRequest);
    }
  };

  private readonly loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.renderFrame(dt);
    this.fpsFrames++;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.5) {
      this.fps = this.fpsFrames / this.fpsElapsed;
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
      this.onCounters?.(this.counters());
    }
    this.governor?.frame(dt);
    this.frameRequest = requestAnimationFrame(this.loop);
  };

  private renderFrame(dt: number): void {
    if (!this.painting) return;
    this.time = this.fixedTime ?? this.time + dt;
    this.painting.update(this.time);
    this.stage.update(this.time);
    this.stage.render();
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time < this.timers[i].at) continue;
      this.timers[i].resolve();
      this.timers.splice(i, 1);
    }
  }

  counters(): SceneCounters {
    const info = this.stage.renderer.info;
    const stats = this.painting!.stats;
    let bytes = 0;
    const seen = new Set<unknown>();
    this.stage.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
      if (geometry) {
        for (const attribute of [...Object.values(geometry.attributes), geometry.index]) {
          const array = (attribute as THREE.BufferAttribute | null)?.array;
          if (array && !seen.has(array)) {
            seen.add(array);
            bytes += array.byteLength;
          }
        }
      }
      const instanced = object as THREE.InstancedMesh;
      if (instanced.isInstancedMesh) bytes += instanced.instanceMatrix.array.byteLength;
      for (const material of [mesh.material].flat()) {
        if (!material) continue;
        const candidates = [
          (material as THREE.MeshLambertMaterial).map,
          ...Object.values((material as THREE.ShaderMaterial).uniforms ?? {}).map((u) => u.value),
        ];
        for (const value of candidates) {
          if (value?.isTexture && !seen.has(value)) {
            seen.add(value);
            bytes += textureBytes(value);
          }
        }
      }
    });
    // Textures referenced only by patched materials: atlas, noise and tree data.
    bytes += 128 * 128 * 4 * (4 / 3) + stats.trees * 2 * 16;
    const shadow = QUALITY[this.quality].shadowMapSize;
    bytes += shadow * shadow * 4;
    const canvas = this.stage.renderer.domElement;
    return {
      ...stats,
      fps: this.fps,
      drawCalls: info.render.calls,
      renderedTriangles: info.render.triangles,
      sceneMemoryMb: bytes / (1024 * 1024),
      bufferMemoryMb: (canvas.width * canvas.height * 8) / (1024 * 1024),
      quality: this.quality,
      autoQuality: this.governor !== null,
      pixelRatio: this.stage.renderer.getPixelRatio(),
    };
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameRequest);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.painting?.dispose();
    this.assets?.dispose();
    this.animals?.dispose();
    this.sound.dispose();
    this.stage.dispose();
    this.veil.remove();
  }
}
