import { Rng, valueNoise2 } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import type { MeshWriter } from '../mesh-data';
import {
  WATER_FALL,
  WATER_STILL,
  WATER_STREAM,
  type RibbonPoint,
  type WaterBuilder,
} from '../render/water';
import type { Season } from '../trees/builder';
import {
  distanceToPath,
  lerp,
  smoothstep,
  spline,
  type BankPath,
  type Pond,
  type StaticModel,
  type Surface,
  type Terrain,
  type TreeSpot,
  type Waterfall,
} from './types';

const HALF_X = 20;
const HALF_Z = 15.5;
const POWER = 3.4;
const GRID_X = 60;
const GRID_Z = 46;

// Features are placed by hand in a reference layout (possibly mirrored by the seed):
// a rocky ledge at the back left, its waterfall and pond, and a stream winding to the
// front edge where it falls into the void.
const CLIFF = { x: -11.6, z: -11.2, radius: 5.4, height: 5.0 };
const POND = { x: -8.3, z: -4.0, radius: 3.4, level: -0.5, bed: -1.3 };
const STREAM_END_LEVEL = -0.85;
const UPPER_STREAM = [
  [-13.4, -14.6],
  [-12.6, -12.4],
  [-11.0, -10.2],
  [-9.9, -7.6],
];
const LOWER_STREAM = [
  [-7.4, -2.6],
  [-5.2, -1.2],
  [-1.6, 1.4],
  [0.8, 4.8],
  [4.4, 6.8],
  [6.4, 10.2],
  [7.4, 13.6],
  [7.9, 17.5],
];
const CLEARING_SPOTS = [
  [6.0, -6.0],
  [12.2, 1.6],
  [-12.2, 3.2],
  [1.0, -4.2],
  [10.6, 6.6],
  [-7.4, 7.6],
  [14.2, -4.6],
  [-2.6, -8.2],
  [-13.4, -2.0],
];
const DEMO_SPOTS = [
  [5.4, 1.4],
  [-4.4, 5.2],
  [9.2, -2.4],
];

/** Colour of the ground for a season: swatch and usable part of its gradient. */
export function groundSwatch(season: Season): { swatch: SwatchName; from: number; to: number } {
  switch (season) {
    case 'spring':
      return { swatch: 'Spring', from: 0.02, to: 0.5 };
    case 'summer':
      return { swatch: 'Meadow', from: 0.04, to: 0.96 };
    case 'autumn':
      return { swatch: 'DryGrass', from: 0.04, to: 0.96 };
    case 'winter':
      return { swatch: 'Snow', from: 0.02, to: 0.33 };
  }
}

