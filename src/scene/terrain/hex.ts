import { Rng } from '../../core/rng';
import {
  COAST_TILES,
  RIVER_TILES,
  SLOPE_LOW_EDGE,
  TILE_RIVER_HALF_WIDTH,
  TILE_RIVER_SURFACE,
  TILE_SEA_SURFACE,
  type ModelName,
} from '../asset-catalog';
import type { AssetLibrary } from '../assets';
import { CELL_U, CELL_V, SWATCHES, swatchUV, type SwatchDef } from '../atlas';
import type { MeshWriter } from '../mesh-data';
import {
  WATER_FALL,
  WATER_STILL,
  WATER_STREAM,
  type RibbonPoint,
  type WaterBuilder,
} from '../render/water';
import type { Season } from '../trees/builder';
import { groundSwatch } from './clearing';
import {
  distanceToPath,
  lerp,
  smoothstep,
  type BankPath,
  type Pond,
  type StaticModel,
  type Surface,
  type Terrain,
  type TreeSpot,
  type Waterfall,
} from './types';

/** World size of one tile unit (a tile is 2 units wide between flat sides, 1 unit high). */
export const TILE_SCALE = 1.5;
/** The board is a hexagon of tiles of this radius. */
export const BOARD_RADIUS = 6;

const S = TILE_SCALE;
const SQ3 = Math.sqrt(3);
const CORNER_RADIUS = (2 / SQ3) * S;
const DEG = Math.PI / 180;
/** Axial neighbour across edge e (edge midpoints at 60°·e, from +x towards +z). */
const EDGE_DIRS = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const;
const SEA_Y = TILE_SEA_SURFACE * S;

export type TileKind = 'sea' | 'coast' | 'land' | 'river' | 'slope' | 'mountain';

export interface HexTile {
  q: number;
  r: number;
  /** World position of the centre. */
  x: number;
  z: number;
  ring: number;
  /** Keys of the six corners (shared with the neighbours). */
  corners: string[];
  /** Height level: the top is at level × TILE_SCALE. */
  level: number;
  kind: TileKind;
  model?: ModelName;
  /** Rotation in steps of 60°, moving the model features towards +z. */
  steps: number;
  riverIn?: number;
  riverOut?: number;
  /** Edge the slope goes down to. */
  lowEdge?: number;
}

const key = (q: number, r: number) => `${q},${r}`;
const mod6 = (n: number) => ((n % 6) + 6) % 6;

/** Rotation moving a tile feature by `steps` × 60° in the edge and corner numbering. */
function yawForSteps(steps: number): number {
  return -steps * 60 * DEG;
}

/** Longest run of land corners is kept; the water corners then form one run. */
function fixCorners(water: boolean[]): boolean {
  const n = water.filter(Boolean).length;
  if (n === 0 || n === 6) return false;
  let bestStart = -1;
  let bestLength = 0;
  for (let s = 0; s < 6; s++) {
    if (water[s] || !water[mod6(s - 1)]) continue;
    let length = 0;
    while (!water[mod6(s + length)]) length++;
    if (length > bestLength) {
      bestLength = length;
      bestStart = s;
    }
  }
  let changed = false;
  for (let c = 0; c < 6; c++) {
    const keep = mod6(c - bestStart) < bestLength;
    if (!water[c] && !keep) {
      water[c] = true;
      changed = true;
    }
  }
  return changed;
}

/** Island plan: a pure function of the seed, without any model data (testable). */
export class HexPlan {
  readonly tiles = new Map<string, HexTile>();
  /** true = land corner. */
  readonly land = new Map<string, boolean>();
  readonly river: HexTile[] = [];
  pool: HexTile | null = null;
  /** Level-2 tile the river springs from, if any. */
  source: HexTile | null = null;

