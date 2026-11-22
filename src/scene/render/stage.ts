import * as THREE from 'three';
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

/** Renderer, camera and frame loop. The camera frames a box and breathes slightly. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 5, 600);
  /** Unit vector from the framed box towards the camera. */
  readonly viewOffset = new THREE.Vector3(0, 0.45, 0.9).normalize();

  private pixelRatioCap = 1.5;
  private readonly target = new THREE.Vector3();
  /** Distance from the camera to the centre of the framed box. */
  distance = 60;
  private yaw = 0;
  private pitch = 0.47;
  private frameBox: Frame | null = null;

  private readonly focusPoint = new THREE.Vector3();
  private focusStart = -100;
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
  }

  setQuality(quality: QualitySettings): void {
    this.pixelRatioCap = quality.pixelRatio;
    this.renderer.shadowMap.enabled = quality.shadowMapSize > 0;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  /** Resolution is capped: min(devicePixelRatio, cap of the quality tier). */
  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
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

  /** Breathing and focus. No allocation: called every frame. */
  update(time: number): void {
    const yaw = this.yaw + 0.011 * Math.sin(time * 0.21);
    const pitch = this.pitch + 0.005 * Math.sin(time * 0.17 + 1.3);
    let distance = this.distance * (1 + 0.006 * Math.sin(time * 0.13 + 2.1));
    const age = time - this.focusStart;
    let weight = 0;
    if (age >= 0 && age < 5) {
      const rise = Math.min(1, age / 0.9);
      const fall = Math.min(1, Math.max(0, (age - 3.2) / 1.8));
      weight = rise * rise * (3 - 2 * rise) * (1 - fall * fall * (3 - 2 * fall));
    }
    this.lookAt.copy(this.target).lerp(this.focusPoint, 0.3 * weight);
    distance *= 1 - 0.1 * weight;
    this.direction(yaw, pitch, this.offset);
    this.camera.position.copy(this.lookAt).addScaledVector(this.offset, distance);
    this.camera.lookAt(this.lookAt);
  }

  render(): void {
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
