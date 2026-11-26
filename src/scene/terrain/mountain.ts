import { Rng, valueNoise2 } from '../../core/rng';
import type { ModelName } from '../asset-catalog';
import { swatchUV } from '../atlas';
import { HANG, ROPE_OVER, sagAt } from '../cableway';
import {
  LAST_STAGE,
  STAGES,
  rareStage,
  stageFor,
  type PerStage,
  type RareName,
  type Stage,
} from '../description';
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
import { rimValue, SLOT_COUNT } from './clearing-layout';
import { buildDiorama, groundGrid } from './diorama';
import {
  distanceToPath,
  lerp,
  smoothstep,
  type Announcement,
  type BankPath,
  type Cableway,
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
/** Size of a ground facet. */
const CELL = 0.72;
/** The camera looks down at the diorama at this angle (degrees), straight from the front. */
const CAMERA_PITCH = 24;
/** Horizontal reach of the cliff under the brink of a ledge. */
const CLIFF = 1.1;
/** Radius of the tarn where a side torrent may end, on its back ledge. */
const TARN = 1.6;
/** Snow covers the peaks above this height, in every season. */
const SNOW_LINE = 11.5;
const MAX_EDGE_TREES = 22;
/** Stage from which the shop sells the cable car (#154). */
const CABLECAR_STAGE = rareStage('mountain', 'cablecar')!;
/** The eagles come by themselves with this stage. */
const EAGLES_STAGE = 9;
/** Tallest pylon of the cable car, from the ground to its ropes. */
const TALLEST_PYLON = 8;
/** Points around a cabin, to find the highest ground under it. */
const AROUND_CABIN: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.9, 0],
  [-0.9, 0],
  [0, 0.9],
  [0, -0.9],
];
/** From the great peak's summit to its top station, towards the camera, in shares of its radius. */
const TOP_STATION = 0.3;

// One value per stage. The diorama widens around a gorge: rock ledges rise one after another
// around the pool at its foot, steep peaks and needles stand behind and beside them. Three
// torrents spring on the high ledges and fall from ledge to ledge; the side ones join the main
// stream, each at its own place on the middle ledge (or one ends in a tarn), and it falls into
// the pool. At 6 the hanging valley rises high over the middle ledge:
// the great cascade, wrapped in spray. At 11 the great peak reaches its full height.
const MOUNTAIN_BY_STAGE = {
  hx: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 25.5, 26],
  // The front edge never moves back: what stands there stays in the painting.
  hz: [11, 12.5, 13, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21],
  cz: [4.5, 3, 2.5, 0, -0.5, -1, -1.5, -1.5, -2, -2.5, -2.5, -3],
  pool: [2.2, 2.4, 2.6, 2.8, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.55, 3.6],
  /** Half width of a torrent; the one that falls into the pool carries all three. */
  torrent: [0.26, 0.28, 0.3, 0.32, 0.34, 0.36, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56],
  cover: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.08, 1.15, 1.22, 1.3, 1.35, 1.4],
  cascade: [false, false, false, false, false, false, true, true, true, true, true, true],
  peak: [false, false, false, false, false, false, false, false, false, false, false, true],
} satisfies Record<string, PerStage<number> | PerStage<boolean>>;

/**
 * Ledges around the gorge, drawn in these ranges (`west` is on the left before the mirror),
 * with their height at each stage (0 before they come). Their order of height never changes,
 * so a place on a ledge stays on it.
 */
const LEDGES = {
  middle: {
    x: [-1.5, 1.5],
    z: [1.5, 2.5],
    rx: [7, 8],
    rz: [4.4, 5],
    height: [3, 3.5, 4, 4.5, 5, 5, 5.5, 5.5, 6, 6, 6, 6],
  },
  hanging: {
    x: [-2.5, 2.5],
    z: [-7, -6],
    rx: [6.5, 7.5],
    rz: [4.5, 5.2],
    height: [0, 6, 6.5, 7, 7.5, 8, 14, 14.5, 15, 15.5, 16, 16.5],
  },
  westLow: {
    x: [-17, -15.5],
    z: [6, 8],
    rx: [6, 7],
    rz: [5, 6],
    height: [0, 0, 4, 4.3, 4.6, 4.8, 5, 5.2, 5.4, 5.5, 5.5, 5.5],
  },
  westBack: {
    x: [-12, -10.5],
    z: [-4.5, -3.5],
    rx: [6.5, 7.5],
    rz: [4.8, 5.5],
    height: [0, 0, 0, 0, 7, 7.3, 8, 8.3, 8.6, 9, 9.2, 9.5],
  },
  eastLow: {
    x: [15.5, 17],
    z: [5, 7],
    rx: [6, 7],
    rz: [5, 6],
    height: [0, 0, 0, 0, 0, 4.3, 4.6, 4.8, 5, 5.2, 5.4, 5.5],
  },
  eastBack: {
    x: [10.5, 12],
    z: [-5, -4],
    rx: [6.5, 7.5],
    rz: [4.8, 5.5],
    height: [0, 0, 0, 0, 0, 0, 0, 8, 8.5, 9, 9.5, 10],
  },
  westHigh: {
    x: [-20, -18],
    z: [-11, -9.5],
    rx: [6, 7],
    rz: [5, 5.6],
    height: [0, 0, 0, 0, 0, 0, 0, 0, 11, 11.5, 12, 12.5],
  },
  eastHigh: {
    x: [18, 20],
    z: [-12, -10.5],
    rx: [6, 7],
    rz: [5, 5.6],
    height: [0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12.5, 13],
  },
} satisfies Record<string, LedgeRange>;

/** Peaks and needles: steep cones with ridges, snowy above the snow line. */
const PEAKS = {
  needle: {
    x: [7.5, 9.5],
    z: [3, 5],
    r: [2.2, 2.8],
    sharp: 0.45,
    height: [8, 8.5, 9, 9.5, 10, 10, 10.5, 10.5, 11, 11, 11.5, 12],
  },
  westNeedle: {
    x: [-17, -15.5],
    z: [4, 6],
    r: [2, 2.6],
    sharp: 0.45,
    height: [0, 0, 9, 9.5, 10, 10, 10.5, 10.5, 11, 11, 11, 11.5],
  },
  main: {
    x: [-3, 3],
    z: [-17, -15.5],
    r: [6, 7],
    sharp: 0.7,
    height: [0, 0, 0, 15, 16, 17, 18, 19, 20, 21, 22, 30],
  },
  eastNeedle: {
    x: [15.5, 17],
    z: [3, 5],
    r: [2, 2.6],
    sharp: 0.45,
    height: [0, 0, 0, 0, 0, 9.5, 10, 10.5, 11, 11, 11.5, 12],
  },
  west: {
    x: [-15, -12],
    z: [-19, -17.5],
    r: [5, 6],
    sharp: 0.65,
    height: [0, 0, 0, 0, 0, 0, 0, 0, 19, 20, 21, 22],
  },
  east: {
    x: [12, 15],
    z: [-20, -18],
    r: [5.5, 6.5],
    sharp: 0.65,
    height: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23, 24],
  },
} satisfies Record<string, PeakRange>;

type LedgeName = keyof typeof LEDGES;
type PeakName = keyof typeof PEAKS;

/** Ledges each torrent falls from, highest first, before the middle ledge or its tarn. */
const TORRENTS: readonly (readonly LedgeName[])[] = [
  ['hanging'],
  ['westHigh', 'westBack'],
  ['eastHigh', 'eastBack'],
];

interface LedgeRange {
  x: readonly [number, number];
  z: readonly [number, number];
  rx: readonly [number, number];
  rz: readonly [number, number];
  height: PerStage<number>;
}

interface PeakRange {
  x: readonly [number, number];
  z: readonly [number, number];
  r: readonly [number, number];
  sharp: number;
  height: PerStage<number>;
}

interface Ledge {
  name: LedgeName;
  x: number;
  z: number;
  rx: number;
  rz: number;
  lobes: readonly [number, number, number, number];
  height: PerStage<number>;
  /** First stage that shows it. */
  stage: Stage;
}

interface Peak {
  name: PeakName;
  x: number;
  z: number;
  r: number;
  sharp: number;
  ridges: readonly [number, number, number, number];
  height: PerStage<number>;
  stage: Stage;
}

/** A torrent's way down: on each ledge from where it lands to its brink, then the fall. */
interface Leg {
  ledge: LedgeName;
  /** Where it springs while this ledge is the highest of its torrent. */
  spring: [number, number];
  from: [number, number];
  to: [number, number];
}

