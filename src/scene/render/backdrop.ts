import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import { MeshWriter } from '../mesh-data';
import { groundSwatch } from '../terrain/clearing';
import type { Reveal } from '../terrain/types';
import type { Season } from '../trees/builder';
import { GLOW_SPARKLE, GlowPoints } from './particles';
import { veiled } from './materials';
import type { Ambience } from './richness';

const TAU = Math.PI * 2;
/** Height of the main summit above the island, for a main mountain of radius 1. */
const PEAK = 1.15;
/** Where the main summit sits on the screen (-1 to 1) and how far behind the diorama. */
const SCREEN: readonly [number, number] = [0.45, 0.62];
const DEPTH = 2.2;
/** Size of the main mountain, as a share of the distance from the camera to the diorama. */
const SIZE = 0.24;
/** The chain: the great mountain and two lower ones behind it, rings and segments of each. */
const CHAIN = [
  { x: 0, z: 0, radius: 1, peak: 1, rings: 8, segments: 22 },
  { x: -1.15, z: -0.35, radius: 0.8, peak: 0.72, rings: 6, segments: 18 },
  { x: 1.1, z: -0.45, radius: 0.72, peak: 0.6, rings: 6, segments: 18 },
] as const;
/** Half extents of the island under the chain. */
const ISLAND: readonly [number, number] = [2.05, 1.2];
const ISLAND_SEGMENTS = 28;
/** Triangles of the chain (summit fan and rings of each mountain) and of its island. */
export const BACKDROP_TRIANGLES =
  CHAIN.reduce((sum, m) => sum + m.segments * (1 + 2 * (m.rings - 1)), 0) + 8 * ISLAND_SEGMENTS;

/** Rings of vertices of one mountain of the chain, from its summit to its foot. */
function mountainRings(rng: Rng, mountain: (typeof CHAIN)[number]): number[][][] {
  const { rings, segments, radius } = mountain;
  const peak = PEAK * mountain.peak * rng.range(0.92, 1.08);
  const cx = mountain.x + rng.range(-0.08, 0.08);
  const cz = mountain.z + rng.range(-0.06, 0.06);
  const lobes = rng.int(3, 5);
  const phase = rng.range(0, TAU);
  const shoulder = rng.range(0.25, 0.45) * mountain.peak;
  const top: number[][][] = [];
  for (let k = 0; k <= rings; k++) {
    const r = k / rings;
    const ring: number[][] = [];
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * TAU + (k % 2) * (Math.PI / segments);
      const ridge = 1 + 0.22 * Math.sin(lobes * a + phase) + 0.08 * Math.sin(7 * a + phase * 2);
      const t = Math.min(1, r / (0.82 * ridge));
      // A sharp summit, a lower shoulder on one side; the foot sinks under the meadow.
      const side = Math.max(0, Math.cos(a - phase)) * shoulder * Math.sin(Math.PI * t);
      const y =
        k === 0 ? peak : (peak * Math.pow(1 - t, 1.5) + side) * (1 + rng.range(-0.06, 0.06));
      const jitter = k === 0 || k === rings ? 0 : rng.range(-0.02, 0.02);
      const d = (r + jitter) * radius;
      ring.push([cx + Math.cos(a) * d, k === rings ? -0.02 : y, cz + Math.sin(a) * d]);
    }
    top.push(ring);
  }
  return top;
}

/** Facets of a floating island carrying a chain of three mountains, main summit at PEAK. */
function buildIsland(seed: number, season: Season): MeshWriter {
  const rng = new Rng(seed).fork('backdrop');
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
  for (const mountain of CHAIN) {
    const top = mountainRings(rng, mountain);
    const above = [mountain.x, -3, mountain.z];
    for (let k = 0; k < mountain.rings; k++) {
      for (let s = 0; s < mountain.segments; s++) {
        const n = (s + 1) % mountain.segments;
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
  }
  // The island: a meadow around the feet, an earth band, then rock down to a point.
  const ellipse = (scale: number, y: () => number) =>
    Array.from({ length: ISLAND_SEGMENTS }, (_, s) => {
      const a = (s / ISLAND_SEGMENTS) * TAU;
      const wave = scale * (1 + rng.range(-0.04, 0.04));
      return [Math.cos(a) * ISLAND[0] * wave, y(), Math.sin(a) * ISLAND[1] * wave];
    });
  const meadow = () => 0.04 + rng.range(-0.01, 0.01);
  const middle = ellipse(0.55, meadow);
  const rim = ellipse(1, meadow);
  const band = rim.map((p) => [p[0] * 0.92, -0.25 - rng.range(0, 0.12), p[2] * 0.92]);
  const lower = ellipse(0.45, () => -0.7 - rng.range(0, 0.1));
  const center = [0, 0.04, 0];
  const apex = [rng.range(-0.1, 0.1), -1.15, rng.range(-0.1, 0.1)];
  const above = [0, -3, 0];
  const below = [0, 0.6, 0];
  for (let s = 0; s < ISLAND_SEGMENTS; s++) {
    const n = (s + 1) % ISLAND_SEGMENTS;
    facet(center, middle[s], middle[n], above);
    facet(middle[s], rim[s], rim[n], above);
    facet(middle[s], rim[n], middle[n], above);
    facet(rim[s], rim[n], band[n], below, 'Earth');
    facet(rim[s], band[n], band[s], below, 'Earth');
    facet(band[s], band[n], lower[n], below, 'Stone');
    facet(band[s], lower[n], lower[s], below, 'Stone');
    facet(lower[s], lower[n], apex, below, 'Stone');
  }
  return out;
}

/**
 * The far chain: a great mountain far behind the diorama, on its own floating island. Until
 * its stage, only its silhouette shows through the haze, with golden sparkles the stage
 * before. It keeps the same place on the screen whatever the size of the diorama.
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
    reveal: Reveal,
    atlas: THREE.Texture,
    ambience: Ambience,
    shared: { uTime: { value: number } },
  ) {
    const writer = buildIsland(seed, season);
    this.triangles = writer.triangles;
    if (reveal === 'shown') {
      // Far away: lit like the scene, lifted towards the haze.
      this.material = veiled(
        new THREE.MeshLambertMaterial({
          map: atlas,
          fog: false,
          emissive: new THREE.Color(ambience.fog.color).multiplyScalar(0.18),
        }),
      );
    } else {
      const haze = new THREE.Color(ambience.fog.color).lerp(
        new THREE.Color(ambience.sky.zenith),
        0.55,
      );
      this.material = new THREE.MeshBasicMaterial({ color: haze.multiplyScalar(0.82), fog: false });
    }
    if (reveal === 'announced') {
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