  constructor(readonly seed: number) {
    const rng = new Rng(seed).fork('hex');
    const phases = [0, 1, 2, 3].map(() => rng.range(0, Math.PI * 2));
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
      for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
        if (Math.abs(q + r) > BOARD_RADIUS) continue;
        const x = 2 * S * (q + r / 2);
        const z = SQ3 * S * r;
        const corners: string[] = [];
        for (let c = 0; c < 6; c++) {
          const a = (30 + 60 * c) * DEG;
          const cx = x + Math.cos(a) * CORNER_RADIUS;
          const cz = z + Math.sin(a) * CORNER_RADIUS;
          const k = `${Math.round(cx * 50)},${Math.round(cz * 50)}`;
          corners.push(k);
          if (!this.land.has(k)) this.land.set(k, this.isLand(cx, cz, phases));
        }
        this.tiles.set(key(q, r), {
          q,
          r,
          x,
          z,
          ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)),
          corners,
          level: 0,
          kind: 'sea',
          steps: 0,
        });
      }
    }
    // The outer ring is open sea: the island never touches the rim of the board.
    for (const tile of this.tiles.values()) {
      if (tile.ring === BOARD_RADIUS) for (const c of tile.corners) this.land.set(c, false);
    }
    this.settleCoast();
    this.raise(phases[3], rng);
    this.traceRiver(rng);
    this.settleCoast();
    this.addSlope(rng);
    this.classify(rng);
  }

  private isLand(x: number, z: number, phases: number[]): boolean {
    const steps = Math.hypot(x / (2 * S), z / (2 * S) / 0.92);
    const theta = Math.atan2(z, x);
    const radius =
      4.95 +
      0.3 * Math.sin(2 * theta + phases[0]) +
      0.26 * Math.sin(3 * theta + phases[1]) +
      0.15 * Math.sin(5 * theta + phases[2]);
    return steps < radius;
  }

  neighbour(tile: HexTile, edge: number): HexTile | undefined {
    const d = EDGE_DIRS[mod6(edge)];
    return this.tiles.get(key(tile.q + d[0], tile.r + d[1]));
  }

  water(tile: HexTile): boolean[] {
    return tile.corners.map((c) => !this.land.get(c));
  }

  /** Coast tiles only exist for one run of water corners: turn the stray land corners to water. */
  private settleCoast(): void {
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const tile of this.tiles.values()) {
        if (tile.level > 0) continue;
        const water = this.water(tile);
        if (fixCorners(water)) {
          changed = true;
          water.forEach((w, c) => {
            if (w) this.land.set(tile.corners[c], false);
          });
        }
      }
      if (!changed) return;
    }
  }

  /**
   * Height levels at the back of the island: 1 terrace on the rim, 2 plateau (where the
   * river runs), 3 high block carrying the mountains. The front stays a meadow at level 0.
   */
  private raise(phase: number, rng: Rng): void {
    const full = (tile: HexTile) => this.water(tile).every((w) => !w);
    const zone = new Set<HexTile>();
    for (const tile of this.tiles.values()) {
      const xs = tile.x / (2 * S);
      const zs = tile.z / (SQ3 * S);
      if (full(tile) && zs < 0.35 + 0.5 * Math.sin(xs * 0.9 + phase)) zone.add(tile);
    }
    const inside = (tile: HexTile) =>
      [0, 1, 2, 3, 4, 5].every((e) => zone.has(this.neighbour(tile, e)!));
    for (const tile of zone) tile.level = inside(tile) ? 2 : 1;
    // High block: the plateau tiles at the back, around a column drawn by the seed.
    const x0 = rng.range(-0.9, 0.9);
    for (const tile of zone) {
      const xs = tile.x / (2 * S);
      const zs = tile.z / (SQ3 * S);
      if (tile.level === 2 && zs < -1.6 && Math.abs(xs - x0) < 2.2) tile.level = 3;
    }
  }

  /** River on the plateau, from the foot of the high block to the rim, by tiles `hex_river_*`. */
  private traceRiver(rng: Rng): void {
    const plateau = [...this.tiles.values()].filter((t) => t.level === 1 || t.level === 2);
    const starts: { tile: HexTile; entry: number; score: number }[] = [];
    for (const tile of plateau) {
      for (let e = 0; e < 6; e++) {
        const up = this.neighbour(tile, e);
        if (!up) continue;
        // The channel must start against a wall: the high block, or else the back plateau.
        const back = e === 4 || e === 5;
        if (up.level === 3) starts.push({ tile, entry: e, score: (back ? 3 : 1) + rng.next() });
        else if (up.level === 2 && tile.level === 1 && back) {
          starts.push({ tile, entry: e, score: rng.next() * 0.5 });
        }
      }
    }
    starts.sort((a, b) => b.score - a.score);
    const path: HexTile[] = [];
    const walk = (tile: HexTile, entry: number): boolean => {
      path.push(tile);
      tile.riverIn = entry;
      // Prefer flowing to the front (edges 1 and 2), gently curving.
      const exits = [1, 2, 0, 3].sort((a, b) => {
        const front = (e: number) => (e === 1 || e === 2 ? 0 : 1);
        return front(a) - front(b) || rng.next() - 0.5;
      });
      for (const sharp of [false, true]) {
        for (const exit of exits) {
          const turn = mod6(exit - entry);
          if (turn === 0 || (turn === 1 || turn === 5) !== sharp) continue;
          const next = this.neighbour(tile, exit);
          if (!next || next.level === 3 || path.includes(next)) continue;
          if (next.level === 0) {
            // The fall should face the camera, after at least two river tiles.
            if (path.length < 2 || exit === 0 || exit === 3 || next.ring >= BOARD_RADIUS) continue;
            tile.riverOut = exit;
            this.pool = next;
            return true;
          }
          if (path.length >= 6) continue;
          tile.riverOut = exit;
          if (walk(next, mod6(exit + 3))) return true;
        }
      }
      path.pop();
      tile.riverIn = undefined;
      tile.riverOut = undefined;
      return false;
    };
    for (const start of starts) {
      if (walk(start.tile, start.entry)) {
        const up = this.neighbour(start.tile, start.entry);
        this.source = up && up.level === 3 ? up : null;
        break;
      }
    }
    this.river.push(...path);
    // The whole river runs on the plateau level, and falls two levels into the pool.
    for (const tile of path) tile.level = 2;
    if (this.pool) for (const c of this.pool.corners) this.land.set(c, false);
  }

  /** A ramp from the meadow up to the plateau, facing the camera. */
  private addSlope(rng: Rng): void {
    const candidates: { tile: HexTile; edge: number }[] = [];
    for (const tile of this.tiles.values()) {
      if (tile.level !== 1 || this.river.includes(tile)) continue;
      for (const edge of [1, 2]) {
        const low = this.neighbour(tile, edge);
        if (!low || low.level !== 0 || low === this.pool) continue;
        if (this.water(low).some(Boolean)) continue;
        candidates.push({ tile, edge });
      }
    }
    if (candidates.length === 0) return;
    const pick = rng.pick(candidates);
    pick.tile.kind = 'slope';
    pick.tile.lowEdge = pick.edge;
  }

  private classify(rng: Rng): void {
    for (const tile of this.tiles.values()) {
      if (tile.level >= 1) {
        if (tile.kind === 'slope') {
          tile.model = 'hex_grass_sloped_high';
          tile.steps = mod6(tile.lowEdge! - SLOPE_LOW_EDGE);
        } else if (tile.riverIn !== undefined && tile.riverOut !== undefined) {
          tile.kind = 'river';
          this.riverModel(tile, rng);
        } else {
          tile.kind = tile.level === 3 ? 'mountain' : 'land';
          tile.model = 'hex_grass';
          tile.steps = rng.int(0, 5);
        }
        continue;
      }
      const water = this.water(tile);
      const count = water.filter(Boolean).length;
      if (count === 6) {
        tile.kind = 'sea';
      } else if (count === 0) {
        tile.kind = 'land';
        tile.model = 'hex_grass';
        tile.steps = rng.int(0, 5);
      } else {
        const start = water.findIndex((w, c) => w && !water[mod6(c - 1)]);
        const coast = COAST_TILES.find((t) => t.length === count)!;
        tile.kind = 'coast';
        tile.model = coast.model;
        tile.steps = mod6(start - coast.start);
      }
    }
  }

  private riverModel(tile: HexTile, rng: Rng): void {
    const turn = mod6(tile.riverOut! - tile.riverIn!);
    const gap = Math.min(turn, 6 - turn);
    const options = RIVER_TILES.filter((t) => mod6(t.to - t.from) === gap);
    const choice = gap === 3 && rng.chance(0.5) ? options[options.length - 1] : options[0];
    // River tiles are symmetric for the flow: enter by whichever end fits.
    const first = turn === gap ? tile.riverIn! : tile.riverOut!;
    tile.model = choice.model;
    tile.steps = mod6(first - choice.from);
  }

  /** Midpoint of an edge of a tile, in world coordinates. */
  edgePoint(tile: HexTile, edge: number, scale = 1): [number, number] {
    const a = 60 * mod6(edge) * DEG;
    return [tile.x + Math.cos(a) * S * scale, tile.z + Math.sin(a) * S * scale];
  }

  /** Centre line of the river: points [x, z] from the source to the lip of the fall. */
  riverPath(samples = 6): number[][] {
    const points: number[][] = [];
    for (const tile of this.river) {
      const a = this.edgePoint(tile, tile.riverIn!);
      const b = this.edgePoint(tile, tile.riverOut!);
      for (let i = points.length === 0 ? 0 : 1; i <= samples; i++) {
        const t = i / samples;
        // Quadratic curve through the centre: straight, or a smooth bend.
        const u = 1 - t;
        points.push([
          u * u * a[0] + 2 * u * t * tile.x + t * t * b[0],
          u * u * a[1] + 2 * u * t * tile.z + t * t * b[1],
        ]);
      }
    }
    return points;
  }

  tileAt(x: number, z: number): HexTile | undefined {
    const rf = z / (SQ3 * S);
    const qf = x / (2 * S) - rf / 2;
    const sf = -qf - rf;
    let q = Math.round(qf);
    let r = Math.round(rf);
    const s = Math.round(sf);
    const dq = Math.abs(q - qf);
    const dr = Math.abs(r - rf);
    const ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return this.tiles.get(key(q, r));
  }

  /** Land (1) or water (0) field inside a tile, interpolated from its corners. */
  field(tile: HexTile, x: number, z: number): number {
    const values = tile.corners.map((c) => (this.land.get(c) ? 1 : 0));
    const center = values.reduce<number>((sum, v) => sum + v, 0) / 6;
    const dx = x - tile.x;
    const dz = z - tile.z;
    const angle = (Math.atan2(dz, dx) / DEG + 360) % 360;
    const i = mod6(Math.floor((angle - 30) / 60));
    const j = mod6(i + 1);
    const ax = Math.cos((30 + 60 * i) * DEG) * CORNER_RADIUS;
    const az = Math.sin((30 + 60 * i) * DEG) * CORNER_RADIUS;
    const bx = Math.cos((30 + 60 * j) * DEG) * CORNER_RADIUS;
    const bz = Math.sin((30 + 60 * j) * DEG) * CORNER_RADIUS;
    const det = ax * bz - az * bx;
    const u = (dx * bz - dz * bx) / det;
    const v = (ax * dz - az * dx) / det;
    return center * (1 - u - v) + values[i] * u + values[j] * v;
  }
}

