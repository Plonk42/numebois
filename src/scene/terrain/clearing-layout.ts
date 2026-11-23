import { Rng } from '../../core/rng';
import type { ModelName } from '../asset-catalog';
import { distanceToPath, lerp, smoothstep, spline } from './types';

const TAU = Math.PI * 2;

export type Point = [number, number];

/** Flat step cut in the relief: a stream crosses it and falls from its edge. */
export interface StepDef {
  x: number;
  z: number;
  radius: number;
  /** Width of the rim of the step, from flat to the surrounding relief. */
  edge: number;
}

export interface PeakDef {
  x: number;
  z: number;
  radius: number;
  /** Factor on the heights of the stage table. */
  scale: number;
  /** Exponent of the profile: higher is sharper. */
  sharp: number;
  /** Number and depth of the ridges running down from the summit, and their phase. */
  lobes: number;
  ridge: number;
  phase: number;
}

export interface PoolDef {
  x: number;
  z: number;
  radius: number;
  level: number;
}

/**
 * Slot of the painting, where the child places an element: a tree, or a grove (bushes and
 * flowers) where a tree would be too much.
 */
export interface SlotDef {
  x: number;
  z: number;
  kind: 'tree' | 'grove';
}

/** Dry hollow of the lake moment, with the islet that rises once it is filled. */
export interface BasinDef {
  x: number;
  z: number;
  /** Radius at the first stage; the lake grows with the diorama, up to BASIN_GROWTH times. */
  radius: number;
  islet: Point;
  /** Unit direction it grows towards, mostly the front: its inner bank stays put. */
  toward: Point;
}

/** Larger than the lake of the cascade at every stage, so it is a grand moment. */
export const BASIN_GROWTH = 2.3;
/** Shares of the growth checked for room: the lake sweeps everything in between. */
const BASIN_SAMPLES = [0, 0.25, 0.5, 0.75, 1];

/** The lake moment at a share of its growth (0: first stage, 1: last). */
export function basinAt(
  def: BasinDef,
  t: number,
): { x: number; z: number; radius: number; islet: Point } {
  // Fast at first: it soon outgrows the lake of the cascade.
  const radius = def.radius * lerp(1, BASIN_GROWTH, 1 - (1 - t) ** 2);
  const shift = radius - def.radius;
  const x = def.x + def.toward[0] * shift;
  const z = def.z + def.toward[1] * shift;
  const grow = radius / def.radius;
  const islet: Point = [x + (def.islet[0] - def.x) * grow, z + (def.islet[1] - def.z) * grow];
  return { x, z, radius, islet };
}

/** Distance from a point to the lake moment at any stage, minus its radius. */
function basinReach(def: BasinDef, x: number, z: number): number {
  return Math.min(
    ...BASIN_SAMPLES.map((t) => {
      const b = basinAt(def, t);
      return Math.hypot(x - b.x, z - b.z) - b.radius;
    }),
  );
}

/** Half extents of the diorama and centre of its outline on z. */
export interface Outline {
  hx: number;
  hz: number;
  cz: number;
}

/**
 * Where everything is in a clearing, drawn once from the seed: the same at every stage.
 * The topology stays the hand-made one (massif with its cascade at the back, lake, stream
 * to the front, tributaries from the east and the west); the seed moves the groups, shapes
 * the summits, draws the courses of the streams, and places the trees and boulders.
 */
