import { Rng, valueNoise2 } from '../../core/rng';
import { swatchUV } from '../atlas';
import { LAST_STAGE, STAGES, type PerStage, type Stage } from '../description';
import { MeshWriter } from '../mesh-data';
import {
  WATER_FALL,
  WATER_STILL,
  WATER_STREAM,
  type RibbonPoint,
  type WaterBuilder,
} from '../render/water';
import type { Season } from '../trees/builder';
import { buildBridge, type Bridge } from './bridge';
import { groundSwatch } from './clearing';
import { rimValue, SLOT_COUNT } from './clearing-layout';
import { buildDiorama, groundGrid } from './diorama';
import {
  distanceToPath,
  lerp,
  smoothstep,
  spline,
  type Announcement,
  type BankPath,
  type Drifter,
  type Pond,
  type Reveal,
  type SlotSpot,
  type StaticModel,
  type Surface,
  type Terrain,
  type TreeSpot,
  type Waterfall,
} from './types';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** Size of a ground facet. */
const CELL = 0.72;
/** The camera looks down at the archipelago at this angle (degrees), straight from the front. */
const CAMERA_PITCH = 24;
/** Level of the sea of clouds the islands float on. */
export const CLOUD_SEA = -9;
const MAX_EDGE_TREES = 34;

export type IslandName = 'main' | 'front' | 'east' | 'ledge' | 'high' | 'south' | 'peak';

// One value per stage. The archipelago rises: the main island first, a small one in front of
// it (1), the neighbour on the side (3), the high island far behind (5), which climbs to carry
// the great cascade (8) over the ledge (7); a small island in front (9), a perched one (10).
// null: still under the clouds.
const LEVEL_BY_STAGE: Record<IslandName, PerStage<number | null>> = {
  main: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  front: [null, -3.5, -3.2, -3, -2.6, -2.5, -2.4, -2.3, -2.2, -2.1, -2, -2],
  east: [null, null, null, 1, 2, 2.5, 3.5, 3.6, 3.8, 4, 4.2, 4.4],
  ledge: [null, null, null, null, null, null, null, 4.5, 5, 5.2, 5.4, 5.6],
  high: [null, null, null, null, null, 6, 7, 8.5, 11, 11.4, 11.8, 12.2],
  south: [null, null, null, null, null, null, null, null, null, -2.5, -2, -1.8],
  peak: [null, null, null, null, null, null, null, null, null, null, 9.6, 10.2],
};

/** Share of its final size each island has reached. */
const SIZE_BY_STAGE: Record<IslandName, PerStage<number>> = {
  main: [0.84, 0.87, 0.9, 0.93, 0.96, 0.98, 1, 1, 1, 1, 1, 1],
  front: [0.8, 0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1, 1, 1],
  east: [0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1, 1, 1, 1, 1, 1],
  ledge: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1, 1, 1],
  high: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.85, 0.9, 1, 1, 1, 1],
  south: [0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 1, 1],
  peak: [0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 1],
};

// The spring of the main island and its fall into the clouds (2), the rope bridge to the
// front island (4), the great suspension bridge (6), the cascade over three tiers (8), rope
// bridges to the small islands (9, 10), the balloon (11).
const SKY_BY_STAGE = {
  pond: [0, 0, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3, 3.1],
  stream: [0, 0, 0.36, 0.38, 0.4, 0.42, 0.44, 0.46, 0.5, 0.52, 0.54, 0.56],
  cover: [0.55, 0.62, 0.7, 0.8, 0.88, 0.95, 1.02, 1.08, 1.14, 1.2, 1.26, 1.3],
  ropeFront: [false, false, false, false, true, true, true, true, true, true, true, true],
  suspension: [false, false, false, false, false, false, true, true, true, true, true, true],
  cascade: [false, false, false, false, false, false, false, false, true, true, true, true],
  ropeSouth: [false, false, false, false, false, false, false, false, false, true, true, true],
  ropePeak: [false, false, false, false, false, false, false, false, false, false, true, true],
  balloon: [false, false, false, false, false, false, false, false, false, false, false, true],
} satisfies Record<string, PerStage<number> | PerStage<boolean>>;

type BridgeColumn = 'ropeFront' | 'suspension' | 'ropeSouth' | 'ropePeak';

const BRIDGES: readonly {
  from: IslandName;
  to: IslandName;
  kind: Bridge['kind'];
  column: BridgeColumn;
}[] = [
  { from: 'main', to: 'front', kind: 'rope', column: 'ropeFront' },
  { from: 'main', to: 'east', kind: 'suspension', column: 'suspension' },
  { from: 'main', to: 'south', kind: 'rope', column: 'ropeSouth' },
  { from: 'high', to: 'peak', kind: 'rope', column: 'ropePeak' },
];

/**
 * Where each island floats, from the one it hangs by: direction (degrees, x to the right, z
 * towards the camera) and how much it varies, gap between their rims, final half extents and
 * the height of its dome.
 */
const ARCHIPELAGO: readonly {
  name: Exclude<IslandName, 'main'>;
  parent: IslandName;
  angle: number;
  spread: number;
  gap: number;
  hx: number;
  hz: number;
  dome: number;
}[] = [
  { name: 'front', parent: 'main', angle: 94, spread: 10, gap: 2.8, hx: 3.6, hz: 3, dome: 0.6 },
  { name: 'east', parent: 'main', angle: -22, spread: 14, gap: 4.8, hx: 6.6, hz: 5, dome: 1.4 },
  { name: 'ledge', parent: 'main', angle: -97, spread: 14, gap: 2.4, hx: 3.4, hz: 2.6, dome: 0.4 },
  { name: 'high', parent: 'ledge', angle: -90, spread: 12, gap: 2.4, hx: 6, hz: 4.4, dome: 2.4 },
  { name: 'south', parent: 'main', angle: 34, spread: 12, gap: 3, hx: 3.6, hz: 3, dome: 0.6 },
  { name: 'peak', parent: 'high', angle: 178, spread: 10, gap: 3.6, hx: 3.4, hz: 2.8, dome: 1.2 },
];