interface Layout {
  mirror: number;
  power: number;
  wobble: readonly [number, number, number, number];
  ledges: Record<LedgeName, Ledge>;
  peaks: Record<PeakName, Peak>;
  /** Legs of each torrent, highest first, down to the middle ledge or to its tarn. */
  torrents: readonly (readonly Leg[])[];
  /** Share of the way down the main stream where each torrent joins it, null for the tarn's. */
  joins: readonly (number | null)[];
  /** The middle ledge's brink above the pool, and the pool. */
  brink: [number, number];
  pool: { x: number; z: number; dx: number; dz: number };
  /** Small lake on a back ledge where a side torrent ends, apart from the main stream. */
  tarn: { ledge: LedgeName; x: number; z: number } | null;
  /** Water that leaves the pool, the tarn or a low spring, and falls off the island. */
  outflows: readonly Outflow[];
}

/** Water running to the rim and falling off the island, like the clearing's stream. */
interface Outflow {
  /** The basin it overflows from, or the low ledge it springs on. */
  from: 'pool' | 'tarn' | LedgeName;
  /** Its spring on a low ledge; a basin overflows from its shore. */
  at: [number, number] | null;
  dir: [number, number];
  /** Share of the width of a torrent. */
  width: number;
}

/** Water running on a ledge, at its level. */
interface Run {
  points: readonly (readonly [number, number])[];
  /** Water level at each point: flat on a ledge, going down on the floor. */
  levels: readonly number[];
  along: readonly number[];
  halfWidth: number;
  /** Bounds of what it digs: min x, min z, max x, max z. */
  box: readonly [number, number, number, number];
}

/** Fall over a cliff. */
interface Drop {
  lip: [number, number, number];
  foot: [number, number, number];
  halfWidth: number;
  /** Off the island, into the void, where it turns to mist. */
  void?: boolean;
}

function firstStage(height: PerStage<number>): Stage {
  return STAGES.find((stage) => height[stage] > 0) ?? LAST_STAGE;
}

/** Distance of a point from the centre of a ledge, 1 on its brink. */
function ledgeDistance(l: Ledge, x: number, z: number): number {
  const u = (x - l.x) / l.rx;
  const v = (z - l.z) / l.rz;
  const theta = Math.atan2(v, u);
  const [a2, p2, a3, p3] = l.lobes;
  return Math.hypot(u, v) / (1 + a2 * Math.sin(2 * theta + p2) + a3 * Math.sin(3 * theta + p3));
}

/** Share of a ledge's height at a point: 1 on its top, down to 0 at the foot of its cliff. */
function ledgeMask(l: Ledge, x: number, z: number): number {
  const t = ((ledgeDistance(l, x, z) - 1) * Math.min(l.rx, l.rz)) / CLIFF;
  return 1 - smoothstep(0, 1, t);
}

/** Distance of a point from the axis of a peak, 1 at its foot (ridges reach further). */
function peakDistance(p: Peak, x: number, z: number): number {
  const theta = Math.atan2(z - p.z, x - p.x);
  const [a3, p3, a5, p5] = p.ridges;
  const ridge = 1 + a3 * Math.sin(3 * theta + p3) + a5 * Math.sin(5 * theta + p5);
  return Math.hypot(x - p.x, z - p.z) / (p.r * ridge);
}

/** Far enough from a feature that it never reaches the point, whatever its height. */
function clearOf(feature: Ledge | Peak, x: number, z: number, margin: number): boolean {
  if ('rx' in feature) {
    return ledgeDistance(feature, x, z) > 1 + (CLIFF + margin) / Math.min(feature.rx, feature.rz);
  }
  return peakDistance(feature, x, z) > 1 + margin / feature.r;
}

/** Point where a ray from the centre of a ledge crosses its brink. */
function brinkOf(l: Ledge, dx: number, dz: number): [number, number] {
  let lo = 0;
  let hi = 3 * Math.max(l.rx, l.rz);
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if (ledgeDistance(l, l.x + dx * t, l.z + dz * t) < 1) lo = t;
    else hi = t;
  }
  return [l.x + dx * lo, l.z + dz * lo];
}

function direction(from: [number, number], to: [number, number]): [number, number] {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

/** Where a fall from the brink lands, past the cliff. */
function landing(brink: [number, number], [dx, dz]: [number, number]): [number, number] {
  return [brink[0] + dx * (CLIFF + 1), brink[1] + dz * (CLIFF + 1)];
}

function drawOnce(seed: number, attempt: number): Layout {
  const rng = new Rng(seed).fork(`mountain:${attempt}`);
  const mirror = rng.chance(0.5) ? 1 : -1;
  const ledges = {} as Record<LedgeName, Ledge>;
  for (const [name, r] of Object.entries(LEDGES) as [LedgeName, LedgeRange][]) {
    ledges[name] = {
      name,
      x: mirror * rng.range(...r.x),
      z: rng.range(...r.z),
      rx: rng.range(...r.rx),
      rz: rng.range(...r.rz),
      lobes: [rng.range(0.03, 0.08), rng.range(0, TAU), rng.range(0.03, 0.07), rng.range(0, TAU)],
      height: r.height,
      stage: firstStage(r.height),
    };
  }
  const peaks = {} as Record<PeakName, Peak>;
  for (const [name, r] of Object.entries(PEAKS) as [PeakName, PeakRange][]) {
    peaks[name] = {
      name,
      x: mirror * rng.range(...r.x),
      z: rng.range(...r.z),
      r: rng.range(...r.r),
      sharp: r.sharp,
      ridges: [rng.range(0.08, 0.14), rng.range(0, TAU), rng.range(0.04, 0.08), rng.range(0, TAU)],
      height: r.height,
      stage: firstStage(r.height),
    };
  }
  const middle = ledges.middle;
  const center: [number, number] = [middle.x, middle.z];
  const brink = brinkOf(middle, ...direction(center, [middle.x, middle.z + 10]));
  const legsOf = (
    chain: readonly LedgeName[],
    end: (from: [number, number]) => [number, number],
  ) => {
    const legs: Leg[] = [];
    let from: [number, number] | null = null;
    for (let i = 0; i + 1 < chain.length; i++) {
      const l = ledges[chain[i]];
      const next = ledges[chain[i + 1]];
      // Towards the middle of the next ledge, or of the middle ledge's back for the last one.
      const target: [number, number] =
        next === middle ? [lerp(middle.x, l.x, 0.35), middle.z] : [next.x, next.z];
      const dir = direction([l.x, l.z], target);
      const edge = brinkOf(l, ...dir);
      // A spring a little behind the middle of the ledge.
      const spring: [number, number] = [l.x - dir[0] * l.rx * 0.15, l.z - dir[1] * l.rz * 0.15];
      legs.push({ ledge: l.name, spring, from: from ?? spring, to: edge });
      from = landing(edge, dir);
    }
    legs.push({ ledge: chain.at(-1)!, spring: from!, from: from!, to: end(from!) });
    return legs;
  };
  const main = legsOf([...TORRENTS[0], 'middle'], () => brink);
  const source = main.at(-1)!.from;
  // Now and then a side torrent keeps to its side and ends in a tarn on its back ledge; the
  // others join the main stream, each at its own place down it.
  const apart = rng.chance(0.5) ? rng.pick([1, 2]) : 0;
  const early = rng.pick([1, 2]);
  const joins = TORRENTS.map((_, t) => {
    if (t === 0) return 0;
    if (t === apart) return null;
    if (apart) return rng.range(0.3, 0.7);
    return t === early ? rng.range(0.1, 0.25) : rng.range(0.65, 0.85);
  });
  // The tarn lies on the front of the back ledge, towards the outside, in view.
  const own = apart ? ledges[apart === 1 ? 'westBack' : 'eastBack'] : null;
  const tarn = own
    ? { ledge: own.name, x: own.x + Math.sign(own.x) * own.rx * 0.2, z: own.z + own.rz * 0.3 }
    : null;
  // Every torrent ends off the island: the pool overflows towards the front, the tarn towards
  // its side, and a spring on a low ledge runs off the side too, now and then, always without
  // a tarn: two falls at least.
  const turn = rng.range(-0.35, 0.35);
  const outflows: Outflow[] = [
    { from: 'pool', at: null, dir: [Math.sin(turn), Math.cos(turn)], width: 1.2 },
  ];
  if (tarn) {
    outflows.push({
      from: 'tarn',
      at: null,
      dir: direction([0, 0], [Math.sign(tarn.x) * 0.9, 0.45]),
      width: 0.8,
    });
  }
  const springs = (['westLow', 'eastLow'] as const).filter(() => rng.chance(0.55));
  if (!tarn && springs.length === 0) springs.push(rng.pick(['westLow', 'eastLow'] as const));
  for (const name of springs) {
    const l = ledges[name];
    const side = Math.sign(l.x) || 1;
    outflows.push({
      from: name,
      at: [l.x + side * l.rx * 0.25, l.z + l.rz * 0.35],
      dir: direction([0, 0], [side * 0.85, 0.5]),
      width: 0.5,
    });
  }
  const torrents = TORRENTS.map((chain, t) => {
    if (t === 0) return main;
    if (t === apart) return legsOf(chain, () => [tarn!.x, tarn!.z]);
    const f = joins[t]!;
    return legsOf([...chain, 'middle'], () => [
      lerp(source[0], brink[0], f),
      lerp(source[1], brink[1], f),
    ]);
  });
  const [fx, fz] = landing(brink, [0, 1]);
  return {
    mirror,
    power: rng.range(2.2, 2.8),
    wobble: [rng.range(0.02, 0.05), rng.range(0, TAU), rng.range(0.01, 0.03), rng.range(0, TAU)],
    ledges,
    peaks,
    torrents,
    joins,
    brink,
    tarn,
    outflows,
    pool: { x: fx, z: fz, dx: 0, dz: 1 },
  };
}

/** Height rank of a feature: a higher one always stands over a lower one where they meet. */
function topOf(feature: Ledge | Peak): number {
  return feature.height[LAST_STAGE];
}

/**
 * Every leg of every torrent stays on its ledge, out of reach of the ledges above it and of
 * the peaks; the pool stays clear of the other ledges and the needles.
 */
function valid(layout: Layout): boolean {
  const ledges = Object.values(layout.ledges);
  const peaks = Object.values(layout.peaks);
  for (const legs of layout.torrents) {
    for (const leg of legs) {
      const own = layout.ledges[leg.ledge];
      for (let i = 0; i <= 16; i++) {
        const [a, t] = i <= 8 ? [leg.from, i / 8] : [leg.spring, (i - 8) / 8];
        const x = lerp(a[0], leg.to[0], t);
        const z = lerp(a[1], leg.to[1], t);
        if (ledgeDistance(own, x, z) > (i === 0 ? 0.85 : 1.01)) return false;
        if (ledges.some((l) => l !== own && topOf(l) > topOf(own) && !clearOf(l, x, z, 0.4))) {
          return false;
        }
        if (peaks.some((p) => !clearOf(p, x, z, 1))) return false;
      }
    }
  }
  const { x, z } = layout.pool;
  const radius = MOUNTAIN_BY_STAGE.pool[LAST_STAGE];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const px = x + Math.cos(a) * (radius + 1);
    const pz = z + radius - 0.9 + Math.sin(a) * (radius + 1);
    if (ledges.some((l) => l.name !== 'middle' && !clearOf(l, px, pz, 0.2))) return false;
    if (peaks.some((p) => !clearOf(p, px, pz, 0.5))) return false;
  }
  const { tarn } = layout;
  if (tarn) {
    const own = layout.ledges[tarn.ledge];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const px = tarn.x + Math.cos(a) * (TARN + 0.4);
      const pz = tarn.z + Math.sin(a) * (TARN + 0.4);
      if (ledgeDistance(own, px, pz) > 0.9) return false;
      if (ledges.some((l) => l !== own && topOf(l) > topOf(own) && !clearOf(l, px, pz, 0.4))) {
        return false;
      }
      if (peaks.some((p) => !clearOf(p, px, pz, 1))) return false;
    }
  }
  for (const o of layout.outflows) {
    const own = o.from === 'pool' ? null : layout.ledges[o.from === 'tarn' ? tarn!.ledge : o.from];
    const start = o.at ?? (o.from === 'tarn' ? [tarn!.x, tarn!.z] : [x, z + 1.5]);
    for (let i = 0; i < 40; i++) {
      const px = start[0] + o.dir[0] * i;
      const pz = start[1] + o.dir[1] * i;
      if (rimValue(layout, outlineOf(LAST_STAGE), px, pz) > 1) break;
      if (peaks.some((p) => !clearOf(p, px, pz, 0.8))) return false;
      const above = ledges.some(
        (l) => l !== own && (!own || topOf(l) > topOf(own)) && !clearOf(l, px, pz, 0.3),
      );
      if (above) return false;
    }
  }
  return true;
}