export interface Layout {
  mirror: number;
  /** Exponent of the outline: lower is rounder. */
  power: number;
  /** Amplitudes and phases of the waves of the outline. */
  wobble: readonly [number, number, number, number];
  /** Rolling of the meadow: amplitude and scale of its noise. */
  roll: number;
  rollScale: number;
  knolls: { x: number; z: number; radius: number; height: number }[];
  /** Main, east and west summits. */
  peaks: readonly [PeakDef, PeakDef, PeakDef];
  ledge: StepDef;
  tier: StepDef;
  top: StepDef;
  eastStep: StepDef;
  eastTop: StepDef;
  westStep: StepDef;
  steps: readonly StepDef[];
  lake: { x: number; z: number; level: number };
  eastPool: PoolDef;
  westPool: PoolDef;
  mainPath: number[][];
  /** From the east pool through the lake moment, then down to the main stream. */
  eastPath: number[][];
  /** Index in `eastPath` of the centre of the lake moment, where the stream enters it. */
  eastInlet: number;
  westPath: number[][];
  /** Stream on the ledge while there is no mountain above it. */
  ledgeSource: number[][];
  /** Points of the cascades: where each fall aims, and where each upper stream starts. */
  ledgeUpper: readonly [Point, Point];
  tierToward: Point;
  tierSource: Point;
  topSource: Point;
  eastSource: Point;
  eastTopSource: Point;
  westSource: Point;
  /** Lake of the grand moment, in the first diorama. */
  basin: BasinDef;
  /** Large foreground trees: position and size. */
  hero: [number, number, number][];
  /** Slots of the clearing, in opening order: nearest the middle of the first diorama first. */
  slots: SlotDef[];
  /** Boulders: model, position, scale and how deep they sink in the ground. */
  rocks: [ModelName, number, number, number, number][];
  /** Back and side limits of the forest, and its share of conifers. */
  forestBack: number;
  forestSide: number;
  conifers: number;
  /** Tone shift of the meadow: positive is lusher. */
  lush: number;
}

// Reference layout, composed by hand; the seed moves its groups.
const PEAKS = [
  { x: -9, z: -22, radius: 16 },
  { x: 15.5, z: -17.5, radius: 11.5 },
  { x: -22.5, z: -11, radius: 8 },
] as const;
const LEDGE: StepDef = { x: -7.3, z: -9.6, radius: 4.6, edge: 1.4 };
const TIER: StepDef = { x: -9, z: -15.2, radius: 3, edge: 1.3 };
const TOP: StepDef = { x: -9.2, z: -18.6, radius: 1.3, edge: 0.9 };
const EAST_STEP: StepDef = { x: 13.2, z: -11.4, radius: 2.7, edge: 1.3 };
const EAST_TOP: StepDef = { x: 14.9, z: -14.4, radius: 1.8, edge: 1.0 };
const WEST_STEP: StepDef = { x: -18.6, z: -8.2, radius: 2.4, edge: 1.2 };
const LAKE = { x: -4.8, z: -3.2, level: -0.5 };
const EAST_POOL = { x: 11.7, z: -7.4, radius: 1.8, level: 0.25 };
const WEST_POOL = { x: -16.4, z: -5.5, radius: 1.6, level: 0.15 };
const MAIN_PATH = [
  [-3.0, -1.8],
  [-0.8, 0.2],
  [1.2, 2.8],
  [3.0, 5.4],
  [5.6, 7.6],
  [7.5, 10.6],
  [8.0, 14.6],
  [7.0, 18.6],
  [6.5, 22.0],
  [6.8, 26.5],
];
const EAST_PATH = [
  [11.2, -6.2],
  [10.5, -4.2],
  [9.7, -1.6],
  [9.3, 1.2],
  [8.4, 3.9],
  [6.9, 6.1],
  [5.6, 7.6],
];
const WEST_PATH = [
  [-15.5, -4.7],
  [-13.6, -3.9],
  [-11.4, -3.6],
  [-9.2, -3.3],
  [-7.2, -3.2],
];
const LEDGE_SOURCE = [
  [-8.6, -12.2],
  [-8.1, -10.8],
  [-7.2, -8.8],
];
const HERO = [
  [-10.6, 6.0, 1.3],
  [16.5, 10.5, 1.05],
  [-21, 12.5, 1.25],
] as const;
const ROCK_MODELS: readonly [ModelName, number, number][] = [
  ['Rock_3_M', 0.4, 0.1],
  ['Rock_3_K', 0.7, 0.2],
  ['Rock_1_G', 0.8, 0.15],
  ['Rock_3_K', 0.8, 0.2],
  ['Rock_1_G', 0.9, 0.15],
  ['Rock_3_M', 0.5, 0.15],
];
/** About 25 slots per painting: these and the three grand moments. */
export const SLOT_COUNT = 22;
/** Slots open in the first diorama: room to choose from the first element on. */
const FIRST_SLOTS = 4;
/** Every fourth slot is a grove: a tree there would be one too many. */
export function slotKind(index: number): SlotDef['kind'] {
  return index % 4 === 2 ? 'grove' : 'tree';
}
/** Water level where the main stream leaves the diorama. */
export const STREAM_END_LEVEL = -1.2;

