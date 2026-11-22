import type { ModelName } from '../asset-catalog';
import type { MeshWriter } from '../mesh-data';
import type { WaterBuilder } from '../render/water';
import type { Season } from '../trees/builder';

export type SurfaceKind = 'grass' | 'sand' | 'rock' | 'water';

export interface Surface {
  y: number;
  kind: SurfaceKind;
  /** 0 flat to 1 vertical. */
  slope: number;
}

/**
 * Place for a tree.
 * - edge: forest edge framing the scene, always there;
 * - hero: large foreground tree, always there;
 * - clearing: trees of the clearing itself, added stage after stage (in list order);
 * - demo: empty slot used by the growth demonstration.
 */
export interface TreeSpot {
  x: number;
  z: number;
  role: 'edge' | 'hero' | 'clearing' | 'demo';
  /** Size factor. */
  size: number;
  /** Prefer a conifer (high or far spots). */
  conifer?: boolean;
}

export interface StaticModel {
  model: ModelName;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  scaleY?: number;
}

export interface Waterfall {
  /** Middle of the lip and of the foot of the fall. */
  top: [number, number, number];
  foot: [number, number, number];
  width: number;
  /** Whether the foot is in water (foam) or in the void. */
  splash: boolean;
}

export interface BankPath {
  points: readonly { x: number; z: number }[];
  halfWidth: number;
}

export interface Pond {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/**
 * A diorama form. Both forms give the same kind of information, so trees, vegetation,
 * light and effects are shared.
 */
export interface Terrain {
  /** Ground geometry, merged in the static mesh of the scene. */
  buildGround(out: MeshWriter, season: Season): void;
  buildWater(out: WaterBuilder): void;
  /** Ground under a point, or null outside the diorama. */
  surfaceAt(x: number, z: number): Surface | null;
  readonly treeSpots: readonly TreeSpot[];
  /** Large rocks and scenery merged in the static mesh. */
  readonly staticModels: readonly StaticModel[];
  readonly waterfalls: readonly Waterfall[];
  /** Banks to dress with rocks and tall grass. */
  readonly banks: readonly BankPath[];
  readonly ponds: readonly Pond[];
  /** Half extents of the area to scatter vegetation on. */
  readonly extent: { x: number; z: number };
  /** Box framed by the camera, and its view angles in degrees. */
  readonly frame: {
    center: [number, number, number];
    size: [number, number, number];
    yaw: number;
    pitch: number;
  };
  /** Sphere covered by the shadow map. */
  readonly shadow: { center: [number, number, number]; radius: number };
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Points of a Catmull-Rom spline through the control points. */
export function spline(
  control: readonly (readonly number[])[],
  samplesPerSegment: number,
): number[][] {
  const out: number[][] = [];
  const at = (i: number) => control[Math.min(control.length - 1, Math.max(0, i))];
  for (let i = 0; i + 1 < control.length; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push(
        p1.map(
          (_, a) =>
            0.5 *
            (2 * p1[a] +
              (-p0[a] + p2[a]) * t +
              (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t +
              (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t * t * t),
        ),
      );
    }
  }
  out.push([...control[control.length - 1]]);
  return out;
}

/** Distance from a point to a polyline in the XZ plane, with the arc length of the closest point. */
export function distanceToPath(
  path: readonly (readonly number[])[],
  x: number,
  z: number,
): { distance: number; along: number; index: number } {
  let best = Infinity;
  let bestAlong = 0;
  let bestIndex = 0;
  let along = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const ax = path[i][0];
    const az = path[i][1];
    const bx = path[i + 1][0];
    const bz = path[i + 1][1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1e-9;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    const len = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bestAlong = along + len * t;
      bestIndex = i;
    }
    along += len;
  }
  return { distance: best, along: bestAlong, index: bestIndex };
}