function revealAt(column: PerStage<boolean>, stage: Stage): Reveal {
  if (column[stage]) return 'shown';
  return stage < LAST_STAGE && column[stage + 1] ? 'announced' : 'waiting';
}

/** An island, in the unmirrored frame: centre, final half extents, shape of its rim. */
interface Island {
  name: IslandName;
  index: number;
  x: number;
  z: number;
  hx: number;
  hz: number;
  power: number;
  wobble: readonly [number, number, number, number];
  dome: number;
}

interface Layout {
  mirror: number;
  islands: Record<IslandName, Island>;
  pond: { x: number; z: number };
  /** Where the stream of the main island leaves it, beyond its final rim. */
  exit: { x: number; z: number };
  hill: { x: number; z: number; radius: number; height: number };
  hero: { x: number; z: number };
  /** Open meadows, kept free for the animals: in front, and on the side. */
  pastures: readonly { x: number; z: number }[];
}

const PASTURE_RADIUS = 4;

/** Rim value of a point (1 on the rim, larger outside), at a share of the final size. */
function rimOf(island: Island, size: number, x: number, z: number): number {
  return rimValue(
    island,
    { hx: island.hx * size, hz: island.hz * size, cz: island.z },
    x - island.x,
    z,
  );
}

/** Point of the outline of an island at a parameter angle, at rim value `rim`. */
function outlinePoint(island: Island, theta: number, rim = 1): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const [a3, p3, a5, p5] = island.wobble;
  const wave = 1 + a3 * Math.sin(3 * theta + p3) + a5 * Math.sin(5 * theta + p5);
  const p = island.power;
  const k = (rim * wave) / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p);
  return [island.x + c * k * island.hx, island.z + s * k * island.hz];
}

const OUTLINE_SAMPLES = 40;

/** Smallest distance between the final rims of two islands, negative when they overlap. */
function gapBetween(a: Island, b: Island): number {
  const pa = Array.from({ length: OUTLINE_SAMPLES }, (_, i) =>
    outlinePoint(a, (i / OUTLINE_SAMPLES) * TAU),
  );
  const pb = Array.from({ length: OUTLINE_SAMPLES }, (_, i) =>
    outlinePoint(b, (i / OUTLINE_SAMPLES) * TAU),
  );
  if (pa.some(([x, z]) => rimOf(b, 1, x, z) < 1) || pb.some(([x, z]) => rimOf(a, 1, x, z) < 1)) {
    return -1;
  }
  let best = Infinity;
  for (const [ax, az] of pa)
    for (const [bx, bz] of pb) best = Math.min(best, Math.hypot(ax - bx, az - bz));
  return best;
}

/** Point between `from` (inside the island) and `to` where its rim value reaches `rim`. */
function towards(
  island: Island,
  size: number,
  from: readonly [number, number],
  to: readonly [number, number],
  rim: number,
): [number, number] {
  let lo = 0;
  let hi = 1;
  const at = (t: number): [number, number] => [lerp(from[0], to[0], t), lerp(from[1], to[1], t)];
  if (rimOf(island, size, ...at(1)) < rim) return at(1);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (rimOf(island, size, ...at(mid)) < rim) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

function drawLayout(seed: number): Layout {
  for (let attempt = 0; attempt < 60; attempt++) {
    const layout = tryLayout(new Rng(seed).fork(`sky:${attempt}`), attempt < 59);
    if (layout) return layout;
  }
  throw new Error('unreachable: the last attempt has no jitter');
}

function tryLayout(rng: Rng, jitter: boolean): Layout | null {
  const vary = (spread: number) => (jitter ? rng.range(-spread, spread) : 0);
  const shape = () => ({
    power: 2.2 + (jitter ? rng.range(0, 0.6) : 0.3),
    wobble: [
      jitter ? rng.range(0.03, 0.07) : 0.04,
      rng.range(0, TAU),
      jitter ? rng.range(0.01, 0.04) : 0.02,
      rng.range(0, TAU),
    ] as const,
  });
  const islands = {
    main: {
      name: 'main',
      index: 0,
      x: 0,
      z: 0,
      hx: 17.5 + vary(1.5),
      hz: 11.5 + vary(1),
      dome: 0,
      ...shape(),
    },
  } as Record<IslandName, Island>;
  ARCHIPELAGO.forEach((def, i) => {
    const parent = islands[def.parent];
    const size = 1 + vary(0.14);
    const island: Island = {
      name: def.name,
      index: i + 1,
      x: 0,
      z: 0,
      hx: def.hx * size,
      hz: def.hz * size,
      dome: def.dome * (1 + vary(0.15)),
      ...shape(),
    };
    const angle = (def.angle + vary(def.spread)) * DEG;
    const gap = def.gap + vary(0.35);
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    let lo = 0;
    let hi = 80;
    for (let k = 0; k < 28; k++) {
      const d = (lo + hi) / 2;
      island.x = parent.x + ux * d;
      island.z = parent.z + uz * d;
      if (gapBetween(parent, island) < gap) lo = d;
      else hi = d;
    }
    island.x = parent.x + ux * hi;
    island.z = parent.z + uz * hi;
    islands[def.name] = island;
  });
  const all = Object.values(islands);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (gapBetween(all[i], all[j]) < 1.8) return null;
    }
  }
  const main = islands.main;
  const ledge = islands.ledge;
  // The pond waits under the ledge, so the cascade lands near it.
  const pond = towards(main, 1, [main.x, main.z], [ledge.x, ledge.z], 0.42 + vary(0.04));
  const exitAngle = (146 + vary(12)) * DEG;
  const exit = outlinePoint(main, exitAngle, 1.08);
  // Away from the pond under the ledge.
  const hillAngle = (-30 + vary(14)) * DEG;
  const hill = outlinePoint(main, hillAngle, 0.58 + vary(0.06));
  const hero = outlinePoint(main, (58 + vary(10)) * DEG, 0.56 + vary(0.05));
  const pastures = [
    outlinePoint(main, (96 + vary(10)) * DEG, 0.4),
    outlinePoint(main, (22 + vary(10)) * DEG, 0.5),
  ];
  return {
    mirror: rng.chance(0.5) ? 1 : -1,
    islands,
    pond: { x: pond[0], z: pond[1] },
    exit: { x: exit[0], z: exit[1] },
    hill: { x: hill[0], z: hill[1], radius: 5 + vary(0.8), height: 1.8 + vary(0.4) },
    hero: { x: hero[0], z: hero[1] },
    pastures: pastures.map(([x, z]) => ({ x, z })),
  };
}

