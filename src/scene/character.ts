import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Character, CharacterClip } from './characters';
import { screenPixelRatio } from './render/stage';

export type Mood = 'calm' | 'talk' | 'cheer';

/** Room under the feet, in CSS pixels: the toes come forward. */
const FEET_PX = 10;
/** Turned a little towards the question, at the right. */
const YAW = 0.3;
const PITCH = 0.16;
/** A gesture comes in and out over the breathing in this time, in seconds. */
const BLEND = 0.15;
/** Seconds between two blinks, in turn: never quite regular. */
const BLINKS = [3.2, 4.6, 2.4, 5.1, 3.7];

interface Rig {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<CharacterClip, THREE.AnimationAction>;
}

/**
 * The characters (Plume, the squirrel) in one small canvas of their own, shown in turn by the
 * slate and the cards: they breathe and blink, tilt their head for a hint or an offer and hop
 * for joy. One mesh and one material each, loaded the first time they are shown; drawn only
 * while on the screen.
 */
export class CharacterView {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly rigs = new Map<Character, Rig | 'loading'>();
  private character: Character | null = null;
  private rig: Rig | null = null;
  private host: HTMLElement | null = null;
  private mood: Mood = 'calm';
  private gesture: { clip: CharacterClip; start: number } | null = null;
  private frame = 0;
  private last = 0;
  private time = 0;
  private blinkAt = BLINKS[0];
  private blinks = 0;

  constructor(private readonly baseUrl: string) {
    this.camera.position.set(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(10);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = 1;
    this.camera.far = 20;
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.8);
    sun.position.set(-1.5, 2.5, 2);
    this.scene.add(sun, new THREE.HemisphereLight(0xfff8ec, 0x8c7a66, 2));
    document.addEventListener('visibilitychange', () => this.run());
  }

  private async load(character: Character): Promise<void> {
    this.rigs.set(character, 'loading');
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      const gltf = await loader.loadAsync(this.baseUrl + character.file);
      this.rigs.set(character, this.ready(gltf.scene, gltf.animations));
    } catch (error) {
      this.rigs.delete(character);
      console.warn(character.name, error);
      return;
    }
    if (this.character === character) this.show(character);
  }

  private ready(model: THREE.Object3D, animations: THREE.AnimationClip[]): Rig {
    // Colours are in the vertices.
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      (mesh.material as THREE.Material).dispose();
      mesh.material = this.material;
      // Bounds of the rest pose: the hop would leave them.
      mesh.frustumCulled = false;
    });
    model.rotation.y = YAW;
    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<CharacterClip, THREE.AnimationAction>();
    for (const animation of animations) {
      const action = mixer.clipAction(animation);
      action.play();
      action.setEffectiveWeight(0);
      actions.set(animation.name as CharacterClip, action);
    }
    return { model, mixer, actions };
  }

  /** Puts `character` on the stage once loaded; the canvas is `ready` when it shows. */
  private show(character: Character): void {
    this.character = character;
    const rig = this.rigs.get(character);
    if (rig === undefined) void this.load(character);
    const next = rig === undefined || rig === 'loading' ? null : rig;
    if (this.rig && this.rig !== next) this.scene.remove(this.rig.model);
    this.rig = next;
    if (next) this.scene.add(next.model);
    this.canvas.classList.toggle('ready', next !== null);
    this.run();
  }

  /** Shows `character` in `host`, calm; the canvas fills it. */
  attach(host: HTMLElement, character: Character): void {
    this.host = host;
    host.append(this.canvas);
    this.mood = 'calm';
    this.gesture = null;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
      });
    }
    this.renderer.setPixelRatio(Math.min(screenPixelRatio(), 2));
    this.renderer.setSize(width, height, false);
    const unit = character.pxPerUnit;
    const camera = this.camera;
    camera.left = -width / 2 / unit;
    camera.right = width / 2 / unit;
    camera.bottom = -FEET_PX / unit;
    camera.top = (height - FEET_PX) / unit;
    camera.updateProjectionMatrix();
    this.show(character);
  }

  detach(host: HTMLElement): void {
    if (this.host !== host) return;
    this.host = null;
    this.canvas.remove();
    this.run();
  }

  /** Talking, a tilt of the head; cheering, a hop. */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (mood === 'talk') this.gesture = { clip: 'Tilt', start: this.time };
    else if (mood === 'cheer') this.gesture = { clip: 'Cheer', start: this.time };
  }

  /** Draws while on the screen and the model is ready, never while the tab is hidden. */
  private run(): void {
    const on = this.host !== null && this.rig !== null && document.visibilityState === 'visible';
    if (on && !this.frame) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.loop);
    } else if (!on && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private readonly loop = (now: number) => {
    this.time += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.pose(this.rig!);
    this.renderer!.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.loop);
  };

  private pose({ actions, mixer }: Rig): void {
    const time = this.time;
    let gesture = 0;
    for (const clip of ['Tilt', 'Cheer'] as const) actions.get(clip)!.setEffectiveWeight(0);
    if (this.gesture) {
      const action = actions.get(this.gesture.clip)!;
      const t = time - this.gesture.start;
      const duration = action.getClip().duration;
      if (t >= duration) {
        this.gesture = null;
      } else {
        gesture = Math.min(1, t / BLEND, (duration - t) / BLEND);
        action.time = t;
        action.setEffectiveWeight(gesture);
      }
    }
    const idle = actions.get('Idle')!;
    idle.time = time % idle.getClip().duration;
    idle.setEffectiveWeight(1 - gesture);
    if (time >= this.blinkAt + actions.get('Blink')!.getClip().duration) {
      this.blinks++;
      this.blinkAt = time + BLINKS[this.blinks % BLINKS.length];
    }
    const blink = actions.get('Blink')!;
    blink.time = Math.max(0, time - this.blinkAt);
    blink.setEffectiveWeight(time >= this.blinkAt ? 1 : 0);
    mixer.update(0);
  }
}