/** Outline value: 1 on the rim of the diorama, less inside. */
export function rimValue(
  layout: Pick<Layout, 'power' | 'wobble'>,
  outline: Outline,
  fx: number,
  z: number,
): number {
  const a = fx / outline.hx;
  const b = (z - outline.cz) / outline.hz;
  const theta = Math.atan2(b, a);
  const [a3, p3, a5, p5] = layout.wobble;
  const wobble = 1 + a3 * Math.sin(3 * theta + p3) + a5 * Math.sin(5 * theta + p5);
  const power = layout.power;
  return Math.pow(Math.pow(Math.abs(a), power) + Math.pow(Math.abs(b), power), 1 / power) / wobble;
}

/** The lake grows away from the ledge, so the fall always lands near its shore. */
export function lakeCenter(layout: Pick<Layout, 'lake' | 'ledge'>, radius: number): Point {
  const { lake, ledge } = layout;
  const dx = lake.x - ledge.x;
  const dz = lake.z - ledge.z;
  const grow = Math.max(0, radius - 3) / Math.hypot(dx, dz);
  return [lake.x + dx * grow, lake.z + dz * grow];
}

export function pathLength(path: readonly (readonly number[])[]): number {
  let length = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    length += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  }
  return length;
}

/** Point at a fraction of the length of a path. */
function pointAlong(path: readonly (readonly number[])[], fraction: number): Point {
  let left = pathLength(path) * fraction;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len) return [lerp(a[0], b[0], left / len), lerp(a[1], b[1], left / len)];
    left -= len;
  }
  const last = path[path.length - 1];
  return [last[0], last[1]];
}

type Water = Pick<
  Layout,
  | 'ledge'
  | 'tier'
  | 'top'
  | 'eastStep'
  | 'eastTop'
  | 'westStep'
  | 'steps'
  | 'lake'
  | 'eastPool'
  | 'westPool'
  | 'mainPath'
  | 'eastPath'
  | 'westPath'
  | 'ledgeSource'
  | 'ledgeUpper'
  | 'tierToward'
  | 'tierSource'
  | 'topSource'
  | 'eastSource'
  | 'eastTopSource'
  | 'westSource'
> & { offsets: readonly [Point, Point, Point] };

/** Groups of the reference layout moved by the offsets, with the given stream courses. */
function placeWater(
  offsets: readonly [Point, Point, Point],
  courses: (lake: Point, eastPool: Point, westPool: Point) => number[][][],
): Water {
  const [main, east, west] = offsets;
  const move =
    (o: Point) =>
    (p: readonly number[]): Point => [p[0] + o[0], p[1] + o[1]];
  const m = move(main);
  const e = move(east);
  const w = move(west);
  const step = (def: StepDef, at: (p: readonly number[]) => Point): StepDef => {
    const [x, z] = at([def.x, def.z]);
    return { ...def, x, z };
  };
  const ledge = step(LEDGE, m);
  const tier = step(TIER, m);
  const top = step(TOP, m);
  const eastStep = step(EAST_STEP, e);
  const eastTop = step(EAST_TOP, e);
  const westStep = step(WEST_STEP, w);
  const [lx, lz] = m([LAKE.x, LAKE.z]);
  const [ex, ez] = e([EAST_POOL.x, EAST_POOL.z]);
  const [wx, wz] = w([WEST_POOL.x, WEST_POOL.z]);
  const [mainPath, eastPath, westPath] = courses([lx, lz], [ex, ez], [wx, wz]);
  return {
    offsets,
    ledge,
    tier,
    top,
    eastStep,
    eastTop,
    westStep,
    steps: [ledge, tier, top, eastStep, eastTop, westStep],
    lake: { x: lx, z: lz, level: LAKE.level },
    eastPool: { ...EAST_POOL, x: ex, z: ez },
    westPool: { ...WEST_POOL, x: wx, z: wz },
    mainPath,
    eastPath,
    westPath,
    ledgeSource: LEDGE_SOURCE.map(m),
    ledgeUpper: [m([-8, -11]), m([-7.2, -8.8])],
    tierToward: m([-8.2, -12]),
    tierSource: m([-9.1, -16.4]),
    topSource: m([-9.25, -19]),
    eastSource: e([13.55, -12.2]),
    eastTopSource: e([15.3, -15.1]),
    westSource: w([-19.3, -9]),
  };
}