class HexIsland implements Terrain {
  readonly plan: HexPlan;
  readonly treeSpots: TreeSpot[] = [];
  readonly staticModels: StaticModel[] = [];
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly extent = { x: (BOARD_RADIUS * 2 + 1) * S, z: (BOARD_RADIUS * SQ3 + 1.16) * S };
  readonly frame = {
    center: [0, 1.8, 0.6] as [number, number, number],
    size: [(BOARD_RADIUS * 2 + 1) * 2 * S, 9, (BOARD_RADIUS * SQ3 + 1.16) * 2 * S - 3] as [
      number,
      number,
      number,
    ],
    yaw: 0,
    pitch: 31,
  };
  readonly shadow = { center: [0, 2, 0] as [number, number, number], radius: 27 };
  private readonly path: number[][];

  constructor(
    seed: number,
    private readonly assets: AssetLibrary,
  ) {
    this.plan = new HexPlan(seed);
    this.path = this.plan.riverPath();
    this.compose(new Rng(seed).fork('hex-decor'));
  }

  private riverY(): number {
    return ((this.plan.river[0]?.level ?? 2) + TILE_RIVER_SURFACE) * S;
  }

  surfaceAt(x: number, z: number): Surface | null {
    const tile = this.plan.tileAt(x, z);
    if (!tile) return null;
    const top = tile.level * S;
    switch (tile.kind) {
      case 'sea':
        return { y: SEA_Y, kind: 'water', slope: 0 };
      case 'mountain':
        return { y: top, kind: 'rock', slope: 0 };
      case 'land':
        return { y: top, kind: 'grass', slope: 0 };
      case 'river': {
        const d = distanceToPath(this.path, x, z).distance;
        if (d < (TILE_RIVER_HALF_WIDTH + 0.06) * S)
          return { y: this.riverY(), kind: 'water', slope: 0 };
        if (d < (TILE_RIVER_HALF_WIDTH + 0.22) * S) return { y: top, kind: 'sand', slope: 0 };
        return { y: top, kind: 'grass', slope: 0 };
      }
      case 'slope': {
        const a = 60 * tile.lowEdge! * DEG;
        const t = ((x - tile.x) * Math.cos(a) + (z - tile.z) * Math.sin(a)) / S;
        const ramp = smoothstep(0.15, 1, t);
        return { y: lerp(top, top - S * 0.88, ramp), kind: 'grass', slope: ramp > 0.02 ? 0.5 : 0 };
      }
      case 'coast': {
        const f = this.plan.field(tile, x, z);
        if (f < 0.44) return { y: SEA_Y, kind: 'water', slope: 0 };
        if (f < 0.64) return { y: -0.1 * S, kind: 'sand', slope: 0.2 };
        return { y: 0, kind: 'grass', slope: 0 };
      }
    }
  }

