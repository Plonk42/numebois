import * as THREE from 'three';
import { Explorer } from './explore';
import type { QualitySettings } from './quality';

export interface Frame {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  /** Degrees: yaw around Y (0 looks towards -z), pitch downwards. */
  yaw: number;
  pitch: number;
  /** Points to keep in view instead of the box: the camera centres itself on them. */
  points?: readonly (readonly [number, number, number])[];
}

const FOV = 30;
const NEAR = 5;
/** The camera tour of the grand finale (#33), in seconds. */
export const TOUR_SECONDS = 9;
/** The camera comes close to a bought animal (#107), stays, then goes back, in seconds. */
const APPROACH = { in: 1.5, stay: 3, out: 1.5 };
/** The animal appears once the camera has come close. */
export const APPROACH_ARRIVAL_SECONDS = APPROACH.in;
export const APPROACH_SECONDS = APPROACH.in + APPROACH.stay + APPROACH.out;
/** Distance to what the camera looks at, at the closest, as a share of the framing's. */
const APPROACH_DISTANCE = 0.45;
/**
 * The slow orbit over the whole painting that shows its relief by parallax (#148): degrees
 * each side, seconds per turn, and seconds to fade in at rest or out when something else moves.
 */
export const ORBIT = { yaw: 4, pitch: 0.8, period: 48, fadeIn: 3, fadeOut: 0.8 } as const;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Screen pixels per CSS pixel, the page scale of a phone (index.html) included. */
export function screenPixelRatio(): number {
  return (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1);
}