const REFERENCE_WATER = placeWater(
  [
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  () => [spline(MAIN_PATH, 5), spline(EAST_PATH, 4), spline(WEST_PATH, 4)],
);

/** Course from a point to another, bowed to one side by `bend`. */
function bent(from: Point, to: Point, bend: number, points: number): number[][] {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const l = Math.hypot(dx, dz);
  const out: number[][] = [];
  for (let i = 0; i <= points; i++) {
    const s = i / points;
    const b = bend * Math.sin(s * Math.PI);
    out.push([from[0] + dx * s + (dz / l) * b, from[1] + dz * s - (dx / l) * b]);
  }
  return out;
}

/** Groups moved at random, and new courses for the three streams. */
function drawWater(rng: Rng): Water {
  const offsets: [Point, Point, Point] = [
    [rng.range(-4, 6), rng.range(-1.5, 1)],
    [rng.range(-2, 4), rng.range(-1.5, 1.5)],
    [rng.range(-2, 3), rng.range(-1, 1.5)],
  ];
  const exit = rng.range(-12, 16);
  const amplitude = rng.range(0.8, 2.2);
  const waves = rng.range(0.7, 1.8);
  const phase = rng.range(0, TAU);
  const confluence = rng.range(0.3, 0.45);
  const eastBend = rng.range(-2.2, 2.2);
  const westBend = rng.range(-1.2, 1.2);
  return placeWater(offsets, (lake, eastPool, westPool) => {
    // The main stream leaves the lake towards the camera and meanders to the front rim.
    const start: Point = [lake[0] + 1.8, lake[1] + 1.4];
    const main: number[][] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      const swing = Math.sin(phase + t * waves * TAU) - Math.sin(phase);
      main.push([
        lerp(start[0], exit, t) + amplitude * swing * Math.min(1, t * 3),
        lerp(start[1], 26.5, t),
      ]);
    }
    const mainPath = spline(main, 5);
    const eastPath = spline(
      bent([eastPool[0] - 0.5, eastPool[1] + 1.2], pointAlong(mainPath, confluence), eastBend, 6),
      4,
    );
    const westEnd: Point = [lake[0] - 2.4, lake[1]];
    const westPath = spline(bent([westPool[0] + 0.9, westPool[1] + 0.8], westEnd, westBend, 4), 4);
    return [mainPath, eastPath, westPath];
  });
}