  private compose(rng: Rng): void {
    const plan = this.plan;
    const pool = plan.pool;
    const riverY = this.riverY();
    // Waterfalls: the river falls from the plateau into the pool; it springs from the
    // foot of the mountains.
    const last = plan.river[plan.river.length - 1];
    if (last && pool) {
      const [ex, ez] = plan.edgePoint(last, last.riverOut!);
      const a = 60 * last.riverOut! * DEG;
      this.waterfalls.push({
        top: [ex, riverY, ez],
        foot: [ex + Math.cos(a) * 0.3 * S, SEA_Y, ez + Math.sin(a) * 0.3 * S],
        width: 1.1 * S,
        splash: true,
      });
      this.ponds.push({ x: pool.x, y: SEA_Y, z: pool.z, radius: 0.72 * S });
      // Boulders on both sides of the fall, in the pool.
      for (const side of [-1, 1]) {
        this.staticModels.push({
          model: side < 0 ? 'Rock_3_K' : 'Rock_3_M',
          x: ex + Math.cos(a) * 0.25 * S - Math.sin(a) * side * 0.72 * S,
          y: SEA_Y - 0.15,
          z: ez + Math.sin(a) * 0.25 * S + Math.cos(a) * side * 0.72 * S,
          yaw: rng.range(0, 6.28),
          scale: side < 0 ? 0.55 : 0.36,
        });
      }
    }
    const first = plan.river[0];
    if (first) {
      const up = plan.neighbour(first, first.riverIn!);
      const [sx, sz] = plan.edgePoint(first, first.riverIn!);
      const a = 60 * first.riverIn! * DEG;
      const topY = (up ? up.level : 1) * S;
      if (topY > riverY + 0.5) {
        this.waterfalls.push({
          top: [sx, topY, sz],
          foot: [sx - Math.cos(a) * 0.25 * S, riverY, sz - Math.sin(a) * 0.25 * S],
          width: 0.8 * S,
          splash: true,
        });
      }
      // Rocks above the spring hide where the water comes from.
      this.staticModels.push({
        model: 'Rock_1_G',
        x: sx + Math.cos(a) * 0.5 * S,
        y: topY - 0.25,
        z: sz + Math.sin(a) * 0.5 * S,
        yaw: rng.range(0, 6.28),
        scale: 0.95,
      });
      this.staticModels.push({
        model: 'Rock_2_E',
        x: sx + Math.cos(a) * 0.35 * S - Math.sin(a) * 0.75 * S,
        y: topY - 0.3,
        z: sz + Math.sin(a) * 0.35 * S + Math.cos(a) * 0.75 * S,
        yaw: rng.range(0, 6.28),
        scale: 0.5,
      });
    }
    if (this.path.length > 1) {
      this.banks.push({
        points: this.path.map((p) => ({ x: p[0], z: p[1] })),
        halfWidth: (TILE_RIVER_HALF_WIDTH + 0.2) * S,
      });
    }

    // Mountains on the high block, rocks at the foot of the plateau.
    const mountains: ModelName[] = ['mountain_A_grass', 'mountain_B_grass', 'mountain_C_grass'];
    const tiles = [...plan.tiles.values()];
    for (const tile of tiles) {
      if (tile.kind === 'mountain') {
        this.staticModels.push({
          model: rng.pick(mountains),
          x: tile.x,
          y: tile.level * S,
          z: tile.z,
          yaw: yawForSteps(rng.int(0, 5)),
          scale: S,
        });
      }
      if (tile.level === 1 && tile.kind === 'land') {
        for (const edge of [1, 2]) {
          const low = plan.neighbour(tile, edge);
          if (!low || low.level !== 0 || low.kind !== 'land' || !rng.chance(0.45)) continue;
          const [x, z] = plan.edgePoint(tile, edge, 1.12);
          this.staticModels.push({
            model: rng.chance(0.5) ? 'Rock_1_G' : 'Rock_3_K',
            x: x + rng.range(-0.5, 0.5),
            y: -0.2,
            z,
            yaw: rng.range(0, 6.28),
            scale: rng.range(0.45, 0.8),
          });
        }
      }
    }

    // Trees: a forest on the plateau and the sides, an open meadow at the front.
    // Tiles in front of the pool and of the river stay clear, so the water is seen.
    const clear = new Set<HexTile>();
    if (pool) {
      for (const edge of [0, 1, 2, 3]) {
        const t = plan.neighbour(pool, edge);
        if (t) clear.add(t);
      }
    }
    for (const river of plan.river) {
      for (const edge of [1, 2]) {
        const t = plan.neighbour(river, edge);
        if (t) clear.add(t);
      }
    }
    const meadow = tiles.filter((t) => t.level === 0 && t.kind === 'land' && !clear.has(t));
    const taken = new Set<HexTile>();
    const spot = (tile: HexTile, role: TreeSpot['role'], size: number, conifer = false) => {
      taken.add(tile);
      this.treeSpots.push({
        x: tile.x + rng.range(-0.28, 0.28) * S,
        z: tile.z + rng.range(-0.28, 0.28) * S,
        role,
        size,
        conifer,
      });
    };
    const frontCentral = [...meadow].sort(
      (a, b) => b.z - Math.abs(b.x) * 0.6 - (a.z - Math.abs(a.x) * 0.6),
    );
    // The growth demo plants in the middle of the meadow, not on its front rim.
    for (const tile of frontCentral.slice(2, 5)) spot(tile, 'demo', 0.9);
    const sides = meadow.filter((t) => !taken.has(t) && t.z > 0);
    const left = [...sides].sort((a, b) => a.x - b.x)[0];
    const right = [...sides].sort((a, b) => b.x - a.x)[0];
    if (left) spot(left, 'hero', 1.15);
    if (right && right !== left) spot(right, 'hero', 0.95);
    // Clearing trees: spread over the meadow, never on two neighbouring tiles.
    const adjacent = (tile: HexTile) =>
      [0, 1, 2, 3, 4, 5].some((e) => taken.has(plan.neighbour(tile, e)!));
    const spread = [...meadow].sort(
      (a, b) => a.z - Math.abs(a.x) * 0.3 - (b.z - Math.abs(b.x) * 0.3),
    );
    let clearing = 0;
    for (const tile of spread) {
      if (clearing >= 7) break;
      if (taken.has(tile) || adjacent(tile)) continue;
      spot(tile, 'clearing', rng.range(0.8, 0.95));
      clearing++;
    }
    // Forest on the plateau: dense at the back, sparse on the front terrace, and thin in
    // front of the mountains so they stay visible.
    for (const tile of tiles) {
      if (tile.level < 1 || tile.kind !== 'land' || clear.has(tile)) continue;
      const back = tile.z < -2 * S;
      const hidesMountain = [4, 5].some((e) => plan.neighbour(tile, e)?.kind === 'mountain');
      const keep = hidesMountain ? 0.3 : back ? 0.85 : 0.5;
      const size = back ? rng.range(1.0, 1.25) : rng.range(0.85, 1.05);
      const conifer = back && rng.chance(0.6);
      if (rng.chance(keep)) spot(tile, 'edge', size, conifer);
    }
  }