class Clearing implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly staticModels: StaticModel[] = [];
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly extent = { x: HALF_X, z: HALF_Z };
  readonly frame = {
    center: [0, 1.4, -0.4] as [number, number, number],
    size: [HALF_X * 2 - 1, 9, HALF_Z * 2 - 3] as [number, number, number],
    yaw: 0,
    pitch: 27,
  };
  readonly shadow = { center: [0, 2, 0] as [number, number, number], radius: 27 };

  private readonly mirror: number;
  private readonly upper: number[][];
  private readonly lower: number[][];
  private readonly lowerLength: number;
  private readonly wobble: [number, number];
  /** Unit direction of the main fall, from the ledge to the pond. */
  private readonly fall: [number, number];
  private readonly lip: [number, number];

  constructor(private readonly seed: number) {
    const rng = new Rng(seed).fork('clearing');
    this.mirror = rng.chance(0.5) ? -1 : 1;
    this.wobble = [rng.range(0, 6.28), rng.range(0, 6.28)];
    this.upper = spline(UPPER_STREAM, 4);
    this.lower = spline(LOWER_STREAM, 5);
    let length = 0;
    for (let i = 0; i + 1 < this.lower.length; i++) {
      length += Math.hypot(
        this.lower[i + 1][0] - this.lower[i][0],
        this.lower[i + 1][1] - this.lower[i][1],
      );
    }
    this.lowerLength = length;
    const fx = POND.x - CLIFF.x;
    const fz = POND.z - CLIFF.z;
    const fl = Math.hypot(fx, fz);
    this.fall = [fx / fl, fz / fl];
    const end = UPPER_STREAM[UPPER_STREAM.length - 1];
    this.lip = [end[0], end[1]];
    this.compose(rng);
  }

  /** Outline: 1 on the rim of the diorama, less inside. */
  private rim(fx: number, z: number): number {
    const a = fx / HALF_X;
    const b = z / HALF_Z;
    const theta = Math.atan2(b, a);
    const wobble =
      1 + 0.03 * Math.sin(3 * theta + this.wobble[0]) + 0.02 * Math.sin(5 * theta + this.wobble[1]);
    return (
      Math.pow(Math.pow(Math.abs(a), POWER) + Math.pow(Math.abs(b), POWER), 1 / POWER) / wobble
    );
  }

  private waterLevel(along: number): number {
    return lerp(POND.level, STREAM_END_LEVEL, Math.min(1, along / this.lowerLength));
  }

  /** Water surface above a point of the reference layout, or -Infinity away from water. */
  private waterAt(fx: number, z: number): number {
    const dc = Math.hypot(fx - CLIFF.x, z - CLIFF.z);
    if (dc < CLIFF.radius - 0.9) {
      return distanceToPath(this.upper, fx, z).distance < 1.4 ? CLIFF.height - 0.32 : -Infinity;
    }
    if (Math.hypot(fx - POND.x, z - POND.z) < POND.radius + 1.2) return POND.level;
    const s = distanceToPath(this.lower, fx, z);
    return s.distance < 2.4 ? this.waterLevel(s.along) : -Infinity;
  }

  /** Ground height in the reference layout. */
  private heightRef(fx: number, z: number): number {
    const n1 = valueNoise2(this.seed, fx / 9 + 40, z / 9 + 40) - 0.5;
    const n2 = valueNoise2(this.seed + 1, fx / 3.3 + 40, z / 3.3 + 40) - 0.5;
    let h = 0.9 * n1 + 0.3 * n2;
    h += 2.4 * smoothstep(-2.5, -13, z);
    h += 0.9 * smoothstep(11, 19, Math.abs(fx));
    h -= 0.4 * smoothstep(8, 15, z);
    const s = distanceToPath(this.lower, fx, z);
    const bed = this.waterLevel(s.along) - 0.4;
    h = Math.min(h, lerp(bed, h, smoothstep(0.45, 2.3, s.distance)));
    const dp = Math.hypot(fx - POND.x, z - POND.z);
    h = Math.min(h, lerp(POND.bed, h, smoothstep(POND.radius - 1.3, POND.radius + 1.0, dp)));
    const dc = Math.hypot(fx - CLIFF.x, z - CLIFF.z);
    const ledge = 1 - smoothstep(CLIFF.radius - 1.4, CLIFF.radius, dc);
    if (ledge > 0) {
      let top = CLIFF.height + 0.5 * n2;
      const u = distanceToPath(this.upper, fx, z);
      top = Math.min(top, lerp(CLIFF.height - 0.6, top, smoothstep(0.4, 1.3, u.distance)));
      h = lerp(h, top, ledge);
    }
    return h;
  }

  surfaceAt(x: number, z: number): Surface | null {
    const fx = x * this.mirror;
    if (this.rim(fx, z) > 0.985) return null;
    const y = this.heightRef(fx, z);
    const e = 0.35;
    const dx = this.heightRef(fx + e, z) - this.heightRef(fx - e, z);
    const dz = this.heightRef(fx, z + e) - this.heightRef(fx, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const level = this.waterAt(fx, z);
    let kind: Surface['kind'] = 'grass';
    if (y < level + 0.03) kind = 'water';
    else if (y < level + 0.28) kind = 'sand';
    else if (slope > 0.5) kind = 'rock';
    return { y, kind, slope };
  }

  private compose(rng: Rng): void {
    const m = this.mirror;
    const [dx, dz] = this.fall;
    const px = dz;
    const pz = -dx;
    const [lx, lz] = this.lip;
    const ground = (fx: number, z: number) => this.heightRef(fx, z);
    const rock = (
      model: StaticModel['model'],
      fx: number,
      z: number,
      scale: number,
      sink: number,
      y?: number,
    ) => {
      this.staticModels.push({
        model,
        x: fx * m,
        y: (y ?? ground(fx, z)) - sink,
        z,
        yaw: rng.range(0, Math.PI * 2),
        scale,
      });
    };
    // Rocks framing the waterfall, at the foot of the ledge and on its top.
    rock('Rock_1_K', lx + px * 2.7 + dx * 0.9, lz + pz * 2.7 + dz * 0.9, 1.3, 0.9);
    rock('Rock_1_M', lx - px * 2.9 + dx * 0.7, lz - pz * 2.9 + dz * 0.7, 1.35, 0.9);
    rock('Rock_1_N', lx + px * 5.0 + dx * 1.5, lz + pz * 5.0 + dz * 1.5, 1.0, 0.7);
    rock('Rock_2_G', lx - px * 5.4 + dx * 1.6, lz - pz * 5.4 + dz * 1.6, 0.95, 0.5);
    rock('Rock_1_J', CLIFF.x - px * 3.2 - dx * 2.4, CLIFF.z - pz * 3.2 - dz * 2.4, 0.9, 0.4);
    rock('Rock_2_E', UPPER_STREAM[0][0] + 0.3, UPPER_STREAM[0][1] + 0.9, 0.85, 0.3);
    rock('Rock_1_G', lx + px * 1.5 - dx * 0.4, lz + pz * 1.5 - dz * 0.4, 0.9, 0.35);
    rock('Rock_1_G', lx - px * 1.6 - dx * 0.5, lz - pz * 1.6 - dz * 0.5, 0.8, 0.3);
    // Boulders in the pond at the foot of the fall, and a few in the meadow.
    rock('Rock_3_K', lx + dx * 1.9 + px * 1.5, lz + dz * 1.9 + pz * 1.5, 0.6, 0, POND.level - 0.25);
    rock('Rock_3_M', lx + dx * 1.7 - px * 1.7, lz + dz * 1.7 - pz * 1.7, 0.42, 0, POND.level - 0.2);
    rock('Rock_3_K', -15.2, 11.4, 0.75, 0.2);
    rock('Rock_1_G', 16.4, 5.6, 0.8, 0.15);
    rock('Rock_3_M', 2.6, 2.4, 0.4, 0.1);

    const top = CLIFF.height - 0.32;
    this.waterfalls.push({
      top: [lx * m, top, lz],
      foot: [(lx + dx * 1.7) * m, POND.level, lz + dz * 1.7],
      width: 1.6,
      splash: true,
    });
    const exit = this.streamExit();
    this.waterfalls.push({
      top: [exit.x * m, exit.y, exit.z],
      foot: [(exit.x + exit.tx * 1.2) * m, exit.y - 7, exit.z + exit.tz * 1.2],
      width: 1.7,
      splash: false,
    });

    this.banks.push({
      points: this.lower.map((p) => ({ x: p[0] * m, z: p[1] })),
      halfWidth: 1.15,
    });
    const shore: { x: number; z: number }[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      shore.push({
        x: (POND.x + Math.cos(a) * (POND.radius + 0.3)) * m,
        z: POND.z + Math.sin(a) * (POND.radius + 0.3),
      });
    }
    this.banks.push({ points: shore, halfWidth: 0.2 });
    this.ponds.push({ x: POND.x * m, y: POND.level, z: POND.z, radius: POND.radius - 0.9 });

    for (const [fx, z] of DEMO_SPOTS) this.treeSpots.push({ x: fx * m, z, role: 'demo', size: 1 });
    this.treeSpots.push({ x: -15.0 * m, z: 9.4, role: 'hero', size: 1.3 });
    this.treeSpots.push({ x: 15.8 * m, z: 8.8, role: 'hero', size: 1.05 });
    for (const [fx, z] of CLEARING_SPOTS) {
      this.treeSpots.push({ x: fx * m, z, role: 'clearing', size: rng.range(0.85, 1.05) });
    }
    this.forestEdge(rng);
  }

  /** Forest edge: a horseshoe of trees at the back and on the sides, open to the camera. */
  private forestEdge(rng: Rng): void {
    const placed: { x: number; z: number; r: number }[] = this.treeSpots.map((s) => ({
      x: s.x * this.mirror,
      z: s.z,
      r: 3,
    }));
    for (let attempt = 0; attempt < 2600; attempt++) {
      const fx = rng.range(-HALF_X, HALF_X);
      const z = rng.range(-HALF_Z, HALF_Z * 0.72);
      const rim = this.rim(fx, z);
      if (rim > 0.94) continue;
      const back = smoothstep(-5.5, -8.5, z);
      const side = smoothstep(11, 14, Math.abs(fx)) * smoothstep(10.5, 7, z);
      if (Math.max(back, side) < 0.5) continue;
      const dc = Math.hypot(fx - CLIFF.x, z - CLIFF.z);
      const onLedge = dc < CLIFF.radius - 2.3;
      if (dc < CLIFF.radius + 2.0 && !onLedge) continue;
      if (distanceToPath(this.upper, fx, z).distance < 2.0) continue;
      if (Math.hypot(fx - POND.x, z - POND.z) < POND.radius + 2.8) continue;
      if (distanceToPath(this.lower, fx, z).distance < 3.2) continue;
      const deep = z < -10.5 || rim > 0.8;
      const spacing = deep ? 2.5 : 3.0;
      if (placed.some((p) => Math.hypot(p.x - fx, p.z - z) < (p.r + spacing) / 2)) continue;
      placed.push({ x: fx, z, r: spacing });
      this.treeSpots.push({
        x: fx * this.mirror,
        z,
        role: 'edge',
        size: deep ? rng.range(1.2, 1.5) : rng.range(0.95, 1.25),
        conifer: onLedge || (deep && rng.chance(0.55)),
      });
    }
  }

  /** Point where the stream leaves the diorama, with its water level and direction. */
  private streamExit(): { x: number; y: number; z: number; tx: number; tz: number } {
    let along = 0;
    for (let i = 0; i + 1 < this.lower.length; i++) {
      const a = this.lower[i];
      const b = this.lower[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (this.rim(b[0], b[1]) >= 1) {
        // Bisect the segment to the rim.
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2;
          if (this.rim(lerp(a[0], b[0], mid), lerp(a[1], b[1], mid)) < 1) lo = mid;
          else hi = mid;
        }
        return {
          x: lerp(a[0], b[0], lo),
          y: this.waterLevel(along + len * lo) - 0.02,
          z: lerp(a[1], b[1], lo),
          tx: (b[0] - a[0]) / len,
          tz: (b[1] - a[1]) / len,
        };
      }
      along += len;
    }
    const last = this.lower[this.lower.length - 1];
    return { x: last[0], y: STREAM_END_LEVEL, z: last[1], tx: 0, tz: 1 };
  }

  buildGround(out: MeshWriter, season: Season): void {
    const rng = new Rng(this.seed).fork('ground');
    const m = this.mirror;
    const cols = GRID_X + 1;
    const rows = GRID_Z + 1;
    const points: number[][] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let u = (i / GRID_X) * 2 - 1;
        let v = (j / GRID_Z) * 2 - 1;
        const edge = i === 0 || j === 0 || i === GRID_X || j === GRID_Z;
        if (!edge) {
          u += (rng.range(-0.3, 0.3) * 2) / GRID_X;
          v += (rng.range(-0.3, 0.3) * 2) / GRID_Z;
        }
        // Square grid to the outline: each square ring maps to a scaled outline.
        const s = Math.max(Math.abs(u), Math.abs(v));
        let fx = 0;
        let z = 0;
        if (s > 1e-6) {
          const a = u / s;
          const b = v / s;
          const k =
            s / Math.pow(Math.pow(Math.abs(a), POWER) + Math.pow(Math.abs(b), POWER), 1 / POWER);
          const theta = Math.atan2(b, a);
          const wobble =
            1 +
            0.03 * Math.sin(3 * theta + this.wobble[0]) +
            0.02 * Math.sin(5 * theta + this.wobble[1]);
          fx = a * k * HALF_X * wobble;
          z = b * k * HALF_Z * wobble;
        }
        points.push([fx * m, this.heightRef(fx, z), z]);
      }
    }
    const grass = groundSwatch(season);
    const facet = (a: number[], b: number[], c: number[]) => {
      // Wind the facet upwards.
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
      const cx = (a[0] + b[0] + c[0]) / 3;
      const cy = (a[1] + b[1] + c[1]) / 3;
      const cz = (a[2] + b[2] + c[2]) / 3;
      const fx = cx * m;
      const level = this.waterAt(fx, cz);
      const jitter = rng.range(-0.05, 0.05);
      let uv: [number, number];
      if (slope > 0.3) {
        const earthy = level > -Infinity && cy < level + 1.2;
        uv = swatchUV(earthy ? 'Earth' : 'Stone', 0.2 + slope * 0.55 + jitter * 2);
      } else if (cy < level + 0.1) {
        uv = swatchUV('HexSand', 0.3 + Math.min(0.5, (level - cy) * 0.7) + jitter);
      } else {
        const patch = valueNoise2(this.seed + 5, fx / 4.5, cz / 4.5) - 0.5;
        // Darker under the forest edge, lighter on the open meadow.
        const shade = smoothstep(-5, -11, cz) * 0.2 + smoothstep(11, 16, Math.abs(fx)) * 0.12;
        const tone = Math.min(1, Math.max(0, 0.3 + slope * 1.3 + patch * 0.36 + shade + jitter));
        uv = swatchUV(grass.swatch, lerp(grass.from, grass.to, tone));
      }
      out.facet(a, b, c, uv);
    };
    for (let j = 0; j < GRID_Z; j++) {
      for (let i = 0; i < GRID_X; i++) {
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
    this.buildSkirt(out, points, cols, rows, rng);
  }

  /** Underside of the floating diorama: an earth band, then rock tapering to a point. */
  private buildSkirt(
    out: MeshWriter,
    points: number[][],
    cols: number,
    rows: number,
    rng: Rng,
  ): void {
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
        p[2] * k1,
      ]);
      const k2 = 0.72 + wave * 0.05 - rng.range(0, 0.05);
      band2.push([p[0] * k2, -5.2 + wave * 0.9 - rng.range(0, 0.8), p[2] * k2]);
    }
    const apex = [rng.range(-2, 2), -11.5, rng.range(-1.5, 1.5)];
    const outward = (a: number[], b: number[], c: number[], swatch: SwatchName, frac: number) => {
      const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const cx = a[0] + b[0] + c[0];
      const cz = a[2] + b[2] + c[2];
      if (nx * cx + nz * cz < 0) [b, c] = [c, b];
      out.facet(a, b, c, swatchUV(swatch, frac + rng.range(-0.07, 0.07)));
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      outward(loop[i], loop[j], band1[j], 'Earth', 0.3);
      outward(loop[i], band1[j], band1[i], 'Earth', 0.36);
      outward(band1[i], band1[j], band2[j], 'Stone', 0.45);
      outward(band1[i], band2[j], band2[i], 'Stone', 0.52);
      outward(band2[i], band2[j], apex, 'Stone', 0.7);
    }
  }

  buildWater(out: WaterBuilder): void {
    const m = this.mirror;
    const depthShore = (fx: number, z: number, level: number, range: number) =>
      1 - Math.min(1, Math.max(0, (level - this.heightRef(fx, z)) / range));

    // Stream on the ledge, up to the lip.
    const top = CLIFF.height - 0.32;
    const upper: RibbonPoint[] = this.upper.map((p, i) => {
      const a = this.upper[Math.max(0, i - 1)];
      const b = this.upper[Math.min(this.upper.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return {
        x: p[0] * m,
        y: top,
        z: p[1],
        sx: (-(b[1] - a[1]) / l) * m,
        sz: (b[0] - a[0]) / l,
        halfWidth: 0.85,
        shoreCenter: 0.15,
        shoreEdge: 0.9,
      };
    });
    const upperLength = out.ribbon(upper, WATER_STREAM);

    // Main fall: a sheet arcing from the lip into the pond.
    const [dx, dz] = this.fall;
    const [lx, lz] = this.lip;
    const sheet: RibbonPoint[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const reach = -0.25 + 1.95 * Math.pow(t, 0.75);
      const fx = lx + dx * reach;
      sheet.push({
        x: fx * m,
        y: lerp(top, POND.level - 0.05, t * t),
        z: lz + dz * reach,
        sx: dz * m,
        sz: -dx,
        halfWidth: lerp(0.8, 0.95, t),
        shoreCenter: i === 0 ? 0.8 : i === steps ? 1 : 0.2,
        shoreEdge: i === steps ? 1 : 0.55,
        bulge: 0.16 * Math.sin(t * Math.PI),
        outX: dx * m,
        outZ: dz,
      });
    }
    out.ribbon(sheet, WATER_FALL, upperLength);

    // Pond: rings around the centre, foam where the water is shallow.
    const rings = [0.34, 0.68, 1];
    const segments = 22;
    const reach = POND.radius + 1.1;
    const center = out.point(POND.x * m, POND.level, POND.z, 0, 0, WATER_STILL, 0);
    let previous: number[] = [];
    rings.forEach((ring, r) => {
      const current: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const fx = POND.x + Math.cos(a) * reach * ring;
        const z = POND.z + Math.sin(a) * reach * ring;
        current.push(
          out.point(fx * m, POND.level, z, 0, 0, WATER_STILL, depthShore(fx, z, POND.level, 0.6)),
        );
      }
      for (let i = 0; i < segments; i++) {
        const j = (i + 1) % segments;
        // Mirroring flips the winding: keep the faces turned upwards.
        const flip = m < 0;
        if (r === 0) {
          if (flip) out.triangle(center, current[i], current[j]);
          else out.triangle(center, current[j], current[i]);
        } else if (flip) {
          out.triangle(previous[i], current[i], current[j]);
          out.triangle(previous[i], current[j], previous[j]);
        } else {
          out.triangle(previous[i], current[j], current[i]);
          out.triangle(previous[i], previous[j], current[j]);
        }
      }
      previous = current;
    });

    // Lower stream, from the pond to the rim of the diorama.
    const exit = this.streamExit();
    const lower: RibbonPoint[] = [];
    let along = 0;
    for (let i = 0; i < this.lower.length; i++) {
      const p = this.lower[i];
      if (i > 0) along += Math.hypot(p[0] - this.lower[i - 1][0], p[1] - this.lower[i - 1][1]);
      const a = this.lower[Math.max(0, i - 1)];
      const b = this.lower[Math.min(this.lower.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const sx = -(b[1] - a[1]) / l;
      const sz = (b[0] - a[0]) / l;
      const level = this.waterLevel(along) - 0.02;
      const past = this.rim(p[0], p[1]) >= 1;
      const q = past ? [exit.x, exit.z] : p;
      const half = 1.05;
      lower.push({
        x: q[0] * m,
        y: past ? exit.y : level,
        z: q[1],
        sx: sx * m,
        sz,
        halfWidth: half,
        shoreCenter: depthShore(q[0], q[1], level, 0.42) * 0.6,
        shoreEdge: Math.max(
          depthShore(q[0] + sx * half, q[1] + sz * half, level, 0.3),
          depthShore(q[0] - sx * half, q[1] - sz * half, level, 0.3),
        ),
      });
      if (past) break;
    }
    const lowerLength = out.ribbon(lower, WATER_STREAM);

    // The stream falls off the rim and dissolves into foam.
    const last = lower[lower.length - 1];
    const drop: RibbonPoint[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const forward = 0.1 + 1.3 * Math.pow(t, 0.7);
      drop.push({
        x: (exit.x + exit.tx * forward) * m,
        y: exit.y - 7 * t * t,
        z: exit.z + exit.tz * forward,
        sx: last.sx,
        sz: last.sz,
        halfWidth: lerp(0.95, 0.5, t),
        shoreCenter: lerp(0.3, 1, t),
        shoreEdge: lerp(0.6, 1, t),
        bulge: 0.14 * Math.sin(t * Math.PI),
        outX: exit.tx * m,
        outZ: exit.tz,
      });
    }
    out.ribbon(drop, WATER_FALL, lowerLength);
  }
}

export function createClearing(seed: number): Terrain {
  return new Clearing(seed);
}