const layouts = new Map<number, Layout>();

/**
 * The layout of a seed: drawn again while a rule breaks, or while its places do not all fit
 * or leave the child less than two to choose from at a stage.
 */
export function layoutOf(seed: number): Layout {
  const cached = layouts.get(seed);
  if (cached) return cached;
  let first: Layout | null = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const layout = drawOnce(seed, attempt);
    if (!valid(layout)) continue;
    first ??= layout;
    layouts.set(seed, layout);
    waterCache.delete(seed);
    slotCache.delete(seed);
    forestCache.delete(seed);
    cablewayCache.delete(seed);
    // Every place fits, and the cable car finds its line.
    if (roomy(slotsOf(seed)) && cablewayOf(seed)) return layout;
  }
  const fallback = first ?? drawOnce(seed, 0);
  layouts.set(seed, fallback);
  waterCache.delete(seed);
  slotCache.delete(seed);
  return fallback;
}

/** Every place fits, at least 4 at first, and always 2 left to choose from. */
function roomy(slots: readonly SlotDef[]): boolean {
  if (slots.length < SLOT_COUNT) return false;
  const open = STAGES.map((stage) => slots.filter((s) => s.opens <= stage).length);
  if (open[0] < 4) return false;
  for (let placed = 0; placed < SLOT_COUNT; placed++) {
    if (open[stageFor(placed)] - placed < Math.min(2, SLOT_COUNT - placed)) return false;
  }
  return true;
}

/** Height of a tree of the child, with a margin. */
const TREE_HEIGHT = 4;
/** Slope of the camera's line of sight (tangent of its pitch). */
const SIGHT = Math.tan((CAMERA_PITCH * Math.PI) / 180);

/**
 * Seen from the camera, slightly from above, a tree standing at `y` hides the water behind it
 * that is lower than the line of sight over its top: a fall high on a cliff stays in view.
 */
export function hidesWater(
  water: readonly (readonly [number, number, number])[],
  x: number,
  z: number,
  y: number,
): boolean {
  return water.some(
    ([wx, wz, wy]) =>
      z > wz && z - wz < 9 && Math.abs(x - wx) < 1.8 && wy < y + TREE_HEIGHT - SIGHT * (z - wz),
  );
}

const waterCache = new Map<number, [number, number, number][][]>();

/** The torrents and their falls at each stage, with their height. */
function waterOf(seed: number): [number, number, number][][] {
  let water = waterCache.get(seed);
  if (!water) {
    water = STAGES.map((stage) => new Mountain(seed, stage, false, false).waterPoints());
    waterCache.set(seed, water);
  }
  return water;
}

/** Off the water of every stage and the pool. */
function offWater(seed: number, x: number, z: number): boolean {
  const { pool, tarn } = layoutOf(seed);
  if (tarn && Math.hypot(x - tarn.x, z - tarn.z) < TARN + 1.2) return false;
  const radius = MOUNTAIN_BY_STAGE.pool[LAST_STAGE];
  const pz = pool.z + radius - 0.9;
  return (
    waterOf(seed).every((water) => water.every(([wx, wz]) => Math.hypot(x - wx, z - wz) >= 1.8)) &&
    Math.hypot(x - pool.x, z - pz) > radius + 1.5
  );
}

/**
 * A tree there would hide water at some stage from the one that shows it: a torrent or a fall
 * behind it, or the pool for a place on the floor of the gorge.
 */
function inFrontOfWater(
  seed: number,
  x: number,
  z: number,
  ledge: Ledge | null,
  floor: number,
): boolean {
  const { pool } = layoutOf(seed);
  const radius = MOUNTAIN_BY_STAGE.pool[LAST_STAGE];
  const pz = pool.z + radius - 0.9;
  if (!ledge && z > pz && z - pz < 9 + radius && Math.abs(x - pool.x) < radius + 1.5) return true;
  return waterOf(seed).some((water, stage) => {
    if (ledge && ledge.height[stage] === 0) return false;
    return hidesWater(water, x, z, ledge ? ledge.height[stage] : floor);
  });
}

/**
 * What a place stands on for good: the top of a ledge, away from its brink and out of reach
 * of every higher ledge and of the peaks, or the floor of the gorge, out of reach of all.
 */
function standing(layout: Layout, x: number, z: number): { ledge: Ledge | null } | null {
  const ledges = Object.values(layout.ledges);
  if (Object.values(layout.peaks).some((p) => !clearOf(p, x, z, 1.2))) return null;
  const tops = ledges
    .filter((l) => ledgeDistance(l, x, z) < 1 - 1.1 / Math.min(l.rx, l.rz))
    .sort((a, b) => topOf(b) - topOf(a));
  const own = tops[0] ?? null;
  const above = ledges.filter((l) => l !== own && (!own || topOf(l) > topOf(own)));
  if (above.some((l) => !clearOf(l, x, z, 0.6))) return null;
  return { ledge: own };
}