const layouts = new Map<number, Layout>();
function layoutOf(seed: number): Layout {
  let layout = layouts.get(seed);
  if (!layout) {
    layout = drawLayout(seed);
    layouts.set(seed, layout);
  }
  return layout;
}

/** Water running on an island: points (unmirrored) with their water level. */
interface Run {
  island: IslandName;
  points: readonly (readonly [number, number])[];
  levels: readonly number[];
  along: readonly number[];
  halfWidth: number;
  box: readonly [number, number, number, number];
}

/** Fall from the rim of an island onto the next one below, or into the clouds. */
interface Drop {
  lip: [number, number, number];
  foot: [number, number, number];
  halfWidth: number;
  /** Into the void: it narrows and dissolves into mist above the clouds. */
  void: boolean;
}

function makeRun(
  island: IslandName,
  points: [number, number][],
  levels: number[],
  halfWidth: number,
): Run {
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(
      along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  }
  const reach = halfWidth + 1.5;
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  return {
    island,
    points,
    levels,
    along,
    halfWidth,
    box: [
      Math.min(...xs) - reach,
      Math.min(...zs) - reach,
      Math.max(...xs) + reach,
      Math.max(...zs) + reach,
    ],
  };
}

function levelAlong(run: Run, along: number): number {
  const i = run.along.findIndex((a) => a >= along);
  if (i <= 0) return run.levels[Math.max(0, i)];
  const t = (along - run.along[i - 1]) / (run.along[i] - run.along[i - 1] || 1);
  return lerp(run.levels[i - 1], run.levels[i], t);
}

/** Seen from the camera, slightly from above, a tree hides the ground up to this far behind it. */
function hides(
  points: readonly (readonly [number, number])[],
  x: number,
  z: number,
  reach = 9,
): boolean {
  return points.some(([wx, wz]) => z > wz && z - wz < reach && Math.abs(x - wx) < 1.8);
}

interface Sights {
  water: [number, number][];
  /** Lips of the falls into the clouds: long, a tree far in front still hides them. */
  falls: [number, number][];
  anchors: [number, number][];
}

const keepCache = new Map<number, Sights>();

/**
 * What must stay in view at every stage (unmirrored): the water and its falls, and the ends
 * of the bridges.
 */
function keptInView(seed: number): Sights {
  let kept = keepCache.get(seed);
  if (!kept) {
    kept = { water: [], falls: [], anchors: [] };
    for (const stage of STAGES) {
      const terrain = new SkyIslands(seed, stage, false);
      kept.water.push(...terrain.waterPoints());
      kept.falls.push(...terrain.voidPoints());
      kept.anchors.push(...terrain.anchorPoints());
    }
    keepCache.set(seed, kept);
  }
  return kept;
}

/**
 * Off the water of every stage and the ends of the bridges: `clear` when nothing to keep in
 * view is behind either, `low` when only something low (a grove) can stand there.
 */
function sightsAt(seed: number, x: number, z: number): 'clear' | 'low' | null {
  const { water, falls, anchors } = keptInView(seed);
  const pond = layoutOf(seed).pond;
  const radius = SKY_BY_STAGE.pond[LAST_STAGE];
  if (
    water.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 2.2) ||
    anchors.some(([ax, az]) => Math.hypot(x - ax, z - az) < 2.4) ||
    Math.hypot(x - pond.x, z - pond.z) < radius + 2
  ) {
    return null;
  }
  const hidden =
    hides(water, x, z) ||
    hides(falls, x, z, 26) ||
    hides(anchors, x, z) ||
    (z > pond.z && z - pond.z < 9 + radius && Math.abs(x - pond.x) < radius + 1.5);
  return hidden ? 'low' : 'clear';
}

/** First stage an island is out of the clouds. */
function riseOf(name: IslandName): Stage {
  return STAGES.find((stage) => LEVEL_BY_STAGE[name][stage] !== null) ?? LAST_STAGE;
}

/** A place of the child, on an island near the camera (unmirrored). */
interface SlotDef {
  x: number;
  z: number;
  island: IslandName;
  kind: 'tree' | 'grove';
  opens: Stage;
  /** In front of something to keep in view: a grove only, never a tree. */
  low: boolean;
}

const GROVES = 8;
const SLOT_SPACING = 2.6;
/** Places open at most at each stage: a few more than the elements to place. */
const OPEN_AT_MOST: PerStage<number> = [6, 6, 7, 9, 11, 13, 15, 17, 19, 21, 22, 22];
/** Islands holding the child's places: the near ones, where a tree reads well. */
const SLOT_ISLANDS: readonly IslandName[] = ['main', 'front', 'east', 'south'];

const slotCache = new Map<number, SlotDef[]>();

/**
 * The places of a painting, in their opening order: by the first stage that shows them, then
 * nearest the middle of the first island. Drawn in the final layout, off the water of every
 * stage and the ends of the bridges, and never in front of them.
 */
