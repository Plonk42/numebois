import type { Rng } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import type { MeshWriter } from '../mesh-data';

/** Outline of a floating diorama: half extents, centre on z, and the shape of its rim. */
export interface DioramaOutline {
  hx: number;
  hz: number;
  cz: number;
  /** Exponent of the outline: lower is rounder. */
  power: number;
  /** Amplitudes and phases of the waves of the outline. */
  wobble: readonly [number, number, number, number];
}

export interface GroundGrid {
  /** Points [x, y, z], row by row. */
  points: number[][];
  cols: number;
  rows: number;
}

/**
 * Points of the ground of a diorama: a square grid mapped ring by ring onto its outline, with
 * a little jitter inside. `height` takes the unmirrored x; `mirror` flips the whole diorama.
 */
export function groundGrid(
  rng: Rng,
  o: DioramaOutline,
  cell: number,
  height: (fx: number, z: number) => number,
  mirror = 1,
): GroundGrid {
  const gridX = Math.round((2 * o.hx) / cell);
  const gridZ = Math.round((2 * o.hz) / cell);
  const cols = gridX + 1;
  const rows = gridZ + 1;
  const points: number[][] = [];
  const [a3, p3, a5, p5] = o.wobble;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let u = (i / gridX) * 2 - 1;
      let v = (j / gridZ) * 2 - 1;
      const edge = i === 0 || j === 0 || i === gridX || j === gridZ;
      if (!edge) {
        u += (rng.range(-0.3, 0.3) * 2) / gridX;
        v += (rng.range(-0.3, 0.3) * 2) / gridZ;
      }
      // Square grid to the outline: each square ring maps to a scaled outline.
      const s = Math.max(Math.abs(u), Math.abs(v));
      let fx = 0;
      let z = o.cz;
      if (s > 1e-6) {
        const a = u / s;
        const b = v / s;
        const k =
          s /
          Math.pow(Math.pow(Math.abs(a), o.power) + Math.pow(Math.abs(b), o.power), 1 / o.power);
        const theta = Math.atan2(b, a);
        const wave = 1 + a3 * Math.sin(3 * theta + p3) + a5 * Math.sin(5 * theta + p5);
        fx = a * k * o.hx * wave;
        z = o.cz + b * k * o.hz * wave;
      }
      points.push([fx * mirror, height(fx, z), z]);
    }
  }
  return { points, cols, rows };
}

/**
 * Facets of the ground, wound upwards, each coloured from its centre and slope (0 flat to 1
 * vertical) with a small jitter, then the rocky underside of the diorama.
 */
export function buildDiorama(
  out: MeshWriter,
  grid: GroundGrid,
  rng: Rng,
  cz: number,
  hx: number,
  colour: (cx: number, cy: number, cz: number, slope: number, jitter: number) => [number, number],
  /** Scale of the underside: its point is 11.5 times this below the rim; as deep as it is large. */
  depth = hx / 20,
): void {
  const facet = (a: number[], b: number[], c: number[]) => {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny < 0) [b, c] = [c, b];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const nyy = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const slope = 1 - nyy / (Math.hypot(nx, nyy, nz) || 1);
    const x = (a[0] + b[0] + c[0]) / 3;
    const y = (a[1] + b[1] + c[1]) / 3;
    const z = (a[2] + b[2] + c[2]) / 3;
    out.facet(a, b, c, colour(x, y, z, slope, rng.range(-0.05, 0.05)));
  };
  const { points, cols, rows } = grid;
  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i + 1 < cols; i++) {
      const a = points[j * cols + i];
      const b = points[j * cols + i + 1];
      const c = points[(j + 1) * cols + i + 1];
      const d = points[(j + 1) * cols + i];
      // Alternate the diagonal for a less regular facet pattern.
      if ((i + j) % 2 === 0) {
        facet(a, b, c);
        facet(a, c, d);
      } else {
        facet(a, b, d);
        facet(b, c, d);
      }
    }
  }
  buildSkirt(out, grid, rng, cz, depth);
}

/** Underside of the floating diorama: an earth band, then rock tapering to a point. */
function buildSkirt(out: MeshWriter, grid: GroundGrid, rng: Rng, cz: number, deep: number): void {
  const { points, cols, rows } = grid;
  const loop: number[][] = [];
  for (let i = 0; i < cols - 1; i++) loop.push(points[i]);
  for (let j = 0; j < rows - 1; j++) loop.push(points[j * cols + cols - 1]);
  for (let i = cols - 1; i > 0; i--) loop.push(points[(rows - 1) * cols + i]);
  for (let j = rows - 1; j > 0; j--) loop.push(points[j * cols]);
  const n = loop.length;
  const band1: number[][] = [];
  const band2: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const wave = Math.sin(i * 0.37) * 0.5 + Math.sin(i * 0.11 + 2) * 0.5;
    const k1 = 0.985 - rng.range(0, 0.02);
    band1.push([
      p[0] * k1,
      Math.min(p[1] - 1.1, -1.5) - rng.range(0, 0.7) - wave * 0.3,
      cz + (p[2] - cz) * k1,
    ]);
    const k2 = 0.72 + wave * 0.05 - rng.range(0, 0.05);
    band2.push([p[0] * k2, (-5.2 + wave * 0.9 - rng.range(0, 0.8)) * deep, cz + (p[2] - cz) * k2]);
  }
  const apex = [rng.range(-2, 2), -11.5 * deep, cz + rng.range(-1.5, 1.5)];
  const outward = (a: number[], b: number[], c: number[], swatch: SwatchName, frac: number) => {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const cx = a[0] + b[0] + c[0];
    const cc = a[2] + b[2] + c[2] - 3 * cz;
    if (nx * cx + nz * cc < 0) [b, c] = [c, b];
    out.facet(a, b, c, swatchUV(swatch, frac + rng.range(-0.07, 0.07)));
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Where a mountain is cut by the rim, the wall under it is rock.
    const wall: SwatchName = loop[i][1] > 2.5 ? 'Stone' : 'Earth';
    outward(loop[i], loop[j], band1[j], wall, 0.3);
    outward(loop[i], band1[j], band1[i], wall, 0.36);
    outward(band1[i], band1[j], band2[j], 'Stone', 0.45);
    outward(band1[i], band2[j], band2[i], 'Stone', 0.52);
    outward(band2[i], band2[j], apex, 'Stone', 0.7);
  }
}