  buildGround(out: MeshWriter, season: Season): void {
    const assets = this.assets;
    const first = out.vertexCount;
    const bottom = assets.data('hex_grass_bottom');
    for (const tile of this.plan.tiles.values()) {
      if (!tile.model) continue;
      const base = tile.kind === 'slope' ? tile.level - 1 : tile.level;
      out.append(assets.data(tile.model), tile.x, base * S, tile.z, yawForSteps(tile.steps), S);
      for (let k = base - 1; k >= 0; k--) out.append(bottom, tile.x, k * S, tile.z, 0, S);
    }
    remapHexGrass(out, first, season);
    this.buildSkirt(out);
  }

  /** Blue walls around the sea, like the sides of the KayKit water tiles. */
  private buildSkirt(out: MeshWriter): void {
    const top = swatchUV('HexWater', 0.3);
    const low = swatchUV('HexWater', 0.85);
    for (const tile of this.plan.tiles.values()) {
      if (tile.level > 0 || tile.kind === 'land') continue;
      for (let e = 0; e < 6; e++) {
        if (this.plan.neighbour(tile, e)) continue;
        const a0 = (60 * e - 30) * DEG;
        const a1 = (60 * e + 30) * DEG;
        const nx = Math.cos(60 * e * DEG);
        const nz = Math.sin(60 * e * DEG);
        const x0 = tile.x + Math.cos(a0) * CORNER_RADIUS;
        const z0 = tile.z + Math.sin(a0) * CORNER_RADIUS;
        const x1 = tile.x + Math.cos(a1) * CORNER_RADIUS;
        const z1 = tile.z + Math.sin(a1) * CORNER_RADIUS;
        const i = out.vertex(x0, SEA_Y, z0, nx, 0, nz, top[0], top[1]);
        out.vertex(x1, SEA_Y, z1, nx, 0, nz, top[0], top[1]);
        out.vertex(x1, -S, z1, nx, 0, nz, low[0], low[1]);
        out.vertex(x0, -S, z0, nx, 0, nz, low[0], low[1]);
        // Corners go from +x towards +z: seen from outside they run left to right.
        out.triangle(i, i + 1, i + 2);
        out.triangle(i, i + 2, i + 3);
      }
    }
  }