/** Whether the streams keep apart from each other and from the steps and pools. */
function validWater(water: Water, final: Outline & { lake: number }): boolean {
  const { mainPath, westPath, eastPool, westPool } = water;
  const mainSteps = [water.ledge, water.tier, water.top];
  for (const [x, z] of mainPath) {
    if (Math.hypot(x - eastPool.x, z - eastPool.z) < eastPool.radius + 4) return false;
    if (Math.hypot(x - westPool.x, z - westPool.z) < westPool.radius + 4) return false;
    if (water.steps.some((s) => Math.hypot(x - s.x, z - s.z) < s.radius + 2.5)) return false;
    // Away from the sides: the stream leaves by the front.
    if (z < final.cz + final.hz * 0.7 && Math.abs(x) > final.hx * 0.55) return false;
  }
  // The west brook keeps apart from the main stream until it reaches its mouth; the east
  // stream is drawn with the lake moment.
  const mouth = westPath[westPath.length - 1];
  for (const [x, z] of westPath) {
    if (Math.hypot(x - mouth[0], z - mouth[1]) <= 5.5) continue;
    if (distanceToPath(mainPath, x, z).distance < 4.5) return false;
    if (mainSteps.some((s) => Math.hypot(x - s.x, z - s.z) < s.radius + 1.5)) return false;
  }
  const [main, east, west] = [water.ledge, water.eastStep, water.westStep];
  if (Math.hypot(main.x - east.x, main.z - east.z) < 16) return false;
  if (Math.hypot(main.x - west.x, main.z - west.z) < 9) return false;
  return true;
}

/** Shapes of the summits: heights, profiles and ridges differ from one seed to the next. */
function drawPeaks(rng: Rng, offsets: readonly [Point, Point, Point]): Layout['peaks'] {
  const scales = [rng.range(0.9, 1.12), rng.range(0.75, 1.45), rng.range(0.7, 1.5)];
  const [main, east, west] = PEAKS.map((peak, i) => ({
    x: peak.x + offsets[i][0] + rng.range(-1.2, 1.2),
    z: peak.z + offsets[i][1] + rng.range(-1, 1),
    radius: peak.radius * rng.range(0.95, 1.1),
    scale: scales[i],
    sharp: rng.range(1.1, 1.65),
    lobes: rng.int(2, 4),
    ridge: rng.range(0.12, 0.3),
    phase: rng.range(0, TAU),
  }));
  return [main, east, west];
}

export function drawLayout(
  seed: number,
  /** Outline of the diorama at each stage, from the first. */
  stages: readonly Outline[],
  final: Outline & { lake: number },
): Layout {
  const first = stages[0];
  const rng = new Rng(seed).fork('layout');
  for (let attempt = 0; attempt < 250; attempt++) {
    const water = drawWater(rng);
    if (!validWater(water, final)) continue;
    const layout = dress(water, rng, stages, final);
    if (!layout) continue;
    // All its slots, a few to choose from and a large tree from the first stage on.
    const inFirst = ([x, z]: readonly number[]) => rimValue(layout, first, x, z) < 0.88;
    const slots = layout.slots.filter((s) => inFirst([s.x, s.z])).length;
    const full = layout.slots.length === SLOT_COUNT;
    if (full && slots >= FIRST_SLOTS && layout.hero.some(inFirst)) return layout;
  }
  return dress(REFERENCE_WATER, rng, stages, final, true)!;
}

function dress(
  water: Water,
  rng: Rng,
  stages: readonly Outline[],
  final: Outline & { lake: number },
  fallback = false,
): Layout | null {
  const { offsets, ...placed } = water;
  const mirror = rng.chance(0.5) ? -1 : 1;
  const shape: Pick<Layout, 'power' | 'wobble'> = {
    power: rng.range(2.9, 4),
    wobble: [rng.range(0.02, 0.05), rng.range(0, TAU), rng.range(0.01, 0.035), rng.range(0, TAU)],
  };
  const placedBasin = placeBasin(water, shape, rng.fork('basin'), stages[0], final, fallback);
  if (!placedBasin) return null;
  const { basin, east } = placedBasin;
  const layout: Layout = {
    ...placed,
    ...shape,
    eastPath: east.path,
    eastInlet: east.inlet,
    mirror,
    roll: rng.range(0.6, 1.3),
    rollScale: rng.range(7, 11),
    knolls: [],
    peaks: drawPeaks(rng, offsets),
    basin,
    hero: [],
    slots: [],
    rocks: [],
    forestBack: rng.range(-4.6, -3.4),
    forestSide: rng.range(0.58, 0.7),
    conifers: rng.range(0.05, 0.85),
    lush: rng.range(-0.06, 0.06),
  };
  placeScenery(layout, rng.fork('scenery'), stages, final);
  return layout;
}