/**
 * Renderer, camera and frame loop. The camera frames a box and, while the whole painting is in
 * view, orbits slowly around it; the child may explore around that framing when the game
 * allows it.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, 600);
  /** The camera at the framing, without orbit nor exploration: what the backdrop faces. */
  readonly home = new THREE.PerspectiveCamera(FOV, 1, NEAR, 600);
  readonly explorer: Explorer;
  /** Unit vector from the framed box towards the camera. */
  readonly viewOffset = new THREE.Vector3(0, 0.45, 0.9).normalize();
  /** True while the camera holds still (a question): the orbit fades out. */
  still: () => boolean = () => false;

  private pixelRatioCap = 1.5;
  private readonly target = new THREE.Vector3();
  /** Distance from the camera to the centre of the framed box. */
  distance = 60;
  private yaw = 0;
  private pitch = 0.47;
  private frameBox: Frame | null = null;

  private readonly focusPoint = new THREE.Vector3();
  private focusStart = -100;
  private approachPoint: THREE.Vector3 | null = null;
  private approachStart = -100;
  private tourStart = -100;
  /** How far the orbit has faded in, 0 to 1, and its offsets at full strength (degrees). */
  private orbit = 1;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitClock = 0;
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private readonly lookAt = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.explorer = new Explorer(canvas, () => {
      const view = this.explorer.view;
      const tan = Math.tan((this.camera.fov * Math.PI) / 360);
      return {
        yaw: this.yaw + (view.yaw * Math.PI) / 180,
        pitch: this.pitch + (view.pitch * Math.PI) / 180,
        unitsPerPixel: (2 * tan * this.distance) / view.zoom / (canvas.clientHeight || 1),
      };
    });
    // The child takes the view from where the orbit had brought it, without a jump.
    this.explorer.beforeMove = () => {
      const weight = smooth(this.orbit);
      if (weight > 0) this.explorer.shift(weight * this.orbitYaw, weight * this.orbitPitch);
      this.orbit = 0;
    };
  }

  setQuality(quality: QualitySettings): void {
    this.pixelRatioCap = quality.pixelRatio;
    this.renderer.shadowMap.enabled = quality.shadowMapSize > 0;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  /** Resolution is capped: min(screen pixels per CSS pixel, cap of the quality tier). */
  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(screenPixelRatio(), this.pixelRatioCap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.frameBox) this.frame(this.frameBox);
  }

  /** Place the camera so the whole box is in view (landscape or portrait). */
  frame(box: Frame): void {
    this.frameBox = box;
    this.yaw = (box.yaw * Math.PI) / 180;
    this.pitch = (box.pitch * Math.PI) / 180;
    this.target.set(box.center[0], box.center[1], box.center[2]);
    const dir = this.direction(this.yaw, this.pitch, this.viewOffset);
    const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const tanH = tanV * this.camera.aspect;
    const margin = 0.94;
    let distance = 0;
    const corner = new THREE.Vector3();
    if (box.points) {
      // Each point as (across, up, depth) from the centre of the box.
      const points = box.points.map((p) => {
        corner.set(p[0], p[1], p[2]).sub(this.target);
        return [corner.dot(right), corner.dot(up), corner.dot(dir)];
      });
      // Smallest distance showing every point along an axis, and the offset that gives it.
      const fit = (axis: number, tan: number): [number, number] => {
        const need = (offset: number) =>
          points.reduce((max, p) => Math.max(max, p[2] + Math.abs(p[axis] - offset) / tan), 0);
        let lo = Math.min(...points.map((p) => p[axis]));
        let hi = Math.max(...points.map((p) => p[axis]));
        for (let i = 0; i < 40; i++) {
          const a = lo + (hi - lo) / 3;
          const b = hi - (hi - lo) / 3;
          if (need(a) < need(b)) hi = b;
          else lo = a;
        }
        return [(lo + hi) / 2, need((lo + hi) / 2)];
      };
      const [across, acrossDistance] = fit(0, tanH * margin);
      const [above, aboveDistance] = fit(1, tanV * margin);
      this.target.addScaledVector(right, across).addScaledVector(up, above);
      distance = Math.max(acrossDistance, aboveDistance);
    } else {
      for (let i = 0; i < 8; i++) {
        corner.set(
          ((i & 1 ? 1 : -1) * box.size[0]) / 2,
          ((i & 2 ? 1 : -1) * box.size[1]) / 2,
          ((i & 4 ? 1 : -1) * box.size[2]) / 2,
        );
        const depth = corner.dot(dir);
        distance = Math.max(
          distance,
          depth + Math.abs(corner.dot(right)) / (tanH * margin),
          depth + Math.abs(corner.dot(up)) / (tanV * margin),
        );
      }
    }
    this.distance = distance;
    this.explorer.setRoom([box.size[0] / 2, box.size[2] / 2]);
    this.home.copy(this.camera);
    this.home.near = NEAR;
    this.home.position.copy(this.target).addScaledVector(dir, distance);
    this.home.lookAt(this.target);
    this.home.updateProjectionMatrix();
    this.home.updateMatrixWorld();
    this.update(0);
  }

  private direction(yaw: number, pitch: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
  }

  /** Lean towards a point for a few seconds (growth of a plant), then come back. */
  focus(point: THREE.Vector3, time: number): void {
    this.focusPoint.copy(point);
    this.focusStart = time;
  }

  /**
   * Come close to a point, followed as it moves (a bought animal), stay, then go back to the
   * view of the child, from wherever the exploration had taken it.
   */
  approach(point: THREE.Vector3, time: number): void {
    this.approachPoint = point;
    this.approachStart = time;
  }

  /** The grand finale: the camera swings slowly over the whole painting, rises, and comes back. */
  tour(time: number): void {
    this.tourStart = time;
  }

  /** How far the orbit has faded in, 0 (still) to 1 (full). */
  get orbiting(): number {
    return this.orbit;
  }

  /** Exploration, orbit, focus and tour. No allocation: called every frame. */
  update(time: number): void {
    const view = this.explorer.step();
    let yaw = this.yaw + (view.yaw * Math.PI) / 180;
    let pitch = this.pitch + (view.pitch * Math.PI) / 180;
    let distance = this.distance / view.zoom;
    const tour = (time - this.tourStart) / TOUR_SECONDS;
    const touring = tour >= 0 && tour < 1;
    if (touring) {
      // Left, then right, within the limits of the exploration; a little higher and further.
      const swell = Math.sin(Math.PI * tour);
      yaw += 0.32 * Math.sin(2 * Math.PI * tour) * swell;
      pitch += 0.07 * swell * swell;
      distance *= 1 + 0.08 * swell * swell;
    }
    const age = time - this.focusStart;
    const focusing = age >= 0 && age < 5;
    let weight = 0;
    if (focusing) {
      const rise = Math.min(1, age / 0.9);
      const fall = Math.min(1, Math.max(0, (age - 3.2) / 1.8));
      weight = rise * rise * (3 - 2 * rise) * (1 - fall * fall * (3 - 2 * fall));
    }
    this.lookAt.copy(this.target);
    this.lookAt.x += view.x;
    this.lookAt.z += view.z;
    this.lookAt.lerp(this.focusPoint, 0.3 * weight);
    distance *= 1 - 0.1 * weight;
    const near = time - this.approachStart;
    const approaching = near >= 0 && near < APPROACH_SECONDS;
    if (this.approachPoint && approaching) {
      const close =
        smooth(near / APPROACH.in) *
        (1 - smooth((near - APPROACH.in - APPROACH.stay) / APPROACH.out));
      this.lookAt.lerp(this.approachPoint, close);
      // Never further than the child's own zoom.
      distance += (Math.min(distance, this.distance * APPROACH_DISTANCE) - distance) * close;
    }
    // Only over the whole painting, and alone: never while the child explores.
    const dt = Math.min(0.1, Math.max(0, time - this.orbitClock));
    this.orbitClock = Math.max(this.orbitClock, time);
    const rest =
      this.explorer.atHome &&
      !touring &&
      !focusing &&
      !approaching &&
      !this.still() &&
      !this.reducedMotion?.matches;
    this.orbit = Math.min(
      1,
      Math.max(0, this.orbit + (rest ? dt / ORBIT.fadeIn : -dt / ORBIT.fadeOut)),
    );
    const phase = (2 * Math.PI * time) / ORBIT.period;
    this.orbitYaw = ORBIT.yaw * Math.sin(phase);
    this.orbitPitch = ORBIT.pitch * Math.cos(phase);
    const strength = (smooth(this.orbit) * Math.PI) / 180;
    yaw += strength * this.orbitYaw;
    pitch += strength * this.orbitPitch;
    this.direction(yaw, pitch, this.offset);
    this.camera.position.copy(this.lookAt).addScaledVector(this.offset, distance);
    this.camera.lookAt(this.lookAt);
    // Up close, a nearer clipping plane keeps the trees in front of the camera whole.
    const clip = Math.min(NEAR, distance * 0.2);
    if (Math.abs(clip - this.camera.near) > 0.02) {
      this.camera.near = clip;
      this.camera.updateProjectionMatrix();
    }
  }

  render(): void {
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders a small scene into an image of `size` pixels (portraits of the shop), in a corner
   * of the canvas: render the main scene again in the same task, before the page shows it.
   */
  snapshot(scene: THREE.Scene, camera: THREE.Camera, size: number, background: number): string {
    const renderer = this.renderer;
    const viewport = renderer.getViewport(new THREE.Vector4());
    const clear = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    const css = size / renderer.getPixelRatio();
    renderer.setViewport(0, 0, css, css);
    renderer.setScissor(0, 0, css, css);
    renderer.setScissorTest(true);
    renderer.setClearColor(background, 1);
    renderer.render(scene, camera);
    const image = document.createElement('canvas');
    image.width = size;
    image.height = size;
    const source = renderer.domElement;
    image
      .getContext('2d')!
      .drawImage(source, 0, source.height - size, size, size, 0, 0, size, size);
    renderer.setScissorTest(false);
    renderer.setViewport(viewport);
    renderer.setClearColor(clear, alpha);
    return image.toDataURL('image/png');
  }

  /**
   * Like `snapshot`, with a transparent background and any size (in CSS pixels): rendered
   * over black then over white, the difference gives the coverage of each pixel.
   */
  cutout(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number): string {
    const renderer = this.renderer;
    const ratio = renderer.getPixelRatio();
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    const viewport = renderer.getViewport(new THREE.Vector4());
    const clear = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    renderer.setViewport(0, 0, w / ratio, h / ratio);
    renderer.setScissor(0, 0, w / ratio, h / ratio);
    renderer.setScissorTest(true);
    const source = renderer.domElement;
    const grab = (background: number) => {
      renderer.setClearColor(background, 1);
      renderer.render(scene, camera);
      const image = document.createElement('canvas');
      image.width = w;
      image.height = h;
      const context = image.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(source, 0, source.height - h, w, h, 0, 0, w, h);
      return context;
    };
    const onBlack = grab(0x000000);
    const onWhite = grab(0xffffff).getImageData(0, 0, w, h).data;
    renderer.setScissorTest(false);
    renderer.setViewport(viewport);
    renderer.setClearColor(clear, clearAlpha);
    const pixels = onBlack.getImageData(0, 0, w, h);
    const p = pixels.data;
    for (let i = 0; i < p.length; i += 4) {
      const spread = onWhite[i] - p[i] + onWhite[i + 1] - p[i + 1] + onWhite[i + 2] - p[i + 2];
      const alpha = Math.max(0, Math.min(255, 255 - spread / 3));
      if (alpha > 0) {
        const k = 255 / alpha;
        p[i] = Math.min(255, p[i] * k);
        p[i + 1] = Math.min(255, p[i + 1] * k);
        p[i + 2] = Math.min(255, p[i + 2] * k);
      }
      p[i + 3] = alpha;
    }
    onBlack.putImageData(pixels, 0, 0);
    return onBlack.canvas.toDataURL('image/png');
  }

  /**
   * The painting at its framing, without orbit nor exploration, as a WebP image `width`
   * pixels wide (Album, choice of the next painting); the frame loop draws over it next.
   */
  capture(width: number): string {
    this.renderer.render(this.scene, this.home);
    const source = this.renderer.domElement;
    const image = document.createElement('canvas');
    image.width = width;
    image.height = Math.round((width * source.height) / source.width);
    const context = image.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, image.width, image.height);
    return image.toDataURL('image/webp', 0.8);
  }

  dispose(): void {
    this.explorer.dispose();
    this.renderer.dispose();
  }
}