/** A place of the child: on a ledge, or a grove on the floor of the gorge or a low ledge. */
interface SlotDef {
  x: number;
  z: number;
  kind: 'tree' | 'grove';
  /** First stage whose diorama holds it. */
  opens: Stage;
  /** A grove or nothing: a tree there would hide water. */
  low?: boolean;
}

const GROVES = 12;
const SLOT_SPACING = 2.6;
/** Places open at most at each stage: a few more than the elements to place. */
const OPEN_AT_MOST: PerStage<number> = [6, 6, 7, 9, 11, 13, 15, 17, 19, 21, 22, 22];

const slotCache = new Map<number, SlotDef[]>();

/**
 * The places of a painting, in their opening order: by the first stage that shows them, then
 * nearest the front of the middle ledge. Drawn in the final layout, on ground that stays the
 * same from the stage that shows it, away from the water of every stage.
 */
export function slotsOf(seed: number): readonly SlotDef[] {
  const cached = slotCache.get(seed);
  if (cached) return cached;
  const layout = layoutOf(seed);
  const rng = new Rng(seed).fork('slots');
  const final = outlineOf(LAST_STAGE);
  const last = new Mountain(seed, LAST_STAGE, true, false);
  const candidates: SlotDef[] = [];
  for (let gx = -final.hx; gx <= final.hx; gx += 1.6) {
    for (let gz = final.cz - final.hz; gz <= final.cz + final.hz; gz += 1.6) {
      const x = gx + rng.range(-0.8, 0.8);
      const z = gz + rng.range(-0.8, 0.8);
      if (rimValue(layout, final, x, z) > 0.88) continue;
      const on = standing(layout, x, z);
      if (!on) continue;
      const surface = last.surfaceAt(x, z);
      if (!surface || surface.kind !== 'grass' || surface.slope > 0.25) continue;
      if (!offWater(seed, x, z)) continue;
      const shows = (stage: Stage) =>
        rimValue(layout, outlineOf(stage), x, z) < 0.9 && (!on.ledge || on.ledge.stage <= stage);
      const opens = STAGES.find(shows) ?? LAST_STAGE;
      const front = inFrontOfWater(seed, x, z, on.ledge, surface.y);
      const low = front || !on.ledge || on.ledge.name === 'westLow' || on.ledge.name === 'eastLow';
      candidates.push({
        x,
        z,
        kind: low ? 'grove' : 'tree',
        opens,
        low: front,
      });
    }
  }
  const middle = layout.ledges.middle;
  // Trees before groves at each stage: a tree is the finer reward.
  const order = (s: SlotDef) =>
    s.opens * 1000 +
    (s.kind === 'grove' ? 100 : 0) +
    Math.hypot(s.x - middle.x, s.z - middle.z - middle.rz);
  candidates.sort((a, b) => order(a) - order(b));
  const slots: SlotDef[] = [];
  const room = (c: SlotDef) => slots.every((s) => Math.hypot(s.x - c.x, s.z - c.z) >= SLOT_SPACING);
  for (const spread of [true, false]) {
    for (const c of candidates) {
      if (slots.length === SLOT_COUNT) break;
      if (spread && slots.length >= OPEN_AT_MOST[c.opens]) continue;
      if (slots.includes(c) || !room(c)) continue;
      const groves = slots.filter((s) => s.kind === 'grove').length;
      // The first places may all be groves: the middle ledge is in front of its torrents.
      const many = groves >= GROVES || (slots.length >= 6 && groves > slots.length / 2);
      if (c.kind === 'grove' && many) {
        if (c.low) continue;
        c.kind = 'tree';
      }
      slots.push(c);
    }
  }
  slots.sort((a, b) => order(a) - order(b));
  slotCache.set(seed, slots);
  return slots;
}

/** Where the cable car stands: its bottom station, its pylons, its top station. */
export interface CablewayPlan {
  bottom: [number, number];
  pylons: [number, number][];
  top: [number, number];
}

const cablewayCache = new Map<number, CablewayPlan | null>();

/**
 * The cable car of a seed, in the final layout like the places: its bottom station on the floor
 * beside the pool, a pylon on each ledge its line crosses, its top station under the summit of
 * the great peak. The first candidate whose cabins clear the ground, and the trees of the
 * places by far, at every stage that sells it; null if none does.
 */
export function cablewayOf(seed: number): CablewayPlan | null {
  const cached = cablewayCache.get(seed);
  if (cached !== undefined) return cached;
  const layout = layoutOf(seed);
  const slots = slotsOf(seed);
  const main = layout.peaks.main;
  const top: [number, number] = [main.x, main.z + main.r * TOP_STATION];
  // The ledges and the peaks only rise: the first stage that sells it and the last will do.
  const grounds = [CABLECAR_STAGE, LAST_STAGE].map((s) => new Mountain(seed, s, false, false));
  const radius = MOUNTAIN_BY_STAGE.pool[LAST_STAGE];
  const [px, pz] = [layout.pool.x, layout.pool.z + radius - 0.9];
  const free = (x: number, z: number, room: number) =>
    offWater(seed, x, z) && slots.every((s) => Math.hypot(s.x - x, s.z - z) >= room);
  let plan: CablewayPlan | null = null;
  search: for (const reach of [2.5, 4, 5.5, 7]) {
    // Beside the pool, out of the way of its overflow at the front.
    for (const angle of [80, 100, 60, 120, 40, 140]) {
      for (const side of [layout.mirror, -layout.mirror]) {
        const a = (angle * Math.PI) / 180;
        const bottom: [number, number] = [
          px + side * Math.sin(a) * (radius + reach),
          pz + Math.cos(a) * (radius + reach),
        ];
        const on = standing(layout, ...bottom);
        if (!on || on.ledge || !free(...bottom, 3.2)) continue;
        if (rimValue(layout, outlineOf(CABLECAR_STAGE), ...bottom) > 0.8) continue;
        // A single pylon at most, the first place along the line that does.
        for (const pylons of [[], ...pylonsOn(layout, bottom, top, free).map((p) => [p])]) {
          const candidate = { bottom, pylons, top };
          if (grounds.every((g) => g.clears(candidate, slots))) {
            plan = candidate;
            break search;
          }
        }
      }
    }
  }
  cablewayCache.set(seed, plan);
  return plan;
}

/**
 * Places for a pylon along the line: on the floor before the cliff of the first ledge it
 * climbs onto, then on each ledge near its brink, where they find room.
 */
function pylonsOn(
  layout: Layout,
  [bx, bz]: [number, number],
  [tx, tz]: [number, number],
  free: (x: number, z: number, room: number) => boolean,
): [number, number][] {
  const steps = 100;
  const at = (i: number): [number, number] => [
    bx + ((tx - bx) * i) / steps,
    bz + ((tz - bz) * i) / steps,
  ];
  const on = Array.from(
    { length: steps },
    (_, i) => standing(layout, ...at(i))?.ledge?.name ?? null,
  );
  const pylons: [number, number][] = [];
  // Last free place on the floor, a little before the first cliff.
  const cliff = on.findIndex((name, i) => i > 0 && name !== null);
  for (let i = cliff - 5; i > 3 && cliff > 0; i--) {
    if (on[i] === null && free(...at(i), 2)) {
      pylons.push(at(i));
      break;
    }
  }
  for (const name of ['middle', 'hanging'] as const) {
    const ledge = layout.ledges[name];
    const i = on.findIndex(
      (n, k) => n === name && ledgeDistance(ledge, ...at(k)) < 0.85 && free(...at(k), 2),
    );
    if (i >= 0) pylons.push(at(i));
  }
  return pylons;
}

const forestCache = new Map<number, TreeSpot[]>();
/** Ledge each pine stands on: it shows once that ledge has risen. */
const forestLedges = new WeakMap<TreeSpot, Ledge | null>();

/**
 * Pines (and a few birches) on the ledges and the floor, kept off the places and the water,
 * in planting order. Drawn once in the final painting, so a tree stays from one stage to the
 * next.
 */