/**
 * Dry hollow for the lake moment: in the first diorama, in front of the massif, away from
 * every stream and pool but the east stream, which runs through it. Without room for it,
 * the water is drawn again.
 */
function placeBasin(
  water: Water,
  shape: Pick<Layout, 'power' | 'wobble'>,
  rng: Rng,
  first: Outline,
  final: Outline & { lake: number },
  fallback: boolean,
): { basin: BasinDef; east: EastCourse } | null {
  const radius = rng.range(2.4, 2.8);
  const banks = Array.from({ length: 8 }, (_, i) => (i / 8) * TAU);
  for (let attempt = 0; attempt < 300; attempt++) {
    const x = rng.range(-first.hx, first.hx) * 0.85;
    const z = rng.range(first.cz - first.hz * 0.3, first.cz + first.hz * 0.75);
    if (rimValue(shape, first, x, z) > (fallback ? 0.85 : 0.8)) continue;
    const out = (outline: Outline, b: { x: number; z: number; radius: number }, limit: number) =>
      banks.some(
        (a) =>
          rimValue(
            shape,
            outline,
            b.x + Math.cos(a) * (b.radius + 1),
            b.z + Math.sin(a) * (b.radius + 1),
          ) > limit,
      );
    // It grows mostly towards the front, clear of the forest on the sides.
    const side = (0.6 * x) / first.hx;
    const length = Math.hypot(side, 1);
    const def: BasinDef = { x, z, radius, islet: [x, z], toward: [side / length, 1 / length] };
    // Its banks stay well inside the first diorama, and inside the last one once grown.
    if (!fallback && out(first, def, 0.95)) continue;
    if (!fallback && out(final, basinAt(def, 1), 0.9)) continue;
    const margin = fallback ? -1.2 : -0.6;
    const dry = BASIN_SAMPLES.every((t) => {
      const b = basinAt(def, t);
      return waterDryness(water, final.lake, b.x, b.z, false) - b.radius >= margin;
    });
    if (!dry) continue;
    // The first large tree stands near its hand-made spot.
    if (basinReach(def, HERO[0][0], HERO[0][1]) < 4.5) continue;
    const east = eastCourse(water, def, rng, shape, final);
    if (!east) continue;
    const a = rng.range(0, TAU);
    def.islet = [x + Math.cos(a) * radius * 0.3, z + Math.sin(a) * radius * 0.3];
    return { basin: def, east };
  }
  if (!fallback) return null;
  const z = first.cz + first.hz * 0.45;
  const basin: BasinDef = { x: 0, z, radius, islet: [radius * 0.3, z], toward: [0, 1] };
  return { basin, east: eastCourse(water, basin, rng, shape, null)! };
}

interface EastCourse {
  path: number[][];
  inlet: number;
}

/**
 * Course of the east stream: from its pool into the hollow of the lake moment, then out past
 * the front bank of the grown lake and down to the main stream. Checked against the final
 * layout unless `final` is null.
 */