  buildWater(out: WaterBuilder): void {
    const plan = this.plan;
    // Sea and pool: a fan of 12 triangles per tile, with the shore field for the foam.
    for (const tile of plan.tiles.values()) {
      if (tile.level > 0 || tile.kind === 'land') continue;
      const corner = tile.corners.map((c) => (plan.land.get(c) ? 1 : 0));
      const ring: number[] = [];
      let sum = 0;
      for (let k = 0; k < 12; k++) {
        const a = k * 30 * DEG;
        const edge = k % 2 === 0;
        const radius = edge ? S : CORNER_RADIUS;
        let field: number;
        if (edge) {
          const e = k / 2;
          field = (corner[mod6(e - 1)] + corner[e]) / 2;
          // Foam at the foot of a cliff.
          if ((plan.neighbour(tile, e)?.level ?? 0) >= 1) field = Math.max(field, 0.5);
        } else {
          field = corner[(k - 1) / 2];
        }
        sum += field;
        ring.push(
          out.point(
            tile.x + Math.cos(a) * radius,
            SEA_Y,
            tile.z + Math.sin(a) * radius,
            0,
            0,
            WATER_STILL,
            Math.min(1, field * 2),
          ),
        );
      }
      const center = out.point(
        tile.x,
        SEA_Y,
        tile.z,
        0,
        0,
        WATER_STILL,
        Math.min(1, (sum / 12) * 2),
      );
      for (let k = 0; k < 12; k++) out.triangle(center, ring[(k + 1) % 12], ring[k]);
    }

    if (this.path.length < 2) return;
    const y = this.riverY();
    const half = 0.8 * S;
    const ribbon: RibbonPoint[] = this.path.map((p, i) => {
      const a = this.path[Math.max(0, i - 1)];
      const b = this.path[Math.min(this.path.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return {
        x: p[0],
        y,
        z: p[1],
        sx: -(b[1] - a[1]) / l,
        sz: (b[0] - a[0]) / l,
        halfWidth: half,
        shoreCenter: 0.1,
        shoreEdge: 1,
      };
    });
    const length = out.ribbon(ribbon, WATER_STREAM);

    for (const fall of this.waterfalls) {
      const dx = fall.foot[0] - fall.top[0];
      const dz = fall.foot[2] - fall.top[2];
      const dl = Math.hypot(dx, dz) || 1;
      const nx = dx / dl;
      const nz = dz / dl;
      const halfWidth = fall.width / 2;
      const base = { sx: -nz, sz: nx, outX: nx, outZ: nz };
      // A flat sheet closes the channel cut in the cliff, an arcing one gives volume.
      const wall: RibbonPoint[] = [0, 1].map((t) => ({
        ...base,
        x: fall.top[0] + nx * 0.02,
        y: lerp(fall.top[1], fall.foot[1] - 0.05, t),
        z: fall.top[2] + nz * 0.02,
        halfWidth,
        shoreCenter: 0.3,
        shoreEdge: 0.6,
      }));
      out.ribbon(wall, WATER_FALL, length);
      const arc: RibbonPoint[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const reach = 0.04 + dl * Math.pow(t, 0.8);
        arc.push({
          ...base,
          x: fall.top[0] + nx * reach,
          y: lerp(fall.top[1], fall.foot[1] - 0.05, t * t),
          z: fall.top[2] + nz * reach,
          halfWidth: halfWidth * lerp(0.86, 1, t),
          shoreCenter: i === 0 ? 0.8 : i === 6 ? 1 : 0.2,
          shoreEdge: i === 6 ? 1 : 0.55,
          bulge: 0.12 * Math.sin(t * Math.PI),
        });
      }
      out.ribbon(arc, WATER_FALL, length);
    }
  }
}

/**
 * Season of the hexagon ground: vertices mapped on the KayKit grass cell move to the
 * ground cell of the season (only UVs change), the same cells as the clearing.
 */
export function remapHexGrass(out: MeshWriter, firstVertex: number, season: Season): void {
  const from: SwatchDef = SWATCHES.HexGrass;
  const ground = groundSwatch(season);
  const to: SwatchDef = SWATCHES[ground.swatch];
  for (let i = firstVertex; i < out.vertexCount; i++) {
    const u = out.uvs[i * 2];
    const v = out.uvs[i * 2 + 1];
    if (Math.floor(u / CELL_U) !== from.col || Math.floor(v / CELL_V) !== from.row) continue;
    const frac = v / CELL_V - from.row;
    out.uvs[i * 2] = u + (to.col - from.col) * CELL_U;
    out.uvs[i * 2 + 1] = (to.row + lerp(ground.from, ground.to, frac)) * CELL_V;
  }
}

export function createHexIsland(seed: number, assets: AssetLibrary): Terrain {
  return new HexIsland(seed, assets);
}