export function slotsOf(seed: number): readonly SlotDef[] {
  const cached = slotCache.get(seed);
  if (cached) return cached;
  const layout = layoutOf(seed);
  const rng = new Rng(seed).fork('slots');
  const final = new SkyIslands(seed, LAST_STAGE, false);
  const candidates: SlotDef[] = [];
  for (const name of SLOT_ISLANDS) {
    const island = layout.islands[name];
    const opensAt = (x: number, z: number) =>
      STAGES.find(
        (stage) => stage >= riseOf(name) && rimOf(island, SIZE_BY_STAGE[name][stage], x, z) < 0.84,
      ) ?? LAST_STAGE;
    const step = 2.2;
    for (let gx = island.x - island.hx; gx <= island.x + island.hx; gx += step) {
      for (let gz = island.z - island.hz; gz <= island.z + island.hz; gz += step) {
        const x = gx + rng.range(-0.8, 0.8);
        const z = gz + rng.range(-0.8, 0.8);
        if (rimOf(island, 1, x, z) > 0.84) continue;
        if (Math.hypot(x - layout.hero.x, z - layout.hero.z) < 4) continue;
        if (layout.pastures.some((p) => Math.hypot(x - p.x, z - p.z) < PASTURE_RADIUS)) continue;
        const sights = sightsAt(seed, x, z);
        if (!sights) continue;
        const surface = final.surfaceAt(x * layout.mirror, z);
        if (surface?.kind !== 'grass' || surface.slope > 0.42) continue;
        // Nothing tall in the middle of the foreground: groves only on the island in front.
        const low = sights === 'low' || name === 'front';
        candidates.push({ x, z, island: name, kind: 'grove', opens: opensAt(x, z), low });
      }
    }
  }
  const order = (s: SlotDef) => s.opens * 1000 + Math.hypot(s.x, s.z - 2);
  candidates.sort((a, b) => order(a) - order(b));
  const slots: SlotDef[] = [];
  const room = (c: SlotDef) => slots.every((s) => Math.hypot(s.x - c.x, s.z - c.z) >= SLOT_SPACING);
  for (const spread of [true, false]) {
    for (const c of candidates) {
      if (slots.length === SLOT_COUNT) break;
      if (spread && slots.length >= OPEN_AT_MOST[c.opens]) continue;
      if (slots.includes(c) || !room(c)) continue;
      // A grove now and then, about one in four, where a tree would hide nothing.
      const groves = slots.filter((s) => s.kind === 'grove').length;
      if (c.low && groves >= GROVES + (spread ? 0 : 3)) continue;
      c.kind = c.low || (groves < GROVES && slots.length % 4 === 2) ? 'grove' : 'tree';
      slots.push(c);
    }
  }
  slots.sort((a, b) => order(a) - order(b));
  slotCache.set(seed, slots);
  return slots;
}

/**
 * The sky islands (#32): an archipelago floating over a sea of clouds. It rises stage after
 * stage: islands come out of the clouds or climb higher, joined by rope bridges, then by the
 * great suspension bridge; the high island carries a cascade over three tiers, the last one
 * into the clouds; a balloon drifts between the islands at the end.
 */