function forestOf(seed: number): readonly TreeSpot[] {
  const cached = forestCache.get(seed);
  if (cached) return cached;
  const layout = layoutOf(seed);
  const rng = new Rng(seed).fork('forest');
  const final = outlineOf(LAST_STAGE);
  const last = new Mountain(seed, LAST_STAGE, true, false);
  const placed: { x: number; z: number }[] = [];
  const slots = slotsOf(seed);
  const plan = cablewayOf(seed);
  const cable = plan ? [plan.bottom, ...plan.pylons, plan.top] : null;
  const spots: TreeSpot[] = [];
  for (let attempt = 0; attempt < 4000; attempt++) {
    const x = rng.range(-final.hx, final.hx);
    const z = rng.range(final.cz - final.hz, final.cz + final.hz);
    const rank = rng.next();
    const size = rng.next();
    const broadleaf = rng.chance(0.15);
    if (rimValue(layout, final, x, z) > 0.93) continue;
    if (slots.some((s) => Math.hypot(s.x - x, s.z - z) < 2)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2)) continue;
    // Room under the cable car's line and around its stations, bought or not.
    if (cable && distanceToPath(cable, x, z).distance < 2.4) continue;
    if (cable && [cable[0], cable.at(-1)!].some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 4)) {
      continue;
    }
    const on = standing(layout, x, z);
    if (!on || !offWater(seed, x, z)) continue;
    // The fronts of the low ledges and the grass of the floor stay open pastures for the
    // animals; pines stand on the high ledges, the backs of the low ones and the scree.
    const low = on.ledge?.name === 'westLow' || on.ledge?.name === 'eastLow';
    if (low && z > on.ledge!.z) continue;
    const ground = last.surfaceAt(x, z);
    if (!ground || ground.kind !== (on.ledge ? 'grass' : 'rock') || ground.slope > 0.5) continue;
    if (inFrontOfWater(seed, x, z, on.ledge, ground.y)) continue;
    placed.push({ x, z });
    const spot: TreeSpot = {
      x,
      z,
      role: 'edge',
      rank,
      size: 0.8 + 0.35 * size,
      conifer: !broadleaf,
      family: broadleaf ? 'Birch' : 'Pine',
      detail: z < -6 ? 'far' : 'light',
    };
    // On a low ledge, a pine stands on the scree from the start and rises with its ledge.
    forestLedges.set(spot, low ? null : on.ledge);
    spots.push(spot);
  }
  // The first diorama has a few pines from the start.
  spots
    .filter((s) => rimValue(layout, outlineOf(0), s.x, s.z) < 0.9 && !forestLedges.get(s)?.stage)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 5)
    .forEach((s) => (s.rank! *= 0.2));
  spots.sort((a, b) => a.rank! - b.rank!);
  forestCache.set(seed, spots);
  return spots;
}

interface Outline {
  hx: number;
  hz: number;
  cz: number;
}

function outlineOf(stage: Stage): Outline {
  const r = MOUNTAIN_BY_STAGE;
  return { hx: r.hx[stage], hz: r.hz[stage], cz: r.cz[stage] };
}

function revealAt(column: PerStage<boolean>, stage: Stage): Reveal {
  if (column[stage]) return 'shown';
  return stage < LAST_STAGE && column[stage + 1] ? 'announced' : 'waiting';
}

/** Still water in a hollow: the pool at the foot of the gorge, or a tarn on a ledge. */
interface Basin {
  x: number;
  z: number;
  radius: number;
  level: number;
}

/** What the ground is made of at a point: the floor of the gorge, a ledge or a peak. */
type Owner = { kind: 'floor' } | { kind: 'ledge'; ledge: Ledge } | { kind: 'peak'; peak: Peak };

/**
 * The mountain of the torrents (#136): a high-mountain gorge. Rock ledges rise around the pool
 * at its foot, steep snowy peaks and needles stand behind and beside them; three torrents fall
 * from ledge to ledge, the side ones joining the main stream at their own places (or one
 * ending in a tarn), and the main stream falls into the pool.
 */
