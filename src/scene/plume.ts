import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PLUME_FILE, type PlumeClip } from './plume-catalog';

export type PlumeMood = 'calm' | 'talk' | 'cheer';

/** Size of Plume on the screen: CSS pixels per model unit (she is about one unit tall). */
const PX_PER_UNIT = 110;
/** Room under her feet, in CSS pixels: her toes come forward. */
const FEET_PX = 10;
/** She turns a little towards the question, at her right. */
const YAW = 0.3;
const PITCH = 0.16;
/** A gesture comes in and out over the breathing in this time, in seconds. */
const BLEND = 0.15;
/** Seconds between two blinks, in turn: never quite regular. */
const BLINKS = [3.2, 4.6, 2.4, 5.1, 3.7];

/**
 * Plume the owl in her own small canvas, shared by the slate and the end of the trail: she
 * breathes and blinks, tilts her head for a hint and hops for joy after a right answer. One
 * mesh and one material; she is drawn only while on the screen.
 */
export class PlumeView {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<PlumeClip, THREE.AnimationAction>();
  private host: HTMLElement | null = null;
  private mood: PlumeMood = 'calm';
  private gesture: { clip: PlumeClip; start: number } | null = null;
  private frame = 0;
  private last = 0;
  private time = 0;
  private blinkAt = BLINKS[0];
  private blinks = 0;

  constructor() {
    this.camera.position.set(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(10);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = 1;
    this.camera.far = 20;
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.8);
    sun.position.set(-1.5, 2.5, 2);
    this.scene.add(sun, new THREE.HemisphereLight(0xfff8ec, 0x8c7a66, 2));
    document.addEventListener('visibilitychange', () => this.run());
  }

  async load(baseUrl: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(baseUrl + PLUME_FILE);
    this.ready(gltf.scene, gltf.animations);
  }

  private ready(model: THREE.Object3D, animations: THREE.AnimationClip[]): void {
    // Colours are in the vertices.
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      (mesh.material as THREE.Material).dispose();
      mesh.material = material;
      // Bounds of the rest pose: the hop would leave them.
      mesh.frustumCulled = false;
    });
    model.rotation.y = YAW;
    this.scene.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const animation of animations) {
      const action = this.mixer.clipAction(animation);
      action.play();
      action.setEffectiveWeight(0);
      this.actions.set(animation.name as PlumeClip, action);
    }
    this.canvas.classList.add('ready');
    this.run();
  }

  /** Shows Plume in `host`, calm; the canvas fills it. */
  attach(host: HTMLElement): void {
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    const camera = this.camera;
    camera.left = -width / 2 / PX_PER_UNIT;
    camera.right = width / 2 / PX_PER_UNIT;
    camera.bottom = -FEET_PX / PX_PER_UNIT;
    camera.top = (height - FEET_PX) / PX_PER_UNIT;
    camera.updateProjectionMatrix();
    this.run();
  }

  detach(host: HTMLElement): void {
    if (this.host !== host) return;
    this.host = null;
    this.canvas.remove();
    this.run();
  }

  /** Talking, she tilts her head; cheering, she hops. */
  setMood(mood: PlumeMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (mood === 'talk') this.gesture = { clip: 'Tilt', start: this.time };
    else if (mood === 'cheer') this.gesture = { clip: 'Cheer', start: this.time };
  }

  /** Draws while on the screen and the model is ready, never while the tab is hidden. */
  private run(): void {
    const on = this.host !== null && this.mixer !== null && document.visibilityState === 'visible';
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
    this.pose();
    this.renderer!.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.loop);
  };

  private pose(): void {
    const time = this.time;
    let gesture = 0;
    for (const clip of ['Tilt', 'Cheer'] as const) this.actions.get(clip)!.setEffectiveWeight(0);
    if (this.gesture) {
      const action = this.actions.get(this.gesture.clip)!;
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
    const idle = this.actions.get('Idle')!;
    idle.time = time % idle.getClip().duration;
    idle.setEffectiveWeight(1 - gesture);
    if (time >= this.blinkAt + this.actions.get('Blink')!.getClip().duration) {
      this.blinks++;
      this.blinkAt = time + BLINKS[this.blinks % BLINKS.length];
    }
    const blink = this.actions.get('Blink')!;
    blink.time = Math.max(0, time - this.blinkAt);
    blink.setEffectiveWeight(time >= this.blinkAt ? 1 : 0);
    this.mixer!.update(0);
  }
}