class SkyIslands implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly slots: SlotSpot[] = [];
  readonly announcements: Announcement[] = [];
  readonly dam = null;
  readonly perch = null;
  readonly chain: Reveal = 'waiting';
  readonly staticModels: StaticModel[] = [];
  readonly spinners = [];
  readonly drifters: Drifter[] = [];
  readonly cloudSea = CLOUD_SEA;
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly crops = [];
  readonly extent: { x: number; z: number };
  readonly cover: number;
  readonly frame: Terrain['frame'];
  readonly shadow: Terrain['shadow'];

  private readonly layout: Layout;
  private readonly mirror: number;
  /** Islands out of the clouds at this stage. */
  private readonly visible: Island[];
  private readonly levels: Record<IslandName, number | null>;
  private readonly sizes: Record<IslandName, number>;
  private readonly pond: { x: number; z: number; radius: number; level: number } | null;
  private readonly runs: Run[] = [];
  private readonly drops: Drop[] = [];
  private readonly bridges: Bridge[] = [];

  constructor(
    private readonly seed: number,
    private readonly stage: Stage,
    /** Without its scenery, a terrain only answers questions about its ground and water. */
    scenery = true,
  ) {
    const r = SKY_BY_STAGE;
    this.layout = layoutOf(seed);
    this.mirror = this.layout.mirror;
    const names = Object.keys(LEVEL_BY_STAGE) as IslandName[];
    this.levels = Object.fromEntries(names.map((n) => [n, LEVEL_BY_STAGE[n][stage]])) as Record<
      IslandName,
      number | null
    >;
    this.sizes = Object.fromEntries(names.map((n) => [n, SIZE_BY_STAGE[n][stage]])) as Record<
      IslandName,
      number
    >;
    this.visible = names.filter((n) => this.levels[n] !== null).map((n) => this.layout.islands[n]);
    const radius = r.pond[stage];
    if (radius > 0) {
      const { x, z } = this.layout.pond;
      this.pond = { x, z, radius, level: this.groundOn(this.layout.islands.main, x, z) - 0.3 };
    } else {
      this.pond = null;
    }
    this.water();
    this.placeBridges();
    let ex = 0;
    let ez = 0;
    for (const island of this.visible) {
      for (let i = 0; i < 24; i++) {
        const [x, z] = this.outline(island, (i / 24) * TAU);
        ex = Math.max(ex, Math.abs(x));
        ez = Math.max(ez, Math.abs(z));
      }
    }
    this.extent = { x: ex, z: ez };
    this.cover = r.cover[stage];
    if (scenery) this.compose();
    this.frame = this.framing();
    const xs = this.frame.points!.map((p) => p[0]);
    const zs = this.frame.points!.map((p) => p[2]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    this.shadow = {
      center: [cx, 2, cz],
      radius: Math.hypot(Math.max(...xs) - cx, Math.max(...zs) - cz) * 0.85 + 3,
    };
  }

  /** Outline point of a visible island at this stage, unmirrored. */
  private outline(island: Island, theta: number, rim = 1): [number, number] {
    const [x, z] = outlinePoint(island, theta, rim);
    const size = this.sizes[island.name];
    return [island.x + (x - island.x) * size, island.z + (z - island.z) * size];
  }

  /** Points of the water a tree must not hide (unmirrored): streams, lips and feet of falls. */
  waterPoints(): [number, number][] {
    const points: [number, number][] = this.runs.flatMap((run) =>
      run.points.map(([x, z]): [number, number] => [x, z]),
    );
    for (const d of this.drops) points.push([d.lip[0], d.lip[2]], [d.foot[0], d.foot[2]]);
    return points;
  }

  /** Lips of the falls into the clouds (unmirrored). */
  voidPoints(): [number, number][] {
    return this.drops.filter((d) => d.void).map((d) => [d.lip[0], d.lip[2]]);
  }

  /** Ends of the bridges (unmirrored). */
  anchorPoints(): [number, number][] {
    return this.bridges.flatMap((b) => [
      [b.from[0] * this.mirror, b.from[2]],
      [b.to[0] * this.mirror, b.to[2]],
    ]);
  }

  /** Visible island under a point (unmirrored), if any: the islands never overlap. */
  private islandAt(x: number, z: number): Island | null {
    for (const island of this.visible) {
      if (rimOf(island, this.sizes[island.name], x, z) <= 0.985) return island;
    }
    return null;
  }

  /** Ground of an island before any water: its dome, a gentle roll, a rounded rim. */
  private groundOn(island: Island, x: number, z: number): number {
    const level = this.levels[island.name] ?? 0;
    const final = rimOf(island, 1, x, z);
    const current = rimOf(island, this.sizes[island.name], x, z);
    const n1 = valueNoise2(this.seed + island.index * 13, x / 5 + 40, z / 5 + 40) - 0.5;
    const n2 = valueNoise2(this.seed + island.index * 13 + 1, x / 2.3 + 40, z / 2.3 + 40) - 0.5;
    let h = level + island.dome * Math.max(0, 1 - final * final) + 0.6 * n1 + 0.2 * n2;
    if (island.name === 'main') {
      const { hill } = this.layout;
      const d = Math.hypot(x - hill.x, z - hill.z);
      h += hill.height * (1 - smoothstep(0, hill.radius, d));
    }
    return h - 0.7 * smoothstep(0.8, 1, current);
  }

  /** Ground with the beds of the water dug in. */
  private heightOn(island: Island, x: number, z: number): number {
    let h = this.groundOn(island, x, z);
    for (const run of this.runs) {
      if (run.island !== island.name) continue;
      const [x0, z0, x1, z1] = run.box;
      if (x < x0 || z < z0 || x > x1 || z > z1) continue;
      const q = distanceToPath(run.points, x, z);
      const outer = run.halfWidth + 0.7;
      if (q.distance >= outer) continue;
      const bed = levelAlong(run, q.along) - 0.3;
      h = Math.min(h, lerp(bed, h, smoothstep(run.halfWidth * 0.7, outer, q.distance)));
    }
    const p = this.pond;
    if (p && island.name === 'main') {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.radius + 1) {
        h = Math.min(h, lerp(p.level - 0.8, h, smoothstep(p.radius - 1.3, p.radius + 1, d)));
      }
    }
    return h;
  }

  /** Water of a run near a point, and how far from its middle. */
  private runAt(island: Island, x: number, z: number): { level: number; distance: number } | null {
    let best: { level: number; distance: number } | null = null;
    for (const run of this.runs) {
      if (run.island !== island.name) continue;
      const [x0, z0, x1, z1] = run.box;
      if (x < x0 || z < z0 || x > x1 || z > z1) continue;
      const q = distanceToPath(run.points, x, z);
      if (!best || q.distance < best.distance) {
        best = { level: levelAlong(run, q.along), distance: q.distance - run.halfWidth };
      }
    }
    return best;
  }

  /** Water on an island, from `start` towards `towardsPoint`, cut where it leaves the rim. */
  private flow(
    island: Island,
    control: [number, number][],
    halfWidth: number,
    from: number,
    to: number,
  ): Run {
    const size = this.sizes[island.name];
    const path = spline(control, 6) as [number, number][];
    const points: [number, number][] = [];
    for (let i = 0; i < path.length; i++) {
      if (rimOf(island, size, ...path[i]) < 0.97) {
        points.push(path[i]);
        continue;
      }
      if (i > 0) points.push(towards(island, size, path[i - 1], path[i], 0.97));
      break;
    }
    const levels: number[] = [];
    points.forEach(([x, z], i) => {
      const t = i / Math.max(1, points.length - 1);
      const level = Math.min(lerp(from, to, t), this.groundOn(island, x, z) - 0.12);
      levels.push(i === 0 ? level : Math.min(levels[i - 1], level));
    });
    return makeRun(island.name, points, levels, halfWidth);
  }

  /** The spring of the main island and its fall into the clouds; the great cascade. */
  private water(): void {
    const half = SKY_BY_STAGE.stream[this.stage];
    const p = this.pond;
    if (!p || half === 0) return;
    const { islands, exit } = this.layout;
    const main = islands.main;
    const dx = exit.x - p.x;
    const dz = exit.z - p.z;
    const length = Math.hypot(dx, dz);
    const start: [number, number] = [
      p.x + (dx / length) * (p.radius - 0.6),
      p.z + (dz / length) * (p.radius - 0.6),
    ];
    const bend = Math.min(2.5, length * 0.15);
    const stream = this.flow(
      main,
      [
        start,
        [
          lerp(start[0], exit.x, 0.5) - (dz / length) * bend,
          lerp(start[1], exit.z, 0.5) + (dx / length) * bend,
        ],
        [exit.x, exit.z],
      ],
      half,
      p.level - 0.02,
      p.level - 0.5,
    );
    this.runs.push(stream);
    const [lx, lz] = stream.points.at(-1)!;
    const [px, pz] = stream.points.at(-2) ?? start;
    const out = Math.hypot(lx - px, lz - pz) || 1;
    this.drops.push({
      lip: [lx, stream.levels.at(-1)!, lz],
      foot: [lx + ((lx - px) / out) * 1.6, CLOUD_SEA + 0.4, lz + ((lz - pz) / out) * 1.6],
      halfWidth: half,
      void: true,
    });

    if (!SKY_BY_STAGE.cascade[this.stage]) return;
    // The great cascade: from a spring on the high island down to the ledge, then onto the
    // main island beside its pond.
    const { high, ledge } = islands;
    const spring = outlinePoint(high, -Math.PI / 2, 0.3);
    const ledgeFoot = towards(ledge, this.sizes.ledge, [ledge.x, ledge.z], [high.x, high.z], 0.5);
    const highTop = this.groundOn(high, ...spring) - 0.15;
    const highRun = this.flow(
      high,
      [spring, [lerp(spring[0], ledgeFoot[0], 0.4), lerp(spring[1], ledgeFoot[1], 0.4)], ledgeFoot],
      half * 0.85,
      highTop,
      highTop - 1,
    );
    const mainFoot = towards(main, 1, [p.x, p.z], [ledge.x, ledge.z], 0.86);
    const ledgeTop = this.groundOn(ledge, ...ledgeFoot) - 0.15;
    const ledgeRun = this.flow(ledge, [ledgeFoot, mainFoot], half * 0.9, ledgeTop, ledgeTop - 0.6);
    const into = Math.hypot(mainFoot[0] - p.x, mainFoot[1] - p.z) || 1;
    const shore: [number, number] = [
      p.x + ((mainFoot[0] - p.x) / into) * (p.radius - 0.6),
      p.z + ((mainFoot[1] - p.z) / into) * (p.radius - 0.6),
    ];
    const mainRun = this.flow(
      main,
      [mainFoot, shore],
      half,
      this.groundOn(main, ...mainFoot) - 0.15,
      p.level - 0.02,
    );
    for (const [upper, lower] of [
      [highRun, ledgeRun],
      [ledgeRun, mainRun],
    ]) {
      const [x, z] = upper.points.at(-1)!;
      const [fx, fz] = lower.points[0];
      this.drops.push({
        lip: [x, upper.levels.at(-1)!, z],
        foot: [fx, lower.levels[0], fz],
        halfWidth: upper.halfWidth,
        void: false,
      });
    }
    this.runs.push(highRun, ledgeRun, mainRun);
  }

  private placeBridges(): void {
    for (const def of BRIDGES) {
      if (!SKY_BY_STAGE[def.column][this.stage]) continue;
      const a = this.layout.islands[def.from];
      const b = this.layout.islands[def.to];
      const end = (island: Island, other: Island): [number, number, number] => {
        const [x, z] = towards(
          island,
          this.sizes[island.name],
          [island.x, island.z],
          [other.x, other.z],
          0.93,
        );
        return [x * this.mirror, this.groundOn(island, x, z) + 0.02, z];
      };
      this.bridges.push({ from: end(a, b), to: end(b, a), kind: def.kind });
    }
  }

  surfaceAt(wx: number, z: number): Surface | null {
    const x = wx * this.mirror;
    const island = this.islandAt(x, z);
    if (!island) return null;
    const y = this.heightOn(island, x, z);
    const e = 0.35;
    const dx = this.heightOn(island, x + e, z) - this.heightOn(island, x - e, z);
    const dz = this.heightOn(island, x, z + e) - this.heightOn(island, x, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const p = this.pond;
    const nearPond = !!p && island.name === 'main' && Math.hypot(x - p.x, z - p.z) < p.radius + 1.2;
    const run = this.runAt(island, x, z);
    let kind: Surface['kind'] = 'grass';
    if (nearPond && y < p!.level + 0.03) kind = 'water';
    else if (nearPond && y < p!.level + 0.28) kind = 'sand';
    else if (run && run.distance < 0.9 && y < run.level + 0.03) kind = 'water';
    else if (run && run.distance < 0.9 && y < run.level + 0.28) kind = 'sand';
    else if (slope > 0.5) kind = 'rock';
    return { y, kind, slope };
  }

  nearLake(): boolean {
    return false;
  }

  private compose(): void {
    const m = this.mirror;
    const slots = slotsOf(this.seed);
    for (const [index, slot] of slots.entries()) {
      if (slot.opens > this.stage) break;
      this.slots.push({
        index,
        x: slot.x * m,
        z: slot.z,
        kind: slot.kind,
        size: slot.island === 'main' ? 0.95 : 0.85,
        detail: slot.island === 'east' ? 'far' : 'light',
      });
    }

    const { hero } = this.layout;
    this.treeSpots.push({ x: hero.x * m, z: hero.z, role: 'hero', size: 1.1, slot: 0 });

    const p = this.pond;
    if (p) {
      const shore: { x: number; z: number }[] = [];
      const n = Math.round(p.radius * 6);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        shore.push({
          x: (p.x + Math.cos(a) * (p.radius + 0.3)) * m,
          z: p.z + Math.sin(a) * (p.radius + 0.3),
        });
      }
      this.banks.push({ points: shore, halfWidth: 0.2 });
      this.ponds.push({ x: p.x * m, y: p.level, z: p.z, radius: p.radius - 0.9 });
    }
    for (const run of this.runs) {
      this.banks.push({
        points: run.points.map(([x, z]) => ({ x: x * m, z })),
        halfWidth: run.halfWidth + 0.1,
      });
    }
    for (const d of this.drops) {
      this.waterfalls.push({
        top: [d.lip[0] * m, d.lip[1], d.lip[2]],
        foot: [d.foot[0] * m, d.foot[1], d.foot[2]],
        width: d.halfWidth * 2,
        splash: !d.void,
      });
    }

    // Grand moments, announced by sparkles the stage before.
    const { islands } = this.layout;
    if (revealAt(SKY_BY_STAGE.suspension, this.stage) === 'announced') {
      const a = towards(islands.main, this.sizes.main, [0, 0], [islands.east.x, islands.east.z], 1);
      const b = towards(islands.east, this.sizes.east, [islands.east.x, islands.east.z], [0, 0], 1);
      const x = (a[0] + b[0]) / 2;
      const z = (a[1] + b[1]) / 2;
      const y = this.groundOn(islands.east, ...b) / 2 + 1;
      this.announcements.push({ label: 'bridge', x: x * m, y, z, radius: 2.2 });
    }
    if (revealAt(SKY_BY_STAGE.cascade, this.stage) === 'announced') {
      const { high } = islands;
      this.announcements.push({
        label: 'cascade',
        x: high.x * m,
        y: this.groundOn(high, high.x, high.z) + 1.5,
        z: high.z,
        radius: 3.5,
      });
    }
    const balloon = this.balloonLoop();
    if (revealAt(SKY_BY_STAGE.balloon, this.stage) === 'announced') {
      this.announcements.push({
        label: 'balloon',
        x: balloon.x + balloon.rx,
        y: balloon.y,
        z: balloon.z,
        radius: 1.6,
      });
    } else if (SKY_BY_STAGE.balloon[this.stage]) {
      this.drifters.push(balloon);
    }

    this.forest();
  }

  /** The balloon's loop: around the middle of the archipelago, above the islands. */
  private balloonLoop(): Drifter {
    return {
      model: 'balloon',
      x: 0,
      y: 14,
      z: -10,
      rx: 16,
      rz: 5,
      speed: 0.01,
      scale: 2.4,
    };
  }

  /** Trees around the rims of the islands, conifers on the high ones. */
  private forest(): void {
    const rng = new Rng(this.seed).fork('forest');
    const m = this.mirror;
    const { islands, hero } = this.layout;
    const slots = slotsOf(this.seed);
    // Drawn in the final painting, so a tree stays from one stage to the next.
    const last = this.stage === LAST_STAGE ? this : new SkyIslands(this.seed, LAST_STAGE, false);
    const quota: Record<IslandName, number> = {
      main: 11,
      front: 0,
      east: 7,
      ledge: 0,
      high: 6,
      south: 2,
      peak: 3,
    };
    const placed: { x: number; z: number }[] = [hero];
    const { pastures } = this.layout;
    const spots: TreeSpot[] = [];
    for (const island of Object.values(islands)) {
      let count = 0;
      const alpine = island.name === 'high' || island.name === 'peak';
      for (let attempt = 0; attempt < 300 && count < quota[island.name]; attempt++) {
        const theta = rng.range(0, TAU);
        // Mostly towards the back and the rim, where they frame without hiding.
        const back = Math.sin(theta) < 0.2 || island.name !== 'main';
        // Small islands keep their trees whole on their ground.
        const outer = island.name === 'main' ? 0.88 : 0.72;
        const rim = back ? rng.range(0.3, outer) : rng.range(0.72, outer);
        const [x, z] = outlinePoint(island, theta, rim);
        const rank = rng.next();
        const size = rng.next();
        const conifer = alpine ? rng.chance(0.75) : rng.chance(0.25);
        if (!back && island.name === 'main') continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 2.8)) continue;
        if (pastures.some((p) => Math.hypot(x - p.x, z - p.z) < PASTURE_RADIUS + 1)) continue;
        if (slots.some((s) => Math.hypot(s.x - x, s.z - z) < 2)) continue;
        if (sightsAt(this.seed, x, z) !== 'clear') continue;
        const ground = last.surfaceAt(x * m, z);
        if (!ground || ground.kind !== 'grass' || ground.slope > 0.5) continue;
        placed.push({ x, z });
        count++;
        spots.push({
          x: x * m,
          z,
          role: 'edge',
          rank,
          size: (island.name === 'main' ? 0.95 : 0.85) + 0.3 * size,
          conifer,
          detail: island.name === 'main' || island.name === 'front' ? 'light' : 'far',
        });
      }
    }
    spots.sort((a, b) => a.rank! - b.rank!);
    for (const spot of spots.slice(0, MAX_EDGE_TREES)) {
      const surface = this.surfaceAt(spot.x, spot.z);
      if (!surface || surface.kind === 'water' || surface.kind === 'sand') continue;
      this.treeSpots.push(spot);
    }
  }

  /** Points the camera keeps in view: the rims and tops of the islands, the balloon. */
  private framing(): Terrain['frame'] {
    const m = this.mirror;
    const points: [number, number, number][] = [];
    for (const island of this.visible) {
      const level = this.levels[island.name]!;
      const n = island.name === 'main' ? 28 : 12;
      for (let i = 0; i < n; i++) {
        const theta = (i / n) * TAU;
        const [x, z] = this.outline(island, theta, 0.97);
        const top = island.name === 'main' ? Math.max(0, this.groundOn(island, x, z)) : level;
        // Trees stand at the back; the underside shows below the front.
        points.push([x * m, top + (Math.sin(theta) < 0.3 ? 4 : 1.5), z]);
        if (island.name === 'main') points.push([x * m, (-2.6 * island.hx) / 20, z]);
        else points.push([x * m, level - 1.5, z]);
      }
      points.push([island.x * m, level + island.dome + 5, island.z]);
    }
    for (const d of this.drifters) {
      points.push([d.x - d.rx, d.y + 3, d.z], [d.x + d.rx, d.y + 3, d.z]);
    }
    const { hero } = this.layout;
    const y = this.groundOn(this.layout.islands.main, hero.x, hero.z) + 5.5 * 1.1;
    points.push([hero.x * m - 3.4, y, hero.z], [hero.x * m + 3.4, y, hero.z]);
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[2]);
    return {
      center: [0, 1.4, 0],
      size: [Math.max(...xs) - Math.min(...xs), 12, Math.max(...zs) - Math.min(...zs)],
      yaw: 0,
      pitch: CAMERA_PITCH,
      points,
    };
  }

  /** Facet colour: stone on the cliffs, sand by the water, grass in patches. */
  private colour(
    season: Season,
    island: Island,
    x: number,
    y: number,
    z: number,
    slope: number,
    jitter: number,
  ): [number, number] {
    const grass = groundSwatch(season);
    const p = this.pond;
    if (slope > 0.8) return swatchUV('Stone', 0.2 + slope * 0.4 + jitter * 2);
    if (slope > 0.32) return swatchUV(grass.swatch, lerp(grass.from, grass.to, 0.75 + jitter));
    if (p && island.name === 'main' && Math.hypot(x - p.x, z - p.z) < p.radius + 1.2) {
      if (y < p.level + 0.25)
        return swatchUV('HexSand', 0.3 + Math.min(0.5, (p.level - y) * 0.7) + jitter);
    }
    const run = this.runAt(island, x, z);
    if (run && run.distance < 0.6 && y < run.level + 0.25) return swatchUV('HexSand', 0.4 + jitter);
    const patch = valueNoise2(this.seed + 5, x / 4.5, z / 4.5) - 0.5;
    const tone = Math.min(1, Math.max(0, 0.3 + slope * 1.3 + patch * 0.3 + jitter));
    return swatchUV(grass.swatch, lerp(grass.from, grass.to, tone));
  }

  buildGround(out: MeshWriter, season: Season): void {
    const m = this.mirror;
    for (const island of this.visible) {
      const rng = new Rng(this.seed).fork(`ground:${island.name}`);
      const size = this.sizes[island.name];
      const level = this.levels[island.name]!;
      const hx = island.hx * size;
      const outline = {
        hx,
        hz: island.hz * size,
        cz: island.z,
        power: island.power,
        wobble: island.wobble,
      };
      // Built around the island's own centre, then moved into place.
      const grid = groundGrid(
        rng,
        outline,
        CELL,
        (fx, z) => this.heightOn(island, island.x + fx, z) - level,
        m,
      );
      const local = new MeshWriter(4096, 4096);
      buildDiorama(
        local,
        grid,
        rng,
        island.z,
        hx,
        (cx, cy, cz, slope, jitter) =>
          this.colour(season, island, island.x + cx * m, cy + level, cz, slope, jitter),
        Math.max(0.32, hx * (island.name === 'main' ? 0.06 : 0.075)),
      );
      out.append(local.toMeshData(), island.x * m, level, 0);
    }
    for (const bridge of this.bridges) buildBridge(out, bridge);
  }

  buildWater(out: WaterBuilder): void {
    const m = this.mirror;
    for (const run of this.runs) {
      const points: RibbonPoint[] = run.points.map(([x, z], i) => {
        const a = run.points[Math.max(0, i - 1)];
        const b = run.points[Math.min(run.points.length - 1, i + 1)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return {
          x: x * m,
          y: run.levels[i],
          z,
          sx: (-(b[1] - a[1]) / l) * m,
          sz: (b[0] - a[0]) / l,
          halfWidth: run.halfWidth,
          shoreCenter: i === 0 ? 0.7 : 0.15,
          shoreEdge: 0.9,
        };
      });
      out.ribbon(points, WATER_STREAM);
    }
    for (const d of this.drops) {
      const [lx, top, lz] = d.lip;
      const [fx, bottom, fz] = d.foot;
      const reach = Math.hypot(fx - lx, fz - lz) || 1;
      const dx = (fx - lx) / reach;
      const dz = (fz - lz) / reach;
      const points: RibbonPoint[] = [];
      const steps = d.void ? 9 : 7;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = -0.25 + (reach + 0.25) * Math.pow(t, d.void ? 0.5 : 0.75);
        points.push({
          x: (lx + dx * r) * m,
          y: lerp(top, bottom - 0.05, t * t),
          z: lz + dz * r,
          sx: dz * m,
          sz: -dx,
          // Into the void, the sheet narrows and turns to mist above the clouds.
          halfWidth: d.halfWidth * (d.void ? lerp(0.95, 0.45, t) : lerp(0.94, 1.12, t)),
          shoreCenter: d.void ? lerp(0.3, 1, t * t) : i === 0 ? 0.8 : i === steps ? 1 : 0.2,
          shoreEdge: d.void ? lerp(0.6, 1, t) : i === steps ? 1 : 0.55,
          bulge: 0.19 * d.halfWidth * Math.sin(t * Math.PI),
          outX: dx * m,
          outZ: dz,
        });
      }
      out.ribbon(points, WATER_FALL);
    }
    const p = this.pond;
    if (!p) return;
    const main = this.layout.islands.main;
    const rings = [0.34, 0.68, 1];
    const segments = Math.max(14, Math.round(p.radius * 5));
    const reach = p.radius + 1.1;
    const shore = (wx: number, z: number) =>
      1 - Math.min(1, Math.max(0, (p.level - this.heightOn(main, wx * m, z)) / 0.6));
    const px = p.x * m;
    const center = out.point(px, p.level, p.z, 0, 0, WATER_STILL, 0);
    let previous: number[] = [];
    rings.forEach((ring, r) => {
      const current: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * TAU;
        const x = px + Math.cos(a) * reach * ring;
        const z = p.z + Math.sin(a) * reach * ring;
        current.push(out.point(x, p.level, z, 0, 0, WATER_STILL, shore(x, z)));
      }
      for (let i = 0; i < segments; i++) {
        const j = (i + 1) % segments;
        if (r === 0) out.triangle(center, current[j], current[i]);
        else {
          out.triangle(previous[i], current[j], current[i]);
          out.triangle(previous[i], previous[j], current[j]);
        }
      }
      previous = current;
    });
  }
}

export function createSkyIslands(seed: number, stage: Stage): Terrain {
  return new SkyIslands(seed, stage);
}
