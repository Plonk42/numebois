import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import { MeshWriter } from '../mesh-data';
import { groundSwatch } from '../terrain/clearing';
import type { Season } from '../trees/builder';
import { GLOW_SPARKLE, GlowPoints } from './particles';
import type { Ambience } from './richness';

const TAU = Math.PI * 2;
/** Height of the summit above the island, for an island of radius 1. */
const PEAK = 1.15;
/** Where the summit sits on the screen (-1 to 1) and how far behind the diorama. */
const SCREEN: readonly [number, number] = [0.6, 0.62];
const DEPTH = 2.2;
/** Size of the island, as a share of the distance from the camera to the diorama. */
const SIZE = 0.24;
const RINGS = 8;
const SEGMENTS = 22;
/** Triangles of the island: summit fan, rings, underside. */
export const BACKDROP_TRIANGLES = SEGMENTS * (1 + 2 * (RINGS - 1)) + 3 * SEGMENTS;

/** Facets of a floating island carrying one great mountain, radius 1, summit at PEAK. */
function buildIsland(seed: number, season: Season): MeshWriter {
  const rng = new Rng(seed).fork('backdrop');
  const rings = RINGS;
  const segments = SEGMENTS;
  const lobes = rng.int(3, 5);
  const phase = rng.range(0, TAU);
  const shoulder = rng.range(0.25, 0.45);
  const top: number[][][] = [];
  for (let k = 0; k <= rings; k++) {
    const r = k / rings;
    const ring: number[][] = [];
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU + (k % 2) * (Math.PI / segments);
      const ridge = 1 + 0.22 * Math.sin(lobes * a + phase) + 0.08 * Math.sin(7 * a + phase * 2);
      const t = Math.min(1, r / (0.82 * ridge));
      // A sharp summit, a lower shoulder on one side, then the meadow around the foot.
      const side = Math.max(0, Math.cos(a - phase)) * shoulder * Math.sin(Math.PI * t);
      const y =
        k === 0 ? PEAK : (PEAK * Math.pow(1 - t, 1.5) + side) * (1 + rng.range(-0.06, 0.06));
      const jitter = k === 0 || k === rings ? 0 : rng.range(-0.02, 0.02);
      ring.push([Math.cos(a) * (r + jitter), y + 0.04, Math.sin(a) * (r + jitter)]);
    }
    top.push(ring);
  }
  const out = new MeshWriter(4096, 4096);
  const grass = groundSwatch(season);
  const snowLine = season === 'winter' ? 0.08 : PEAK * 0.55;
  const facet = (
    a: number[],
    b: number[],
    c: number[],
    inside: readonly number[],
    swatch?: SwatchName,
  ) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    if (n[0] * (cx - inside[0]) + n[1] * (cy - inside[1]) + n[2] * (cz - inside[2]) < 0)
      [b, c] = [c, b];
    const slope = 1 - Math.abs(n[1]) / (Math.hypot(n[0], n[1], n[2]) || 1);
    const jitter = rng.range(-0.05, 0.05);
    let uv: [number, number];
    if (swatch) uv = swatchUV(swatch, 0.4 + jitter);
    else if (cy > snowLine + jitter && slope < 0.75) uv = swatchUV('Snow', 0.08 + slope * 0.3);
    else if (cy > 0.12 || slope > 0.45) uv = swatchUV('Stone', 0.25 + slope * 0.5 + jitter);
    else uv = swatchUV(grass.swatch, (grass.from + grass.to) / 2 + jitter * 2);
    out.facet(a, b, c, uv);
  };
  const above = [0, -3, 0];
  for (let k = 0; k < rings; k++) {
    for (let s = 0; s < segments; s++) {
      const n = (s + 1) % segments;
      const [a, b] = [top[k][s], top[k][n]];
      const [c, d] = [top[k + 1][s], top[k + 1][n]];
      if (k === 0) {
        // The first ring meets at the summit.
        facet(a, c, d, above);
        continue;
      }
      facet(a, d, c, above);
      facet(a, b, d, above);
    }
  }
  // Underside: an earth band, then rock down to a point, like the diorama.
  const rim = top[rings];
  const band = rim.map((p) => [p[0] * 0.9, -0.25 - rng.range(0, 0.12), p[2] * 0.9]);
  const apex = [rng.range(-0.1, 0.1), -1.05, rng.range(-0.1, 0.1)];
  const below = [0, 0.6, 0];
  for (let s = 0; s < segments; s++) {
    const n = (s + 1) % segments;
    facet(rim[s], rim[n], band[n], below, 'Earth');
    facet(rim[s], band[n], band[s], below, 'Earth');
    facet(band[s], band[n], apex, below, 'Stone');
  }
  return out;
}

/**
 * The mountain moment: a great mountain far behind the diorama, on its own floating island.
 * Until it is revealed, only its silhouette shows through the haze. It keeps the same place
 * on the screen whatever the size of the diorama.
 */
export class Backdrop {
  readonly root = new THREE.Group();
  readonly triangles: number;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.Material;
  private readonly sparkles: GlowPoints | null = null;
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();

  constructor(
    seed: number,
    season: Season,
    revealed: boolean,
    atlas: THREE.Texture,
    ambience: Ambience,
    shared: { uTime: { value: number } },
  ) {
    const writer = buildIsland(seed, season);
    this.triangles = writer.triangles;
    if (revealed) {
      // Far away: lit like the scene, lifted towards the haze.
      this.material = new THREE.MeshLambertMaterial({
        map: atlas,
        fog: false,
        emissive: new THREE.Color(ambience.fog.color).multiplyScalar(0.18),
      });
    } else {
      const haze = new THREE.Color(ambience.fog.color).lerp(
        new THREE.Color(ambience.sky.zenith),
        0.55,
      );
      this.material = new THREE.MeshBasicMaterial({ color: haze.multiplyScalar(0.82), fog: false });
      const particles = Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * TAU * 3.7;
        const d = 0.15 + (i % 5) * 0.1;
        return {
          x: Math.cos(a) * d,
          y: PEAK * (0.55 + 0.1 * (i % 4)),
          z: Math.sin(a) * d + 0.3,
          kind: GLOW_SPARKLE,
          color: new THREE.Color(i % 3 === 0 ? 0xffffff : 0xffe08a),
        };
      });
      this.sparkles = new GlowPoints(particles, seed, shared);
      this.root.add(this.sparkles.points);
    }
    this.mesh = new THREE.Mesh(writer.toGeometry(), this.material);
    this.mesh.name = 'backdrop';
    this.root.add(this.mesh);
    this.root.name = 'backdrop';
  }

  /** Place it in the upper corner of the view; call after framing or a resize. */
  place(camera: THREE.PerspectiveCamera, distance: number, height: number): void {
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
    this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize();
    this.up.crossVectors(this.right, this.forward);
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * camera.aspect;
    const reach = distance * DEPTH;
    const size = distance * SIZE;
    this.root.position
      .copy(camera.position)
      .addScaledVector(this.forward, reach)
      .addScaledVector(this.right, SCREEN[0] * tanH * reach)
      .addScaledVector(this.up, SCREEN[1] * tanV * reach);
    this.root.position.y -= PEAK * size;
    this.root.scale.setScalar(size);
    this.root.updateMatrixWorld();
    this.sparkles?.setViewport(height, camera, Math.sqrt(size));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.sparkles?.dispose();
  }
}