class Mountain implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly slots: SlotSpot[] = [];
  readonly announcements: Announcement[] = [];
  readonly dam = null;
  readonly perch = null;
  readonly chain: Reveal = 'waiting';
  readonly staticModels: StaticModel[] = [];
  readonly spinners = [];
  readonly drifters: Drifter[] = [];
  readonly cloudSea = null;
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly crops = [];
  readonly extent: { x: number; z: number };
  readonly cover: number;
  readonly frame: Terrain['frame'];
  readonly shadow: Terrain['shadow'];

  private readonly layout: Layout;
  private readonly outline: Outline;
  private readonly ledges: Ledge[];
  private readonly peaks: Peak[];
  private readonly pool: Basin;
  /** The pool, and the tarn of a side torrent once its ledge has risen. */
  private readonly basins: Basin[];
  private readonly cascade: Reveal;
  private readonly peak: Reveal;
  private readonly cablecar: Reveal;
  cableway: Cableway | null = null;
  private readonly runs: Run[] = [];
  private readonly drops: Drop[] = [];

  constructor(
    private readonly seed: number,
    private readonly stage: Stage,
    /** The child bought the cable car (#154). */
    cablecar: boolean,
    /** Without its scenery, a terrain only answers questions about its ground and water. */
    scenery = true,
  ) {
    const r = MOUNTAIN_BY_STAGE;
    this.layout = layoutOf(seed);
    this.outline = outlineOf(stage);
    this.ledges = Object.values(this.layout.ledges).filter((l) => l.height[stage] > 0);
    this.peaks = Object.values(this.layout.peaks).filter((p) => p.height[stage] > 0);
    this.extent = { x: this.outline.hx, z: this.outline.hz + Math.abs(this.outline.cz) };
    this.cover = r.cover[stage];
    this.shadow = {
      center: [0, 4, this.outline.cz],
      radius: Math.hypot(this.outline.hx, this.outline.hz) * 0.8 + 4,
    };
    this.cascade = revealAt(r.cascade, stage);
    this.peak = revealAt(r.peak, stage);
    if (cablecar) this.cablecar = 'shown';
    else this.cablecar = stage >= CABLECAR_STAGE ? 'announced' : 'waiting';
    // The pool grows away from the middle ledge, so the fall always lands in it.
    const { pool } = this.layout;
    const radius = r.pool[stage];
    const pz = pool.z + radius - 0.9;
    this.pool = { x: pool.x, z: pz, radius, level: this.floor(pool.x, pz) - 0.3 };
    this.basins = [this.pool];
    const { tarn } = this.layout;
    if (tarn && this.layout.ledges[tarn.ledge].height[stage] > 0) {
      const level = this.ground(tarn.x, tarn.z).y - 0.25;
      this.basins.push({ x: tarn.x, z: tarn.z, radius: TARN, level });
    }
    this.torrents();
    this.outflows();
    if (scenery) this.compose();
    this.frame = this.framing();
  }

  /** Points of the water a tree must not hide, [x, z, y]: the torrents and their falls. */
  waterPoints(): [number, number, number][] {
    const points: [number, number, number][] = this.runs.flatMap((run) =>
      run.points.map(([x, z], i): [number, number, number] => [x, z, run.levels[i]]),
    );
    for (const d of this.drops) {
      points.push([d.lip[0], d.lip[2], d.lip[1]], [d.foot[0], d.foot[2], d.foot[1]]);
    }
    for (const b of this.basins.slice(1)) {
      points.push([b.x, b.z, b.level]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        points.push([b.x + Math.cos(a) * b.radius, b.z + Math.sin(a) * b.radius, b.level]);
      }
    }
    return points;
  }

  private rim(x: number, z: number, outline = this.outline): number {
    return rimValue(this.layout, outline, x, z);
  }

  /** Floor of the gorge: rough scree, rising into a bowl around the pool. */
  private floor(x: number, z: number): number {
    const n1 = valueNoise2(this.seed, x / 5 + 40, z / 5 + 40) - 0.5;
    const n2 = valueNoise2(this.seed + 1, x / 2.2 + 40, z / 2.2 + 40) - 0.5;
    const { pool } = this.layout;
    // Scree rises on the sides and at the back; the front of the gorge stays open.
    const bowl = Math.hypot((x - pool.x) / 13, Math.min(0, z - pool.z) / 9);
    return 0.9 * n1 + 0.4 * n2 + 3 * smoothstep(0.55, 1.25, bowl) + 1.5 * smoothstep(2, -12, z);
  }

  private ledgeHeight(l: Ledge, x: number, z: number): number {
    const m = ledgeMask(l, x, z);
    if (m <= 0) return -Infinity;
    const roll = (valueNoise2(this.seed + 4, x / 2.5, z / 2.5) - 0.5) * 0.35;
    // Cliffs are rough: the rock bulges and hollows across them.
    const rough = (valueNoise2(this.seed + 9, x / 1.3, z / 1.3) - 0.5) * 1.6 * 4 * m * (1 - m);
    return (l.height[this.stage] + roll) * m + rough;
  }

  /** The summits risen, highest first: the top point of the ground's grid on each peak. */
  private summits(): [number, number, number][] {
    // The same grid as the ground's: same generator, same outline.
    const { points } = groundGrid(
      new Rng(this.seed).fork('ground'),
      { ...this.outline, power: this.layout.power, wobble: this.layout.wobble },
      CELL,
      (x, z) => this.height(x, z),
    );
    return Object.values(this.layout.peaks)
      .filter((p) => p.height[this.stage] > 0)
      .map((p) => {
        const near = points.filter(([x, , z]) => Math.hypot(x - p.x, z - p.z) < CELL * 1.5);
        const [x, y, z] = near.reduce((best, q) => (q[1] > best[1] ? q : best));
        return [x, y, z] as [number, number, number];
      })
      .sort((a, b) => b[1] - a[1]);
  }

  /**
   * The cable car's supports at this stage, the ropes over the ground of each: the pylons rise
   * as high as their spans need to clear the ground, and the trees of the places by far.
   */
  private supportsOf(plan: CablewayPlan, slots: readonly SlotDef[]): Cableway['supports'] {
    const at = ([x, z]: [number, number], over: number) => {
      const ground = this.height(x, z);
      return { x, y: ground + over, z, ground };
    };
    const supports = [
      at(plan.bottom, ROPE_OVER.bottom),
      ...plan.pylons.map((p) => at(p, ROPE_OVER.pylon)),
      at(plan.top, ROPE_OVER.top),
    ];
    const last = supports.length - 1;
    for (let pass = 0; pass < 4; pass++) {
      for (let k = 0; k < last; k++) {
        const [a, b] = [supports[k], supports[k + 1]];
        // How much higher each end must be for the cabins to clear this span.
        let raiseA = 0;
        let raiseB = 0;
        for (const [t, deficit] of this.deficits(a, b, plan, slots)) {
          if (k === 0) raiseB = Math.max(raiseB, deficit / t);
          else if (k + 1 === last) raiseA = Math.max(raiseA, deficit / (1 - t));
          else [raiseA, raiseB] = [Math.max(raiseA, deficit), Math.max(raiseB, deficit)];
        }
        if (k > 0) supports[k] = { ...a, y: a.y + raiseA };
        if (k + 1 < last) supports[k + 1] = { ...b, y: b.y + raiseB };
      }
    }
    return supports;
  }

  /** Along a span, where its cabins pass too low: [share of the span, height missing]. */
  private deficits(
    a: Cableway['supports'][number],
    b: Cableway['supports'][number],
    plan: CablewayPlan,
    slots: readonly SlotDef[],
  ): [number, number][] {
    const out: [number, number][] = [];
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      // In a station, a cabin is under its roof.
      if ([plan.bottom, plan.top].some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 2)) continue;
      const y = a.y + (b.y - a.y) * t - sagAt(span, t);
      let under = -Infinity;
      for (const [dx, dz] of AROUND_CABIN) under = Math.max(under, this.height(x + dx, z + dz));
      const near = slots.filter((s) => Math.hypot(s.x - x, s.z - z) < 2.2);
      const tree = near.some((s) => s.kind === 'tree') ? 4 : near.length > 0 ? 1.8 : 0;
      const deficit = under + tree + 0.5 + HANG - y;
      if (deficit > 0) out.push([t, deficit + 0.2]);
    }
    return out;
  }

  /** The cabins clear everything with pylons no taller than the tallest. */
  clears(plan: CablewayPlan, slots: readonly SlotDef[]): boolean {
    const supports = this.supportsOf(plan, slots);
    if (
      supports.some((s, i) => i > 0 && i < supports.length - 1 && s.y - s.ground > TALLEST_PYLON)
    ) {
      return false;
    }
    return supports.every(
      (a, k) => k === 0 || this.deficits(supports[k - 1], a, plan, slots).length === 0,
    );
  }

  private peakHeight(p: Peak, x: number, z: number): number {
    const d = peakDistance(p, x, z);
    if (d >= 1) return -Infinity;
    let top = p.height[this.stage];
    // The great peak keeps its last spire for the end.
    if (p.name === 'main' && this.peak === 'shown') top = p.height[LAST_STAGE];
    const rough = (valueNoise2(this.seed + 11, x / 1.2, z / 1.2) - 0.5) * 2.6 * (1 - d);
    return top * Math.pow(1 - d, p.sharp) + rough;
  }

  /** Ground before any water, and what it is made of. */
  private ground(x: number, z: number): { y: number; owner: Owner } {
    let y = this.floor(x, z);
    let owner: Owner = { kind: 'floor' };
    for (const ledge of this.ledges) {
      const h = this.ledgeHeight(ledge, x, z);
      if (h > y) {
        y = h;
        owner = { kind: 'ledge', ledge };
      }
    }
    for (const peak of this.peaks) {
      const h = this.peakHeight(peak, x, z);
      if (h > y) {
        y = h;
        owner = { kind: 'peak', peak };
      }
    }
    return { y, owner };
  }

  private height(x: number, z: number): number {
    let h = this.ground(x, z).y;
    for (const run of this.runs) {
      const [x0, z0, x1, z1] = run.box;
      if (x < x0 || z < z0 || x > x1 || z > z1) continue;
      const q = distanceToPath(run.points, x, z);
      const outer = run.halfWidth + 0.7;
      if (q.distance >= outer) continue;
      const bed = this.levelAlong(run, q.along) - 0.3;
      h = Math.min(h, lerp(bed, h, smoothstep(run.halfWidth * 0.7, outer, q.distance)));
    }
    for (const p of this.basins) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.radius + 1) {
        h = Math.min(h, lerp(p.level - 0.9, h, smoothstep(p.radius - 1.3, p.radius + 1, d)));
      }
    }
    return h;
  }

  /** Water level of the torrents near a point, and how far from their middle. */
  private torrentAt(x: number, z: number): { level: number; distance: number } | null {
    let best: { level: number; distance: number } | null = null;
    for (const run of this.runs) {
      const [x0, z0, x1, z1] = run.box;
      if (x < x0 || z < z0 || x > x1 || z > z1) continue;
      const q = distanceToPath(run.points, x, z);
      if (!best || q.distance < best.distance) {
        best = { level: this.levelAlong(run, q.along), distance: q.distance - run.halfWidth };
      }
    }
    return best;
  }

  /** A run along a ledge, gently bent, at its level. */
  private makeRun(
    from: readonly [number, number],
    to: readonly [number, number],
    halfWidth: number,
  ): { points: [number, number][]; halfWidth: number } {
    const [dx, dz] = direction([from[0], from[1]], [to[0], to[1]]);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const bend = Math.min(0.8, length * 0.12) * (hashSide(from) ? 1 : -1);
    const points: [number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const s = Math.sin(t * Math.PI) * bend;
      points.push([lerp(from[0], to[0], t) - dz * s, lerp(from[1], to[1], t) + dx * s]);
    }
    return { points, halfWidth };
  }

  private addRuns(runs: { points: [number, number][]; halfWidth: number }[]): number {
    // Still water on a ledge, just under its lowest ground.
    const level =
      Math.min(...runs.flatMap((run) => run.points.map(([x, z]) => this.ground(x, z).y))) - 0.08;
    for (const { points, halfWidth } of runs) {
      this.pushRun(
        points,
        points.map(() => level),
        halfWidth,
      );
    }
    return level;
  }

  private pushRun(points: [number, number][], levels: number[], halfWidth: number): void {
    if (points.length < 2) return;
    const along = [0];
    for (let i = 1; i < points.length; i++) {
      along.push(
        along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
      );
    }
    const reach = halfWidth + 1.5;
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    this.runs.push({
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
    });
  }

  private levelAlong(run: Run, along: number): number {
    const i = run.along.findIndex((a) => a >= along);
    if (i <= 0) return run.levels[Math.max(0, i)];
    const t = (along - run.along[i - 1]) / (run.along[i] - run.along[i - 1] || 1);
    return lerp(run.levels[i - 1], run.levels[i], t);
  }

  /** Height of the fall off the island, into the void. */
  private voidDrop(): number {
    return (7 * this.outline.hx) / 20;
  }

  /** Every torrent ends off the island: the basins overflow, and low springs run, to the rim. */
  private outflows(): void {
    const half = MOUNTAIN_BY_STAGE.torrent[this.stage];
    const { outflows, ledges } = this.layout;
    for (const o of outflows) {
      if (o.from === 'pool' || o.from === 'tarn') {
        const b = o.from === 'pool' ? this.pool : this.basins[1];
        if (!b) continue;
        const r = b.radius - 0.3;
        this.flowOff([b.x + o.dir[0] * r, b.z + o.dir[1] * r], b.level, o.dir, half * o.width);
      } else if (ledges[o.from].height[this.stage] > 0) {
        this.flowOff(o.at!, this.ground(...o.at!).y - 0.08, o.dir, half * o.width);
      }
    }
  }

  /**
   * Water from a point down the ground, meandering a little: over each cliff it falls to the
   * foot, on the floor it goes down with it, and at the rim it falls off the island.
   */
  private flowOff(
    start: [number, number],
    level: number,
    [dx, dz]: [number, number],
    half: number,
  ): void {
    const phase = start[0] * 1.7 + start[1];
    const at = (i: number): [number, number] => {
      const s = 0.45 * Math.sin(i * 0.5 + phase) * Math.min(1, i / 3);
      return [start[0] + dx * i - dz * s, start[1] + dz * i + dx * s];
    };
    let points: [number, number][] = [start];
    let levels = [level];
    let water = level;
    for (let i = 0; i < 60;) {
      const p = at(i + 1);
      if (this.rim(p[0], p[1]) >= 1) {
        const q = points.at(-1)!;
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 12; k++) {
          const m = (lo + hi) / 2;
          if (this.rim(lerp(q[0], p[0], m), lerp(q[1], p[1], m)) < 1) lo = m;
          else hi = m;
        }
        const exit: [number, number] = [lerp(q[0], p[0], lo), lerp(q[1], p[1], lo)];
        points.push(exit);
        levels.push(water);
        this.pushRun(points, levels, half);
        this.drops.push({
          lip: [exit[0], water, exit[1]],
          foot: [exit[0] + dx * 1.3, water - this.voidDrop(), exit[1] + dz * 1.3],
          halfWidth: half,
          void: true,
        });
        return;
      }
      const ground = this.ground(p[0], p[1]).y;
      if (ground < water - 1.2) {
        // Over a cliff: the run ends on the brink and the water falls to its foot.
        let j = i + 1;
        while (j < 60) {
          const b = at(j + 1);
          if (this.rim(b[0], b[1]) >= 1) break;
          if (this.ground(...b).y > this.ground(...at(j)).y - 0.3) break;
          j++;
        }
        const foot = at(j);
        const below = this.ground(...foot).y - 0.12;
        const lip = points.at(-1)!;
        this.pushRun(points, levels, half);
        this.drops.push({
          lip: [lip[0], water, lip[1]],
          foot: [foot[0], below, foot[1]],
          halfWidth: half,
        });
        water = below;
        points = [foot];
        levels = [water];
        i = j;
        continue;
      }
      water = Math.min(water, ground - 0.12);
      points.push(p);
      levels.push(water);
      i++;
    }
    this.pushRun(points, levels, half);
  }

  /**
   * Each torrent springs on its highest ledge already risen, runs to its brink and falls to the
   * next. The side torrents join the main stream at their own places down the middle ledge, or
   * one ends in its tarn; the main stream falls into the pool, wider for each torrent it took.
   */
  private torrents(): void {
    const half = MOUNTAIN_BY_STAGE.torrent[this.stage];
    const { torrents, joins, brink, ledges, pool } = this.layout;
    const runs = new Map<LedgeName, { points: [number, number][]; halfWidth: number }[]>();
    const add = (ledge: LedgeName, run: { points: [number, number][]; halfWidth: number }) => {
      runs.set(ledge, [...(runs.get(ledge) ?? []), run]);
    };
    const falls: {
      from: LedgeName;
      lip: [number, number];
      to: LedgeName;
      foot: [number, number];
    }[] = [];
    const joined: number[] = [];
    for (const [t, legs] of torrents.entries()) {
      const risen = legs.filter((leg) => ledges[leg.ledge].height[this.stage] > 0);
      // The middle ledge's own spring until the hanging valley rises; the side torrents wait
      // for the ledges above their last one, but a tarn has its spring from the start.
      if (t > 0 && risen.length < (joins[t] === null ? 1 : 2)) continue;
      if (t > 0 && joins[t] !== null) joined.push(joins[t]!);
      risen.forEach((leg, i) => {
        const next = risen[i + 1];
        if (next) falls.push({ from: leg.ledge, lip: leg.to, to: next.ledge, foot: next.from });
        // The main stream down the middle ledge is cut where the others join it, below.
        if (t === 0 && leg.ledge === 'middle') return;
        add(leg.ledge, this.makeRun(i === 0 ? leg.spring : leg.from, leg.to, half));
      });
    }
    const source = torrents[0].at(-1)!.from;
    const at = (f: number): [number, number] => [
      lerp(source[0], brink[0], f),
      lerp(source[1], brink[1], f),
    ];
    const cuts = [0, ...joined.sort((a, b) => a - b), 1];
    for (let k = 0; k + 1 < cuts.length; k++) {
      add('middle', this.makeRun(at(cuts[k]), at(cuts[k + 1]), half * (1 + 0.18 * k)));
    }
    const levels = new Map<LedgeName, number>();
    for (const [ledge, list] of runs) levels.set(ledge, this.addRuns(list));
    for (const f of falls) {
      this.drops.push({
        lip: [f.lip[0], levels.get(f.from)!, f.lip[1]],
        foot: [f.foot[0], levels.get(f.to)!, f.foot[1]],
        halfWidth: half,
      });
    }
    this.drops.push({
      lip: [brink[0], levels.get('middle')!, brink[1]],
      foot: [pool.x, this.pool.level, pool.z],
      halfWidth: half * (1 + 0.18 * joined.length),
    });
  }

  /** Bare rock on a ledge or on the floor: scree, with a few patches of alpine grass. */
  private bare(x: number, z: number, owner: Owner): boolean {
    if (owner.kind === 'peak') return true;
    const patch = valueNoise2(this.seed + 6, x / 3.2, z / 3.2);
    if (owner.kind === 'ledge') return patch > 0.84;
    // A little alpine grass by the pool only.
    const { pool } = this.layout;
    const near = smoothstep(10, 5, Math.hypot(x - pool.x, z - pool.z));
    return valueNoise2(this.seed + 5, x / 4, z / 4) + 0.45 * near < 0.72;
  }

  private snowy(x: number, z: number, y: number, owner: Owner): boolean {
    if (owner.kind !== 'peak') return false;
    return y > SNOW_LINE + (valueNoise2(this.seed + 7, x / 3, z / 3) - 0.5) * 4;
  }

  surfaceAt(x: number, z: number): Surface | null {
    if (this.rim(x, z) > 0.985) return null;
    const y = this.height(x, z);
    const e = 0.35;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const p = this.basins.find((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 1.2) ?? this.pool;
    const nearPool = Math.hypot(x - p.x, z - p.z) < p.radius + 1.2;
    const torrent = this.torrentAt(x, z);
    let kind: Surface['kind'] = 'grass';
    if (nearPool && y < p.level + 0.03) kind = 'water';
    else if (nearPool && y < p.level + 0.28) kind = 'sand';
    else if (torrent && torrent.distance < 0.9 && y < torrent.level + 0.03) kind = 'water';
    else if (torrent && torrent.distance < 0.9 && y < torrent.level + 0.28) kind = 'sand';
    else if (slope > 0.5 || this.bare(x, z, this.ground(x, z).owner)) kind = 'rock';
    return { y, kind, slope };
  }

  nearLake(): boolean {
    return false;
  }

  private compose(): void {
    // The child's places, strictly in their opening order.
    for (const [index, slot] of slotsOf(this.seed).entries()) {
      if (slot.opens > this.stage) break;
      this.slots.push({
        index,
        x: slot.x,
        z: slot.z,
        kind: slot.kind,
        size: 0.9,
        detail: slot.kind === 'tree' ? 'far' : 'light',
        // Mountain trees: mostly pines, now and then a birch.
        family: index % 4 === 3 ? 'Birch' : 'Pine',
      });
    }

    const { ledges, peaks } = this.layout;
    const main = peaks.main;
    const top = (p: Peak) => this.height(p.x, p.z);
    if (this.cascade === 'announced') {
      const { to } = this.layout.torrents[0][0];
      const y = this.ground(...to).y;
      this.announcements.push({ label: 'cascade', x: to[0], y: y + 1, z: to[1], radius: 3 });
    }
    if (this.peak === 'announced') {
      this.announcements.push({ label: 'peak', x: main.x, y: top(main) + 2, z: main.z, radius: 4 });
    }
    // From their stage, the eagles circle over the great peak and land on the summits in turn.
    if (main.height[this.stage] > 0) {
      const y = main.height[this.stage] + 3;
      if (this.stage >= EAGLES_STAGE) {
        const perches = this.summits();
        this.drifters.push(
          {
            model: 'eagle',
            x: main.x,
            y,
            z: main.z + 5,
            rx: 8,
            rz: 5,
            speed: 0.04,
            scale: 2.2,
            perches,
          },
          {
            model: 'eagle',
            x: main.x - 2,
            y: y + 2.5,
            z: main.z + 3,
            rx: 5.5,
            rz: 3.5,
            speed: -0.055,
            scale: 1.8,
            perches,
          },
        );
      }
    }

    // The cable car once bought, sparkles at its bottom station while it is sold.
    const plan = this.cablecar === 'waiting' ? null : cablewayOf(this.seed);
    if (plan && this.cablecar === 'shown')
      this.cableway = { supports: this.supportsOf(plan, slotsOf(this.seed)) };
    else if (plan) {
      const [x, z] = plan.bottom;
      this.announcements.push({ label: 'cablecar', x, y: this.height(x, z) + 2, z, radius: 3 });
    }

    for (const p of this.basins) {
      const shore: { x: number; z: number }[] = [];
      const n = Math.round(p.radius * 6);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        shore.push({
          x: p.x + Math.cos(a) * (p.radius + 0.3),
          z: p.z + Math.sin(a) * (p.radius + 0.3),
        });
      }
      this.banks.push({ points: shore, halfWidth: 0.2 });
      this.ponds.push({ x: p.x, y: p.level, z: p.z, radius: p.radius - 0.9 });
    }
    for (const run of this.runs) {
      this.banks.push({
        points: run.points.map(([x, z]) => ({ x, z })),
        halfWidth: run.halfWidth + 0.1,
      });
    }
    for (const d of this.drops) {
      this.waterfalls.push({
        top: d.lip,
        foot: d.foot,
        width: d.halfWidth * 2,
        splash: !d.void,
        spray: !d.void && this.cascade === 'shown' && d.lip[1] - d.foot[1] > 3,
      });
    }

    this.rocks(Object.values(ledges));
    for (const spot of forestOf(this.seed).slice(0, MAX_EDGE_TREES)) {
      const surface = this.surfaceAt(spot.x, spot.z);
      if (!surface || surface.kind === 'water' || surface.kind === 'sand') continue;
      if ((forestLedges.get(spot)?.height[this.stage] ?? 1) === 0) continue;
      this.treeSpots.push(spot);
    }
  }

  /** Large rocks: by each fall, and fallen at the foot of the cliffs. */
  private rocks(all: readonly Ledge[]): void {
    const rock = (model: ModelName, x: number, z: number, scale: number, sink: number) => {
      if (this.rim(x, z) > 0.95) return;
      const at = new Rng(this.seed).fork(`rock:${Math.round(x * 10)},${Math.round(z * 10)}`);
      this.staticModels.push({
        model,
        x,
        y: this.height(x, z) - sink,
        z,
        yaw: at.range(0, TAU),
        scale,
      });
    };
    // A few boulders fallen at the foot of each cliff, facing the camera.
    const models: readonly ModelName[] = ['Rock_1_G', 'Rock_3_K', 'Rock_3_M', 'Rock_1_G'];
    const water = waterOf(this.seed).flat();
    const slots = slotsOf(this.seed);
    for (const l of all) {
      const rng = new Rng(this.seed).fork(`boulders:${l.name}`);
      for (let k = 0; k < 2; k++) {
        const theta = rng.range(0.3, Math.PI - 0.3);
        const model = rng.pick(models);
        const scale = rng.range(0.5, 0.85);
        if (l.height[this.stage] === 0) continue;
        const reach = 1 + (CLIFF + 0.5) / Math.min(l.rx, l.rz);
        const x = l.x + Math.cos(theta) * l.rx * reach;
        const z = l.z + Math.sin(theta) * l.rz * reach;
        if (water.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 2.5)) continue;
        if (slots.some((s) => Math.hypot(s.x - x, s.z - z) < 2)) continue;
        if (this.ground(x, z).owner.kind === 'peak') continue;
        rock(model, x, z, scale, 0.35 * scale);
      }
    }
  }

  /** Points the camera keeps in view: the rim, a part of the underside, the peaks. */
  private framing(): Terrain['frame'] {
    const o = this.outline;
    const points: [number, number, number][] = [];
    const n = 28;
    const power = this.layout.power;
    for (let i = 0; i < n; i++) {
      const c = Math.cos((i / n) * TAU);
      const s = Math.sin((i / n) * TAU);
      const k =
        0.97 / Math.pow(Math.pow(Math.abs(c), power) + Math.pow(Math.abs(s), power), 1 / power);
      const x = c * k * o.hx;
      const z = o.cz + s * k * o.hz;
      points.push([x, Math.max(0, this.height(x, z)) + (s < 0.3 ? 2 : 1.5), z]);
      points.push([x, (-2.6 * o.hx) / 20, z]);
    }
    for (const p of this.peaks) {
      if (this.rim(p.x, p.z) > 0.97) continue;
      // Room for the eagles over the great peak once sold: buying them does not move the camera.
      const lift = p.name === 'main' && this.stage >= EAGLES_STAGE ? 6 : 1;
      points.push([p.x, this.peakHeight(p, p.x, p.z) + lift, p.z]);
    }
    return {
      center: [0, 3, o.cz],
      size: [o.hx * 2, 14, o.hz * 2],
      yaw: 0,
      pitch: CAMERA_PITCH,
      points,
    };
  }

  buildGround(out: MeshWriter, season: Season): void {
    const rng = new Rng(this.seed).fork('ground');
    const o = this.outline;
    const { power, wobble } = this.layout;
    const grid = groundGrid(rng, { ...o, power, wobble }, CELL, (x, z) => this.height(x, z));
    const grass = groundSwatch(season);
    const near = (x: number, z: number) =>
      this.basins.find((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 1.2);
    buildDiorama(
      out,
      grid,
      rng,
      o.cz,
      o.hx,
      (cx, cy, cz, slope, jitter) => {
        const { owner } = this.ground(cx, cz);
        // Snow lies on the gentler facets; the steepest rock stays bare.
        const lie = 0.62 + 0.3 * valueNoise2(this.seed + 8, cx / 1.5, cz / 1.5);
        if (this.snowy(cx, cz, cy, owner) && slope < lie) {
          return swatchUV('SnowGround', 0.1 + slope * 0.4 + jitter);
        }
        if (slope > 0.55) return swatchUV('Stone', 0.15 + slope * 0.45 + jitter * 2);
        const p = near(cx, cz);
        if (p && cy < p.level + 0.25) {
          return swatchUV('HexSand', 0.3 + Math.min(0.5, (p.level - cy) * 0.7) + jitter);
        }
        if (slope > 0.3 || this.bare(cx, cz, owner)) {
          return swatchUV('Stone', 0.05 + slope * 0.4 + jitter * 2);
        }
        const patch = valueNoise2(this.seed + 5, cx / 4.5, cz / 4.5) - 0.5;
        // Higher ledges are a paler, drier alpine grass.
        const tone = Math.min(
          1,
          Math.max(0, 0.3 + 0.03 * Math.max(0, cy) + slope * 1.3 + patch * 0.3 + jitter),
        );
        return swatchUV(grass.swatch, lerp(grass.from, grass.to, tone));
      },
      // A mountain stands on a deeper rock.
      o.hx / 15,
    );
  }

  buildWater(out: WaterBuilder): void {
    for (const run of this.runs) {
      const points: RibbonPoint[] = run.points.map(([x, z], i) => {
        const a = run.points[Math.max(0, i - 1)];
        const b = run.points[Math.min(run.points.length - 1, i + 1)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return {
          x,
          y: run.levels[i],
          z,
          sx: -(b[1] - a[1]) / l,
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
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = -0.25 + (reach + 0.25) * Math.pow(t, 0.75);
        points.push({
          x: lx + dx * r,
          y: lerp(top, bottom - 0.05, t * t),
          z: lz + dz * r,
          sx: dz,
          sz: -dx,
          halfWidth: d.halfWidth * (d.void ? lerp(0.9, 0.45, t) : lerp(0.94, 1.2, t)),
          shoreCenter: d.void ? lerp(0.3, 1, t) : i === 0 ? 0.8 : i === steps ? 1 : 0.2,
          shoreEdge: d.void ? lerp(0.6, 1, t) : i === steps ? 1 : 0.55,
          bulge: 0.19 * d.halfWidth * Math.sin(t * Math.PI),
          outX: dx,
          outZ: dz,
        });
      }
      out.ribbon(points, WATER_FALL);
    }
    for (const p of this.basins) {
      const rings = [0.34, 0.68, 1];
      const segments = Math.max(14, Math.round(p.radius * 5));
      const reach = p.radius + 1.1;
      const shore = (x: number, z: number) =>
        1 - Math.min(1, Math.max(0, (p.level - this.height(x, z)) / 0.6));
      const center = out.point(p.x, p.level, p.z, 0, 0, WATER_STILL, 0);
      let previous: number[] = [];
      rings.forEach((ring, r) => {
        const current: number[] = [];
        for (let i = 0; i < segments; i++) {
          const a = (i / segments) * TAU;
          const x = p.x + Math.cos(a) * reach * ring;
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
}

/** Side of the bend of a run, fixed by where it starts. */
function hashSide([x, z]: readonly [number, number]): boolean {
  return Math.sin(x * 12.9898 + z * 78.233) > 0;
}

export function createMountain(
  seed: number,
  stage: Stage,
  rares: readonly RareName[] = [],
): Terrain {
  return new Mountain(seed, stage, rares.includes('cablecar'));
}