function eastCourse(
  water: Water,
  def: BasinDef,
  rng: Rng,
  shape: Pick<Layout, 'power' | 'wobble'>,
  final: (Outline & { lake: number }) | null,
): EastCourse | null {
  const pool = water.eastPool;
  const center: Point = [def.x, def.z];
  const last = basinAt(def, 1);
  const reach = last.radius + 2;
  const out: Point = [last.x + def.toward[0] * reach, last.z + def.toward[1] * reach];
  const main = water.mainPath;
  const length = pathLength(main);
  const near = distanceToPath(main, out[0], out[1]);
  const mouth = pointAlong(main, Math.min(1, (near.along + 2) / length));
  const bend = rng.range(-1.5, 1.5);
  const inflow = spline(bent([pool.x - 0.5, pool.z + 1.2], center, bend, 5), 4);
  const outflow = spline([center, out, mouth], 4);
  const course = { path: [...inflow, ...outflow.slice(1)], inlet: inflow.length - 1 };
  if (!final) return course;
  if (near.along / length < 0.15 || rimValue(shape, final, mouth[0], mouth[1]) > 0.85) return null;
  const [lakeX, lakeZ] = lakeCenter(water, final.lake);
  const mainSteps = [water.ledge, water.tier, water.top];
  for (const [x, z] of course.path) {
    if (rimValue(shape, final, x, z) > 0.9) return null;
    if (Math.hypot(x - lakeX, z - lakeZ) < final.lake + 3) return null;
    if (mainSteps.some((s) => Math.hypot(x - s.x, z - s.z) < s.radius + 2)) return null;
    // Apart from the main stream until its mouth.
    if (Math.hypot(x - mouth[0], z - mouth[1]) <= 5) continue;
    if (distanceToPath(main, x, z).distance < 4) return null;
  }
  return course;
}

/** Distance from a point to the nearest stream, pool or step of the final layout, minus its reach. */
function waterDryness(
  layout: Omit<Water, 'offsets'>,
  finalLake: number,
  x: number,
  z: number,
  east = true,
): number {
  const [lakeX, lakeZ] = lakeCenter(layout, finalLake);
  return Math.min(
    distanceToPath(layout.mainPath, x, z).distance - 3.2,
    east ? distanceToPath(layout.eastPath, x, z).distance - 2.6 : Infinity,
    distanceToPath(layout.westPath, x, z).distance - 2.4,
    Math.hypot(x - lakeX, z - lakeZ) - finalLake - 2.4,
    Math.hypot(x - layout.eastPool.x, z - layout.eastPool.z) - layout.eastPool.radius - 1.8,
    Math.hypot(x - layout.westPool.x, z - layout.westPool.z) - layout.westPool.radius - 1.8,
    ...layout.steps.map((s) => Math.hypot(x - s.x, z - s.z) - s.radius - 0.8),
  );
}

/** Whether a point is in the band of forest around the clearing, at the back and on the sides. */
export function inForest(layout: Layout, finalHx: number, x: number, z: number): boolean {
  const back = smoothstep(layout.forestBack, layout.forestBack - 3, z);
  const side =
    smoothstep(layout.forestSide, layout.forestSide + 0.1, Math.abs(x) / finalHx) *
    smoothstep(17, 12, z);
  return Math.max(back, side) >= 0.5;
}

/** Distance from a point to the nearest water or step of the final layout, minus its reach. */
export function dryness(layout: Layout, finalLake: number, x: number, z: number): number {
  return Math.min(waterDryness(layout, finalLake, x, z), basinReach(layout.basin, x, z) - 1.8);
}

/**
 * Whether a tree there would hide water: seen from the camera, a tree hides the ground far
 * behind it, so none stands in front of the lake, the falls, the pools or the confluence.
 */
export function hidesWater(layout: Layout, finalLake: number, x: number, z: number): boolean {
  const [lakeX, lakeZ] = lakeCenter(layout, finalLake);
  const end = layout.eastPath[layout.eastPath.length - 1];
  const [first, last] = [basinAt(layout.basin, 0), basinAt(layout.basin, 1)];
  const views: [number, number, number][] = [
    [lakeX, lakeZ, finalLake],
    [first.x, first.z, first.radius],
    [last.x, last.z, last.radius],
    [layout.ledge.x, layout.ledge.z, 3],
    [layout.eastPool.x, layout.eastPool.z, 2.4],
    [layout.westPool.x, layout.westPool.z, 2.2],
    [end[0], end[1], 1.8],
  ];
  return views.some(([vx, vz, r]) => {
    const dz = z - vz;
    return dz > -0.3 * r && dz < 14 && Math.abs(x - vx) < 0.6 * r + 1.6 + dz * 0.08;
  });
}

