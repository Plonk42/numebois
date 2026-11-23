import * as THREE from 'three';
import type { AnimalName } from './animal-catalog';
import { loadAnimals, type AnimalLibrary } from './animals';
import { loadAssets, type AssetLibrary } from './assets';
import { Soundscape } from './audio/soundscape';
import { MAX_ELEMENTS, parseDescription, stageFor, type SceneDescription } from './description';
import { Painting, type PaintingStats } from './painting';
import { animalPortrait } from './render/portrait';
import { parseViewShares, type View } from './render/explore';
import { QUALITY, QualityGovernor, parseQuality, type Quality } from './render/quality';
import { Stage } from './render/stage';
import type { Season } from './trees/builder';

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
/** A bought animal settles in the meadow, with sparks and the camera leaning towards it. */
const ARRIVAL_MS = 3200;
/** Side of the animal portraits of the shop, in pixels of the image. */
const PORTRAIT_PX = 256;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The demonstration scene: loads the assets, builds the painting, runs the frame loop. */
export class SceneApp {
  readonly stage: Stage;
  readonly sound = new Soundscape();
  description: SceneDescription;
  painting: Painting | null = null;
  assets: AssetLibrary | null = null;
  animals: AnimalLibrary | null = null;
  quality: Quality;
  onCounters: ((counters: SceneCounters) => void) | null = null;

  private governor: QualityGovernor | null = null;
  private time = 0;
  private last = 0;
  private running = false;
  private frameRequest = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private readonly fixedTime: number | null;
  private readonly forcePlaceholders: boolean;
  /** Light over the whole scene while a new stage is built. */
  private readonly veil: HTMLElement;
  private readonly portraits = new Map<AnimalName, string>();
  /** `view=yaw,pitch,zoom,x,z`: an explored view as shares of its limits, for captures. */
  private readonly viewShares: number[] | null;

  constructor(
    canvas: HTMLCanvasElement,
    params: URLSearchParams,
    private readonly baseUrl: string,
  ) {
    this.stage = new Stage(canvas);
    this.veil = document.createElement('div');
    this.veil.id = 'veil';
    this.veil.append(
      Object.assign(document.createElement('p'), { textContent: 'Ta forêt grandit !' }),
    );
    canvas.after(this.veil);
    this.description = parseDescription(params);
    const requested = parseQuality(params.get('quality'));
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

  /** Rebuild the painting from the description (stage, season, seed or quality change). */
  rebuild(): void {
    if (!this.assets || !this.animals) return;
    this.painting?.dispose();
    const settings = QUALITY[this.quality];
    this.stage.setQuality(settings);
    this.painting = new Painting(this.stage, this.assets, this.animals, this.description, settings);
    this.sound.setLevels(this.painting.ambience.sound);
    this.stage.frame(this.painting.terrain.frame);
    if (this.viewShares && this.stage.explorer.active) {
      this.stage.explorer.showShares(this.viewShares);
    }
    this.painting.resized();
    this.renderFrame(0);
  }

  setDescription(description: SceneDescription): void {
    this.description = description;
    this.rebuild();
  }

  setQuality(quality: Quality | 'auto'): void {
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

  /** The explored view: where it is, where it goes, and whether gestures move it. */
  view(): { now: View; goal: View; active: boolean } {
    const explorer = this.stage.explorer;
    return {
      now: { ...explorer.view },
      goal: { ...explorer.destination },
      active: explorer.active,
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
    if (elements.length === MAX_ELEMENTS) this.sound.reward('finale');
    return next;
  }

  /** A bought animal comes into the meadow. Resolves once it has settled, with the new description. */
  async adopt(animal: AnimalName): Promise<SceneDescription> {
    const next = { ...this.description, animals: [...this.description.animals, animal] };
    this.painting?.adopt(next, this.time);
    this.description = next;
    this.sound.reward('element');
    await wait(ARRIVAL_MS);
    return next;
  }

  /**
   * The painting takes another of its seasons, under the veil, without moving anything; a
   * bought season joins them. Resolves once the veil is gone, with the new description.
   */
  async changeSeason(season: Season): Promise<SceneDescription> {
    const before = this.description;
    const bought = !before.seasons.includes(season);
    const next = {
      ...before,
      season,
      seasons: bought ? [...before.seasons, season] : before.seasons,
    };
    if (bought) this.sound.reward('element');
    this.veil.classList.add('on', 'quiet');
    await wait(VEIL_IN_MS);
    this.description = next;
    this.rebuild();
    this.veil.classList.remove('on');
    await wait(VEIL_OUT_MS);
    this.veil.classList.remove('quiet');
    return next;
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