/** Knolls, trees and boulders of the meadow, away from the water and out of its view. */
function placeScenery(
  layout: Layout,
  rng: Rng,
  stages: readonly Outline[],
  final: Outline & { lake: number },
) {
  const first = stages[0];
  const dry = (x: number, z: number) => dryness(layout, final.lake, x, z);
  const inView = (x: number, z: number) => hidesWater(layout, final.lake, x, z);
  const taken: { x: number; z: number; r: number }[] = [];
  const spaced = (x: number, z: number, r: number) =>
    taken.every((t) => Math.hypot(t.x - x, t.z - z) >= (t.r + r) / 2);
  const rimFinal = (x: number, z: number) => rimValue(layout, final, x, z);
  const rimFirst = (x: number, z: number) => rimValue(layout, first, x, z);

  // Large foreground trees frame the view: near the hand-made spots, moved a little.
  HERO.forEach(([hx, hz, size], i) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const reach = Math.min(6, attempt * 0.15);
      const x = hx + rng.range(-reach, reach);
      const z = hz + rng.range(-reach, reach);
      if (dry(x, z) < 1 || inView(x, z) || !spaced(x, z, 5)) continue;
      if (rimFinal(x, z) > 0.88 || (i === 0 && rimFirst(x, z) > 0.88)) continue;
      layout.hero.push([x, z, size]);
      taken.push({ x, z, r: 5 });
      break;
    }
  });
  // Without a large tree in the first diorama, the layout is drawn again: skip the rest.
  if (!layout.hero.some(([x, z]) => rimFirst(x, z) < 0.88)) return;

  // Candidate slots, in the order they open: by the first stage that shows them, then nearest
  // the middle of the first diorama. Any of them, filled or not, keeps the water in view, and
  // past the first diorama they leave the forest around the clearing its room.
  const candidates: { at: Point; stage: number; rim: number }[] = [];
  for (let attempt = 0; attempt < 1600; attempt++) {
    const x = rng.range(-22, 22);
    const z = rng.range(-8, 20);
    if (rimFinal(x, z) > 0.88 || dry(x, z) < 0.4 || inView(x, z)) continue;
    if (rimFirst(x, z) > 0.88 && inForest(layout, final.hx, x, z)) continue;
    const stage = stages.findIndex((outline) => rimValue(layout, outline, x, z) <= 0.93);
    candidates.push({ at: [x, z], stage, rim: rimFirst(x, z) });
  }
  candidates.sort((a, b) => a.stage - b.stage || a.rim - b.rim);
  for (const {
    at: [x, z],
  } of candidates) {
    if (layout.slots.length >= SLOT_COUNT) break;
    const kind = slotKind(layout.slots.length);
    const spacing = kind === 'tree' ? 4.2 : 3;
    if (!spaced(x, z, spacing)) continue;
    layout.slots.push({ x, z, kind });
    taken.push({ x, z, r: spacing });
  }

  // Boulders, a few already in the first diorama.
  for (let attempt = 0; attempt < 300 && layout.rocks.length < ROCK_MODELS.length; attempt++) {
    const near = layout.rocks.length < 2 && attempt < 150;
    const x = rng.range(-20, 20);
    const z = rng.range(-6, 18);
    if ((near ? rimFirst(x, z) : rimFinal(x, z)) > 0.85 || dry(x, z) < 0.2) continue;
    if (!spaced(x, z, 3)) continue;
    const [model, scale, sink] = ROCK_MODELS[layout.rocks.length];
    layout.rocks.push([model, x, z, scale, sink]);
    taken.push({ x, z, r: 3 });
  }

  // Gentle knolls in the meadow, away from the water.
  const count = rng.int(0, 2);
  for (let attempt = 0; attempt < 40 && layout.knolls.length < count; attempt++) {
    const radius = rng.range(4, 7);
    const x = rng.range(-16, 16);
    const z = rng.range(-2, 16);
    if (dry(x, z) < radius - 1.5) continue;
    layout.knolls.push({ x, z, radius, height: rng.range(0.8, 1.8) });
  }
}
