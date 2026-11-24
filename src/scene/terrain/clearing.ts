import { Rng, hashSeed, valueNoise2 } from '../../core/rng';
import type { ModelName } from '../asset-catalog';
import { swatchUV, type SwatchName } from '../atlas';
import {
  LAST_STAGE,
  STAGES,
  rareStage,
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
import { buildDiorama, groundGrid } from './diorama';
import {
  STREAM_END_LEVEL,
  basinAt,
  drawLayout,
  dryness,
  hidesPerch,
  hidesWater,
  inForest,
  lakeCenter,
  pathLength,
  rimValue,
  type Layout,
  type Point,
  type StepDef,
} from './clearing-layout';
import {
  distanceToPath,
  lerp,
  smoothstep,
  spline,
  type Announcement,
  type BankPath,
  type Dam,
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
/** No tree grows above this height. */
const TREE_LINE = 9.5;
/** The camera looks down at the diorama at this angle (degrees), straight from the front. */
const CAMERA_PITCH = 24;
const MAX_EDGE_TREES = 48;

/**
 * Relief of the clearing at a richness stage. Relief is an axis of progress, like light
 * and density: the diorama grows, the mountains rise and their water comes down to the
 * meadow, fall after fall.
 */
interface Relief {
  /** Half extents of the diorama, and centre of its outline on z. */
  hx: number;
  hz: number;
  cz: number;
  /** Heights of the main, east and west summits (0: not risen yet). */
  peaks: readonly [number, number, number];
  /** Height of the ledge of the main fall (0: the pond is a simple spring). */
  ledge: number;
  /** Falls of the main cascade above the ledge (0 to 2). */
  tiers: number;
  /** Falls of the east stream (0: no stream yet, 1 or 2). */
  east: number;
  /** The west brook and its fall. */
  west: boolean;
  /** The lake overflows into the main stream, down to the rim. */
  river: boolean;
  /** Radius of the pond, which becomes a lake. */
  lake: number;
  /** Half width of the main stream. */
  stream: number;
  /** Height of the snow line. */
  snow: number;
  /** Factor on the amounts of vegetation and ambient life. */
  cover: number;
  /** The wolf's ledge is cut in the mountain. */
  perch: boolean;
}

// One value per stage, so each line reads as a progression. Every stage is a little larger
// than the one before, and most bring one new thing: ledge and first fall (2), the lake
// overflows into a stream (3), mountain and second fall (4), east stream and confluence (5),
// snow and the far chain in colour (6), third fall (7), second east fall (8), west brook (9),
// the wolf's ledge (10). A grand moment (far chain) shows its shape before, and sparkles the
// stage before it comes; the beavers' lake comes when the child buys the beavers.
const RELIEF_BY_STAGE = {
  hx: [13.5, 15.5, 17.5, 19, 21, 22.5, 24, 25.5, 27, 28.5, 29.3, 30],
  hz: [10.5, 12, 14.5, 18.5, 20, 21.25, 22.25, 23.5, 24.5, 25.5, 26.3, 27],
  cz: [1, 0.5, -0.5, -3.5, -4, -3.75, -3.75, -4, -4, -4, -4, -4],
  mainPeak: [0, 0, 5, 8, 11, 13, 16, 19, 21, 23, 24.5, 26],
  eastPeak: [0, 0, 0, 0, 0, 4.5, 6.5, 8.5, 11.5, 13, 14.5, 16],
  westPeak: [0, 0, 0, 0, 0, 0, 0, 0, 3.5, 6, 8, 10],
  ledge: [0, 0, 3.2, 4.2, 4.6, 5, 5.2, 5.4, 5.6, 5.8, 5.9, 6],
  tiers: [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2],
  east: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2],
  west: [false, false, false, false, false, false, false, false, false, true, true, true],
  river: [false, false, false, true, true, true, true, true, true, true, true, true],
  lake: [2.4, 2.7, 2.9, 3.1, 3.3, 3.6, 3.8, 4, 4.3, 4.5, 4.8, 5],
  stream: [0.62, 0.7, 0.76, 0.82, 0.88, 0.94, 0.98, 1.02, 1.06, 1.1, 1.13, 1.15],
  snow: [99, 99, 99, 99, 99, 99, 12, 12.5, 12.5, 13, 13.2, 13.5],
  cover: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.08, 1.15, 1.22, 1.3, 1.35, 1.4],
  perch: [false, false, false, false, false, false, false, false, false, false, true, true],
  /** The far chain comes out of the haze, in colour and snowy. */
  chain: [false, false, false, false, false, false, true, true, true, true, true, true],
} satisfies Record<string, PerStage<number> | PerStage<boolean>>;

/** Stage from which the shop sells the beavers, who fill the dry hollow with their lake. */
const BEAVERS_STAGE = rareStage('clearing', 'beavers')!;

/** A grand moment at a stage: there, announced by sparkles the stage before, or waiting. */
function revealAt(column: PerStage<boolean>, stage: Stage): Reveal {
  if (column[stage]) return 'shown';
  return stage < LAST_STAGE && column[stage + 1] ? 'announced' : 'waiting';
}

function reliefOf(stage: Stage): Relief {
  const r = RELIEF_BY_STAGE;
  return {
    hx: r.hx[stage],
    hz: r.hz[stage],
    cz: r.cz[stage],
    peaks: [r.mainPeak[stage], r.eastPeak[stage], r.westPeak[stage]],
    ledge: r.ledge[stage],
    tiers: r.tiers[stage],
    east: r.east[stage],
    west: r.west[stage],
    river: r.river[stage],
    lake: r.lake[stage],
    stream: r.stream[stage],
    snow: r.snow[stage],
    cover: r.cover[stage],
    perch: r.perch[stage],
  };
}
const FINAL = reliefOf(LAST_STAGE);
const FIRST = reliefOf(0);

// Features are placed once in a layout drawn from the seed, and never move: a stage only
// decides which ones are there and how high the relief is.
const layouts = new Map<number, Layout>();
function layoutOf(seed: number): Layout {
  let layout = layouts.get(seed);
  if (!layout) {
    layout = drawLayout(seed, STAGES.map(reliefOf), FINAL);
    layouts.set(seed, layout);
  }
  return layout;
}

/** Layout of a clearing and the radius of its lake at the last stage, for the tests. */
export function clearingLayout(seed: number): { layout: Layout; finalLake: number } {
  return { layout: layoutOf(seed), finalLake: FINAL.lake };
}

interface Step extends StepDef {
  level: number;
}

interface Pool {
  x: number;
  z: number;
  radius: number;
  level: number;
  bed: number;
  /** The bed is flat within this distance of the centre. */
  flat: number;
}

interface Stream {
  path: number[][];
  length: number;
  /** Water level at both ends. */
  from: number;
  to: number;
  halfWidth: number;
  /** A stream on a step keeps to a narrow channel; a meadow stream digs a wide bed. */
  onStep: boolean;
  /** The bed is at full depth within `inner`, and back to the ground at `outer`. */
  inner: number;
  outer: number;
  depth: number;
  /** Distance up to which the ground belongs to the banks (sand, earth). */
  bank: number;
  /** Bounds of everything the stream changes: min x, min z, max x, max z. */
  box: [number, number, number, number];
}

interface Fall {
  lip: [number, number];
  /** Unit direction of the fall, from the lip to the foot. */
  dir: [number, number];
  foot: [number, number];
  top: number;
  bottom: number;
  reach: number;
  halfWidth: number;
}

/** Lake of the grand moment: a dry sandy hollow until it fills, with an islet. */
interface Basin {
  x: number;
  z: number;
  radius: number;
  /** Height of the meadow levelled around it. */
  ground: number;
  /** Water level, just under the meadow around it. */
  level: number;
  filled: boolean;
  islet: Point;
  /** Size factor of the islet and its tree. */
  grow: number;
}

const ISLET_RADIUS = 1.4;

/** Colour of the ground for a season: swatch and usable part of its gradient. */
export function groundSwatch(season: Season): { swatch: SwatchName; from: number; to: number } {
  switch (season) {
    case 'spring':
      return { swatch: 'Spring', from: 0.02, to: 0.4 };
    case 'summer':
      return { swatch: 'Meadow', from: 0.4, to: 1 };
    case 'autumn':
      return { swatch: 'DryGrass', from: 0.04, to: 0.96 };
    case 'winter':
      return { swatch: 'SnowGround', from: 0.02, to: 0.98 };
  }
}

class Clearing implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly slots: SlotSpot[] = [];
  readonly announcements: Announcement[] = [];
  dam: Dam | null = null;
  perch: Terrain['perch'] = null;
  readonly staticModels: StaticModel[] = [];
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly crops = [];
  readonly spinners = [];
  readonly drifters = [];
  readonly cloudSea = null;
  readonly extent: { x: number; z: number };
  readonly cover: number;
  readonly frame: Terrain['frame'];
  readonly shadow: Terrain['shadow'];
  readonly chain: Reveal;

  private readonly relief: Relief;
  private readonly layout: Layout;
  private readonly mirror: number;
  private readonly beavers: Reveal;
  /** Highest first. */
  private readonly steps: Step[] = [];
  private readonly pools: Pool[] = [];
  private readonly streams: Stream[] = [];
  private readonly falls: Fall[] = [];
  /** The main stream, once the lake overflows. */
  private readonly main: Stream | null = null;
  /** Set once the ground around it is known. */
  private readonly basin: Basin | null = null;
  /** The wolf's ledge of the layout, cut from the stage that declares it. */
  private readonly perchDef: StepDef | null;

  constructor(
    private readonly seed: number,
    private readonly stage: Stage,
    /** The child bought the beavers (#46). */
    beavers: boolean,
    /** Without its scenery, a terrain only answers questions about its ground. */
    scenery = true,
  ) {
    const layout = layoutOf(seed);
    this.layout = layout;
    this.mirror = layout.mirror;
    this.chain = revealAt(RELIEF_BY_STAGE.chain, stage);
    // Once sold, the dry hollow sparkles until the child brings the beavers.
    if (beavers) this.beavers = 'shown';
    else this.beavers = stage >= BEAVERS_STAGE ? 'announced' : 'waiting';
    this.perchDef = this.choosePerch();
    const relief = reliefOf(stage);
    this.relief = relief;
    this.extent = { x: relief.hx, z: relief.hz + Math.abs(relief.cz) };
    this.cover = relief.cover;
    this.shadow = {
      center: [0, 2, relief.cz],
      radius: Math.hypot(relief.hx, relief.hz) * 0.8 + 3,
    };
    const lake = layout.lake;
    const [lakeX, lakeZ] = lakeCenter(layout, relief.lake);
    this.pools.push({
      x: lakeX,
      z: lakeZ,
      radius: relief.lake,
      level: lake.level,
      bed: lake.level - 0.8,
      flat: relief.lake - 1.3,
    });
    if (relief.river) {
      this.main = this.stream(layout.mainPath, lake.level, STREAM_END_LEVEL, relief.stream, false);
    }
    this.mainCascade();
    this.steps.sort((a, b) => b.level - a.level);
    const basin = this.placeBasin();
    this.basin = basin;
    this.eastStream(basin);
    this.westBrook();
    this.wolfPerch();
    this.steps.sort((a, b) => b.level - a.level);
    // Last of the pools, so revealing it leaves the others as they are.
    if (basin.filled) {
      this.pools.push({
        x: basin.x,
        z: basin.z,
        radius: basin.radius,
        level: basin.level,
        bed: basin.level - 0.8,
        flat: basin.radius - 1.3,
      });
    }
    if (scenery) this.compose();
    this.frame = this.framing();
  }

  /**
   * The lake moment: its hollow, the meadow levelled around it between the east pool and the
   * mouth of the east stream, and the dam across its outlet once it fills.
   */
  private placeBasin(): Basin {
    const l = this.layout;
    const def = l.basin;
    const { x, z, radius, islet } = basinAt(def, this.stage / LAST_STAGE);
    let sum = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rx = x + Math.cos(a) * (radius + 1);
      const rz = z + Math.sin(a) * (radius + 1);
      sum += this.heightRef(rx, rz);
    }
    const ground = Math.min(l.eastPool.level - 0.05, Math.max(sum / 16, this.mouthLevel() + 0.8));
    const filled = this.beavers === 'shown';
    // The islet and its tree grow with the lake, a little slower.
    const grow = Math.sqrt(radius / def.radius);
    const basin = { x, z, radius, ground, level: ground - 0.25, filled, islet, grow };
    if (filled) {
      const outflow = l.eastPath.slice(l.eastInlet);
      const out = (p: readonly number[]) => Math.hypot(p[0] - x, p[1] - z) > radius + 0.2;
      const i = outflow.findIndex(out);
      const [a, b] = [outflow[i - 1], outflow[i]];
      // Where the outflow crosses the bank.
      let [lo, hi] = [0, 1];
      for (let k = 0; k < 12; k++) {
        const t = (lo + hi) / 2;
        if (out([lerp(a[0], b[0], t), lerp(a[1], b[1], t)])) hi = t;
        else lo = t;
      }
      const m = this.mirror;
      this.dam = {
        x: lerp(a[0], b[0], hi) * m,
        y: ground - 0.8,
        z: lerp(a[1], b[1], hi),
        yaw: Math.atan2((b[0] - a[0]) * m, b[1] - a[1]),
        width: 4.2,
      };
    }
    return basin;
  }

  /** Level of the main stream where the east stream flows into it. */
  private mouthLevel(): number {
    const l = this.layout;
    const mouth = l.eastPath[l.eastPath.length - 1];
    const joint = distanceToPath(l.mainPath, mouth[0], mouth[1]).along / pathLength(l.mainPath);
    return lerp(l.lake.level, STREAM_END_LEVEL, joint);
  }

  /** Inside the dry hollow of the lake moment, before it fills. */
  private inHollow(fx: number, z: number): boolean {
    const b = this.basin;
    return !!b && !b.filled && Math.hypot(fx - b.x, z - b.z) < b.radius - 0.3;
  }

  /** Its banks and its dam, at this stage, whether it is filled or not. */
  nearLake(x: number, z: number): boolean {
    const b = this.basin!;
    return Math.hypot(x * this.mirror - b.x, z - b.z) < b.radius + 3.5;
  }

  /** Ledge above the pond, then up to two more falls up the mountain. */
  private mainCascade(): void {
    const r = this.relief;
    const l = this.layout;
    if (r.ledge <= 0) return;
    const half = 0.8 * r.stream;
    const ledge = this.step(l.ledge, r.ledge);
    const water = ledge.level - 0.32;
    const fall = this.fall(l.ledge, [l.lake.x, l.lake.z], water, l.lake.level, 1.7, half);
    let upper: number[][] = l.ledgeSource;
    if (r.tiers >= 1) {
      const tier = this.step(
        l.tier,
        Math.max(ledge.level + 3.4, this.raw(l.tier.x, l.tier.z, r) + 0.2),
      );
      const tierWater = tier.level - 0.3;
      const tierFall = this.fall(l.tier, l.tierToward, tierWater, water, 1.5, half * 0.72);
      let source: Point = l.tierSource;
      if (r.tiers >= 2) {
        const top = this.step(l.top, Math.max(tier.level + 3, this.raw(l.top.x, l.top.z, r) - 0.4));
        const topWater = top.level - 0.25;
        const topFall = this.fall(
          l.top,
          [l.tier.x, l.tier.z],
          topWater,
          tierWater,
          1.5,
          half * 0.5,
        );
        this.stream(spline([l.topSource, topFall.lip], 2), topWater, topWater, half * 0.5, true);
        source = topFall.foot;
      }
      this.stream(spline([source, tierFall.lip], 3), tierWater, tierWater, half * 0.72, true);
      upper = [tierFall.foot, ...l.ledgeUpper];
    }
    this.stream(spline([...upper, fall.lip], 4), water, water, half, true);
  }

  /**
   * Stream from the east summit, through the lake moment, joining the main stream in the
   * meadow. It crosses the dry hollow in a channel, which the lake covers once it fills:
   * revealing the lake leaves the stream as it is.
   */
  private eastStream(b: Basin): void {
    const r = this.relief;
    const l = this.layout;
    if (r.east === 0 || !this.main) return;
    const half = 0.65 * r.stream;
    const pool = l.eastPool;
    // A wide flat bed: the fall lands in water even with a steep slope behind the pool.
    this.pools.push({
      ...pool,
      bed: pool.level - 0.7,
      flat: pool.radius * 0.75,
    });
    const across = b.level - 0.4;
    this.stream(l.eastPath.slice(0, l.eastInlet + 1), pool.level, across, half, false);
    this.stream(l.eastPath.slice(l.eastInlet), across, this.mouthLevel(), half, false);
    const step = this.step(
      l.eastStep,
      Math.max(pool.level + 3.2, this.raw(l.eastStep.x, l.eastStep.z, r) + 0.2),
    );
    const water = step.level - 0.3;
    const fall = this.fall(l.eastStep, [pool.x, pool.z], water, pool.level, 1.6, half * 0.95);
    let source: Point = l.eastSource;
    if (r.east >= 2) {
      const top = this.step(
        l.eastTop,
        Math.max(step.level + 2.8, this.raw(l.eastTop.x, l.eastTop.z, r)),
      );
      const topWater = top.level - 0.25;
      const topFall = this.fall(
        l.eastTop,
        [l.eastStep.x, l.eastStep.z],
        topWater,
        water,
        1.4,
        half * 0.7,
      );
      this.stream(spline([l.eastTopSource, topFall.lip], 2), topWater, topWater, half * 0.7, true);
      source = topFall.foot;
    }
    this.stream(spline([source, fall.lip], 3), water, water, half * 0.95, true);
  }

  /** Brook from the west shoulder to the lake. */
  private westBrook(): void {
    const r = this.relief;
    const l = this.layout;
    if (!r.west) return;
    const half = 0.5;
    const pool = l.westPool;
    this.pools.push({
      ...pool,
      bed: pool.level - 0.7,
      flat: pool.radius * 0.75,
    });
    this.stream(l.westPath, pool.level, l.lake.level, half, false);
    const step = this.step(
      l.westStep,
      Math.max(pool.level + 2.8, this.raw(l.westStep.x, l.westStep.z, r) + 0.2),
    );
    const water = step.level - 0.3;
    const fall = this.fall(l.westStep, [pool.x, pool.z], water, pool.level, 1.5, half);
    this.stream(spline([l.westSource, fall.lip], 3), water, water, half, true);
  }

  private step(def: StepDef, level: number): Step {
    const step = { ...def, level };
    this.steps.push(step);
    return step;
  }

  /** The wolf's ledge, cut at the height of the mountain at its centre. */
  private wolfPerch(): void {
    const def = this.perchDef;
    if (!this.relief.perch || !def) return;
    const level = this.raw(def.x, def.z, this.relief);
    this.step(def, level);
    this.perch = { x: def.x * this.mirror, y: level, z: def.z, radius: def.radius - def.edge };
  }

  /**
   * First ledge of the layout high on the final mountain (between two ridges it can be low)
   * and seen from the camera over the crags in front of it. The same at every stage.
   */
  private choosePerch(): StepDef | null {
    const rise = Math.tan((CAMERA_PITCH * Math.PI) / 180);
    return (
      this.layout.perches.find((p) => {
        const eye = this.raw(p.x, p.z, FINAL) + 0.6;
        if (eye < 6.6) return false;
        for (let d = p.radius; d < 24; d += 0.5) {
          if (this.raw(p.x, p.z + d, FINAL) > eye + d * rise) return false;
        }
        return true;
      }) ?? null
    );
  }

  private stream(
    path: number[][],
    from: number,
    to: number,
    halfWidth: number,
    onStep: boolean,
  ): Stream {
    // A narrow stream still gets a wide, gentle bed; the water reaches about `halfWidth`.
    const outer = onStep ? halfWidth * 1.53 : Math.max(halfWidth * 2.2, 2);
    const inner = onStep ? halfWidth * 0.47 : Math.max(0, (halfWidth - 0.36 * outer) / 0.64);
    const bank = onStep ? halfWidth * 1.65 : outer + 0.1;
    const box: Stream['box'] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of path) {
      box[0] = Math.min(box[0], p[0] - bank);
      box[1] = Math.min(box[1], p[1] - bank);
      box[2] = Math.max(box[2], p[0] + bank);
      box[3] = Math.max(box[3], p[1] + bank);
    }
    const stream: Stream = {
      path,
      length: pathLength(path),
      from,
      to,
      halfWidth,
      onStep,
      inner,
      outer,
      depth: onStep ? 0.28 : 0.25 + 0.15 * Math.min(1, halfWidth / 1.05),
      bank,
      box,
    };
    this.streams.push(stream);
    return stream;
  }

  /** Fall from the edge of a step towards a point, landing `reach` further. */
  private fall(
    step: StepDef,
    toward: readonly [number, number],
    top: number,
    bottom: number,
    reach: number,
    halfWidth: number,
  ): Fall {
    const dx = toward[0] - step.x;
    const dz = toward[1] - step.z;
    const l = Math.hypot(dx, dz);
    const dir: [number, number] = [dx / l, dz / l];
    const flat = step.radius - step.edge;
    const lip: [number, number] = [step.x + dir[0] * flat, step.z + dir[1] * flat];
    const fall: Fall = {
      lip,
      dir,
      foot: [lip[0] + dir[0] * reach, lip[1] + dir[1] * reach],
      top,
      bottom,
      reach,
      halfWidth,
    };
    this.falls.push(fall);
    return fall;
  }

  /** Random numbers attached to a place of the layout: the same at every stage. */
  private at(fx: number, z: number): Rng {
    return new Rng(hashSeed(this.seed, `${Math.round(fx * 10)}:${Math.round(z * 10)}`));
  }

  /** Outline: 1 on the rim of the diorama, less inside. */
  private rim(fx: number, z: number, relief = this.relief): number {
    return rimValue(this.layout, relief, fx, z);
  }

  /** Height of the mountains alone: pointed summits with ridges running down from them. */
  private mountains(fx: number, z: number, relief: Relief): number {
    let sum = 0;
    const peaks = this.layout.peaks;
    for (let i = 0; i < peaks.length; i++) {
      if (relief.peaks[i] <= 0) continue;
      const peak = peaks[i];
      const height = relief.peaks[i] * peak.scale;
      const dx = fx - peak.x;
      const dz = z - peak.z;
      const d = Math.hypot(dx, dz);
      const radius = peak.radius * Math.sqrt(relief.peaks[i] / FINAL.peaks[i]);
      if (d > radius * 1.4) continue;
      const theta = Math.atan2(dz, dx);
      const ridge =
        1 +
        peak.ridge * Math.sin(peak.lobes * theta + peak.phase) +
        0.1 * Math.sin(7 * theta + peak.phase * 2.3);
      const t = d / (radius * ridge);
      if (t >= 1) continue;
      const h = height * Math.pow(1 - t, peak.sharp);
      sum += h * h;
    }
    return Math.sqrt(sum);
  }

  /** Ground height before any water is dug: rolling meadow and mountains. */
  private raw(fx: number, z: number, relief: Relief): number {
    const l = this.layout;
    const n1 = valueNoise2(this.seed, fx / l.rollScale + 40, z / l.rollScale + 40) - 0.5;
    const n2 = valueNoise2(this.seed + 1, fx / 3.3 + 40, z / 3.3 + 40) - 0.5;
    let h = l.roll * n1 + 0.3 * n2;
    for (const k of l.knolls) {
      h += k.height * smoothstep(k.radius, 0, Math.hypot(fx - k.x, z - k.z));
    }
    h += 1.3 * smoothstep(-3, -12, z);
    h += 0.9 * smoothstep(0.58, 0.95, Math.abs(fx) / relief.hx);
    h -= 0.4 * smoothstep(0.5, 0.95, (z - relief.cz) / relief.hz);
    const mountain = this.mountains(fx, z, relief);
    if (mountain > 0) {
      // Crags: the higher the mountain, the rougher.
      const n3 = valueNoise2(this.seed + 2, fx / 1.7 + 40, z / 1.7 + 40) - 0.5;
      h += mountain + smoothstep(0.8, 5, mountain) * (2.2 * n2 + 1.1 * n3);
    }
    return h;
  }

  private levelOf(stream: Stream, along: number): number {
    return lerp(stream.from, stream.to, Math.min(1, along / stream.length));
  }

  /** Ground height in the reference layout. */
  private heightRef(fx: number, z: number): number {
    let h = this.raw(fx, z, this.relief);
    for (const step of this.steps) {
      const d = Math.hypot(fx - step.x, z - step.z);
      if (d < step.radius) {
        h = lerp(h, step.level, 1 - smoothstep(step.radius - step.edge, step.radius, d));
      }
    }
    // Before the streams, so the east stream cuts its channel across the dry hollow.
    h = this.basinBed(fx, z, h);
    for (const s of this.streams) {
      if (fx < s.box[0] || z < s.box[1] || fx > s.box[2] || z > s.box[3]) continue;
      const q = distanceToPath(s.path, fx, z);
      if (q.distance >= s.outer) continue;
      const bed = this.levelOf(s, q.along) - s.depth;
      h = Math.min(h, lerp(bed, h, smoothstep(s.inner, s.outer, q.distance)));
    }
    for (const pool of this.pools) {
      const d = Math.hypot(fx - pool.x, z - pool.z);
      if (d < pool.radius + 1) {
        h = Math.min(h, lerp(pool.bed, h, smoothstep(pool.flat, pool.radius + 1, d)));
      }
    }
    return this.isletGround(fx, z, h);
  }

  /** The lake moment: a shallow dry bed until it fills, in a levelled meadow. */
  private basinBed(fx: number, z: number, h: number): number {
    const b = this.basin;
    if (!b) return h;
    const d = Math.hypot(fx - b.x, z - b.z);
    if (d >= b.radius + 3) return h;
    // The meadow levels out around it, so the water reaches its banks all around.
    h = lerp(b.ground, h, smoothstep(b.radius + 0.5, b.radius + 3, d));
    return b.filled
      ? Math.min(h, lerp(b.level - 0.8, h, smoothstep(b.radius - 1.3, b.radius + 1, d)))
      : Math.min(h, lerp(b.level - 0.2, h, smoothstep(b.radius - 1.6, b.radius + 1, d)));
  }

  /** The islet rising from the lake moment once it fills. */
  private isletGround(fx: number, z: number, h: number): number {
    const b = this.basin;
    if (!b?.filled) return h;
    const di = Math.hypot(fx - b.islet[0], z - b.islet[1]);
    const reach = ISLET_RADIUS * b.grow;
    if (di >= reach) return h;
    return Math.max(h, b.level + 0.45 - 1.3 * smoothstep(0.5 * b.grow, reach, di));
  }

  /**
   * Level of the water a point at height y belongs to (bed or bank), or -Infinity away
   * from water. Ground far above or below a level is not its bank: cliffs under a step.
   */
  private waterAt(fx: number, z: number, y: number): number {
    let best = -Infinity;
    for (const pool of this.pools) {
      const level = pool.level;
      if (level <= best || y > level + 1.2 || y < level - 2) continue;
      if (Math.hypot(fx - pool.x, z - pool.z) < pool.radius + 1.2) best = level;
    }
    for (const s of this.streams) {
      if (fx < s.box[0] || z < s.box[1] || fx > s.box[2] || z > s.box[3]) continue;
      const q = distanceToPath(s.path, fx, z);
      if (q.distance >= s.bank) continue;
      const level = this.levelOf(s, q.along);
      if (level > best && y < level + 1.2 && y > level - 2) best = level;
    }
    return best;
  }

  surfaceAt(x: number, z: number): Surface | null {
    const fx = x * this.mirror;
    if (this.rim(fx, z) > 0.985) return null;
    const y = this.heightRef(fx, z);
    const e = 0.35;
    const dx = this.heightRef(fx + e, z) - this.heightRef(fx - e, z);
    const dz = this.heightRef(fx, z + e) - this.heightRef(fx, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const level = this.waterAt(fx, z, y);
    let kind: Surface['kind'] = 'grass';
    if (y < level + 0.03) kind = 'water';
    else if (y < level + 0.28 || this.inHollow(fx, z)) kind = 'sand';
    else if (slope > 0.5) kind = 'rock';
    return { y, kind, slope };
  }

  private compose(): void {
    const m = this.mirror;
    const r = this.relief;
    for (const f of this.falls) {
      this.waterfalls.push({
        top: [f.lip[0] * m, f.top, f.lip[1]],
        foot: [f.foot[0] * m, f.bottom, f.foot[1]],
        width: f.halfWidth * 2,
        splash: true,
      });
    }
    const exit = this.streamExit();
    if (exit) {
      this.waterfalls.push({
        top: [exit.x * m, exit.y, exit.z],
        foot: [(exit.x + exit.tx * 1.2) * m, exit.y - this.voidDrop(), exit.z + exit.tz * 1.2],
        width: r.stream * 1.6,
        splash: false,
      });
    }
    this.rocks();

    const inside = (p: number[]) => this.rim(p[0], p[1]) < 0.97;
    for (const s of this.streams) {
      if (s.onStep) continue;
      this.banks.push({
        points: s.path.filter(inside).map((p) => ({ x: p[0] * m, z: p[1] })),
        halfWidth: s.halfWidth + 0.1,
      });
    }
    for (const pool of this.pools) {
      const shore: { x: number; z: number }[] = [];
      const n = Math.round(pool.radius * 6);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        shore.push({
          x: (pool.x + Math.cos(a) * (pool.radius + 0.3)) * m,
          z: pool.z + Math.sin(a) * (pool.radius + 0.3),
        });
      }
      this.banks.push({ points: shore, halfWidth: 0.2 });
      this.ponds.push({ x: pool.x * m, y: pool.level, z: pool.z, radius: pool.radius - 0.9 });
    }
    this.spots();
  }

  /** Large rocks: around each fall, in the pools at their feet, in the meadow. */
  private rocks(): void {
    const m = this.mirror;
    const r = this.relief;
    const l = this.layout;
    const rock = (
      model: ModelName,
      fx: number,
      z: number,
      scale: number,
      sink: number,
      y?: number,
    ) => {
      if (this.rim(fx, z) > 0.95) return;
      this.staticModels.push({
        model,
        x: fx * m,
        y: (y ?? this.heightRef(fx, z)) - sink,
        z,
        yaw: this.at(fx, z).range(0, TAU),
        scale,
      });
    };
    this.falls.forEach((f, i) => {
      const [lx, lz] = f.lip;
      const [dx, dz] = f.dir;
      const px = dz;
      const pz = -dx;
      if (i === 0) {
        // Main fall: a frame of tall rocks that grows with the ledge.
        const k = r.ledge / 5;
        rock('Rock_1_K', lx + px * 2.7 + dx * 0.9, lz + pz * 2.7 + dz * 0.9, 1.3 * k, 0.9);
        rock('Rock_1_M', lx - px * 2.9 + dx * 0.7, lz - pz * 2.9 + dz * 0.7, 1.35 * k, 0.9);
        rock('Rock_1_N', lx + px * 5 + dx * 1.5, lz + pz * 5 + dz * 1.5, k, 0.7);
        rock('Rock_2_G', lx - px * 5.4 + dx * 1.6, lz - pz * 5.4 + dz * 1.6, 0.95 * k, 0.5);
        rock(
          'Rock_1_J',
          l.ledge.x - px * 3.2 - dx * 2.4,
          l.ledge.z - pz * 3.2 - dz * 2.4,
          0.9,
          0.4,
        );
        rock('Rock_1_G', lx + px * 1.5 - dx * 0.4, lz + pz * 1.5 - dz * 0.4, 0.9, 0.35);
        rock('Rock_1_G', lx - px * 1.6 - dx * 0.5, lz - pz * 1.6 - dz * 0.5, 0.8, 0.3);
        const pond = f.bottom;
        rock('Rock_3_K', lx + dx * 1.9 + px * 1.5, lz + dz * 1.9 + pz * 1.5, 0.6, 0, pond - 0.25);
        rock('Rock_3_M', lx + dx * 1.7 - px * 1.7, lz + dz * 1.7 - pz * 1.7, 0.42, 0, pond - 0.2);
      } else if (f.top < 11) {
        const side = f.halfWidth + 0.75;
        rock('Rock_1_G', lx + px * side - dx * 0.2, lz + pz * side - dz * 0.2, 0.9, 0.3);
        rock('Rock_1_G', lx - px * side - dx * 0.3, lz - pz * side - dz * 0.3, 0.75, 0.25);
        const [fx, fz] = f.foot;
        rock('Rock_3_K', fx + px * (side + 0.2), fz + pz * (side + 0.2), 0.45, 0, f.bottom - 0.1);
      }
    });
    if (r.ledge === 0) {
      // The spring: a few rocks behind the pond.
      const { x, z } = l.lake;
      rock('Rock_1_G', x - 1.5, z - r.lake - 0.4, 0.85, 0.3);
      rock('Rock_3_K', x + 0.7, z - r.lake - 0.1, 0.6, 0.15);
      rock('Rock_3_M', x - 2.9, z - r.lake + 0.9, 0.35, 0.1);
    }
    for (const [model, fx, z, scale, sink] of l.rocks) rock(model, fx, z, scale, sink);
  }

  private spots(): void {
    const m = this.mirror;
    const l = this.layout;
    const open = (fx: number, z: number) => {
      if (this.rim(fx, z) > 0.93) return false;
      const kind = this.surfaceAt(fx * m, z)?.kind;
      return kind === 'grass' || kind === 'rock';
    };
    l.hero.forEach(([fx, z, size], slot) => {
      if (!open(fx, z)) return;
      this.treeSpots.push({ x: fx * m, z, role: 'hero', size, slot });
    });
    const b = this.basin!;
    if (b.filled) {
      const [fx, z] = b.islet;
      this.treeSpots.push({ x: fx * m, z, role: 'islet', size: 0.5 * b.grow, detail: 'light' });
    } else if (this.beavers === 'announced' && this.rim(b.x, b.z) < 0.93) {
      const y = this.heightRef(b.x, b.z) + 0.7;
      this.announcements.push({ label: 'lake', x: b.x * m, y, z: b.z, radius: b.radius });
    }
    // The slots open strictly in their order, so a slot open at a stage stays open after.
    for (const [index, { x: fx, z, kind }] of l.slots.entries()) {
      if (!open(fx, z)) break;
      this.slots.push({
        index,
        x: fx * m,
        z,
        kind,
        size: lerp(0.85, 1.05, this.at(fx, z).next()),
        // Seen up close on the first diorama only; the later ones are seen from further away.
        detail: rimValue(l, FIRST, fx, z) < 0.93 ? 'full' : 'light',
      });
    }
    this.forest();
  }

  /**
   * Forest: a horseshoe at the back and on the sides, open to the camera, climbing the
   * lower slopes. Spots are drawn in the final layout and must still be good ground once
   * the mountains are at their highest, so a tree stays in place from one stage to the
   * next; a stage keeps the spots that are on its diorama.
   */
  private forest(): void {
    const rng = new Rng(this.seed).fork('forest');
    const m = this.mirror;
    const l = this.layout;
    // The final diorama with its lake, so that no tree stands where the beavers may flood.
    const final =
      this.stage === LAST_STAGE && this.beavers === 'shown'
        ? this
        : new Clearing(this.seed, LAST_STAGE, true, false);
    const placed = [...l.hero, ...l.slots.map((s) => [s.x, s.z])].map(([x, z]) => ({
      x,
      z,
      r: 3.6,
    }));
    const spots: (TreeSpot & { fx: number })[] = [];
    for (let attempt = 0; attempt < 8000; attempt++) {
      const fx = rng.range(-FINAL.hx, FINAL.hx);
      const z = rng.range(FINAL.cz - FINAL.hz, FINAL.cz + FINAL.hz * 0.78);
      const rank = rng.next();
      const size = rng.next();
      const kind = rng.next();
      if (this.rim(fx, z, FINAL) > 0.93) continue;
      if (!inForest(l, FINAL.hx, fx, z)) continue;
      if (dryness(l, FINAL.lake, fx, z) < 0 || hidesWater(l, FINAL.lake, fx, z)) continue;
      if (this.perchDef && hidesPerch(this.perchDef, fx, z)) continue;
      const deep = z < -9;
      const spacing = deep ? 2.8 : 3.3;
      if (placed.some((p) => Math.hypot(p.x - fx, p.z - z) < (p.r + spacing) / 2)) continue;
      placed.push({ x: fx, z, r: spacing });

      const ground = final.surfaceAt(fx * m, z);
      if (!ground || ground.kind === 'water' || ground.kind === 'sand') continue;
      if (ground.slope > 0.8 || ground.y > TREE_LINE) continue;
      spots.push({
        fx,
        x: fx * m,
        z,
        role: 'edge',
        rank,
        size: deep ? 1.1 + 0.3 * size : 0.95 + 0.3 * size,
        conifer:
          this.mountains(fx, z, FINAL) > 2.5 || kind < (deep ? l.conifers : l.conifers * 0.6),
        detail: deep ? 'far' : 'light',
      });
    }
    // A dense layout keeps its first trees only: the tablet budget holds for every seed.
    spots.sort((a, b) => a.rank! - b.rank!);
    for (const { fx, ...spot } of spots.slice(0, MAX_EDGE_TREES)) {
      if (this.rim(fx, spot.z) > 0.93) continue;
      const surface = this.surfaceAt(spot.x, spot.z);
      if (!surface || surface.kind === 'water' || surface.kind === 'sand') continue;
      this.treeSpots.push(spot);
    }
  }

  /** Points the camera keeps in view: the rim with its trees, a part of the underside, the summits. */
  private framing(): Terrain['frame'] {
    const r = this.relief;
    const m = this.mirror;
    const points: [number, number, number][] = [];
    const n = 28;
    const power = this.layout.power;
    for (let i = 0; i < n; i++) {
      const c = Math.cos((i / n) * TAU);
      const s = Math.sin((i / n) * TAU);
      const k =
        0.97 / Math.pow(Math.pow(Math.abs(c), power) + Math.pow(Math.abs(s), power), 1 / power);
      const fx = c * k * r.hx;
      const z = r.cz + s * k * r.hz;
      // Room for the trees at the back and on the sides.
      points.push([fx * m, Math.max(0, this.heightRef(fx, z)) + (s < 0.3 ? 4.5 : 1.5), z]);
      points.push([fx * m, (-2.6 * r.hx) / 20, z]);
    }
    this.layout.peaks.forEach((peak, i) => {
      if (r.peaks[i] > 0 && this.rim(peak.x, peak.z) < 0.97) {
        points.push([peak.x * m, this.heightRef(peak.x, peak.z) + 1.5, peak.z]);
      }
    });
    // Crowns of the foreground trees, which reach past the rim.
    for (const spot of this.treeSpots) {
      if (spot.role !== 'hero') continue;
      const y = this.heightRef(spot.x * m, spot.z) + 5.5 * spot.size;
      points.push([spot.x - 3.4 * spot.size, y, spot.z], [spot.x + 3.4 * spot.size, y, spot.z]);
    }
    return {
      center: [0, 1.4, r.cz],
      size: [r.hx * 2, 9, r.hz * 2],
      yaw: 0,
      pitch: CAMERA_PITCH,
      points,
    };
  }

  /** Height of the fall of the main stream into the void. */
  private voidDrop(): number {
    return (7 * this.relief.hx) / 20;
  }

  /** Point where the main stream leaves the diorama, with its water level and direction. */
  private streamExit(): { x: number; y: number; z: number; tx: number; tz: number } | null {
    const main = this.main;
    if (!main) return null;
    const path = main.path;
    let along = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
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
          y: this.levelOf(main, along + len * lo) - 0.02,
          z: lerp(a[1], b[1], lo),
          tx: (b[0] - a[0]) / len,
          tz: (b[1] - a[1]) / len,
        };
      }
      along += len;
    }
    const last = path[path.length - 1];
    return { x: last[0], y: STREAM_END_LEVEL, z: last[1], tx: 0, tz: 1 };
  }

  buildGround(out: MeshWriter, season: Season): void {
    const rng = new Rng(this.seed).fork('ground');
    const m = this.mirror;
    const r = this.relief;
    const { power, wobble } = this.layout;
    const outline = { hx: r.hx, hz: r.hz, cz: r.cz, power, wobble };
    const grid = groundGrid(rng, outline, CELL, (fx, z) => this.heightRef(fx, z), m);
    const grass = groundSwatch(season);
    buildDiorama(out, grid, rng, r.cz, r.hx, (cx, cy, cz, slope, jitter) => {
      const fx = cx * m;
      const level = this.waterAt(fx, cz, cy);
      const snowLine = r.snow + 2.4 * (valueNoise2(this.seed + 7, fx / 2.6, cz / 2.6) - 0.5);
      let uv: [number, number];
      if (cy > snowLine && slope < 0.72) {
        // Snow cap: it holds on everything but the steepest faces.
        uv = swatchUV('Snow', Math.min(0.33, 0.04 + slope * 0.36 + jitter));
      } else if (this.inHollow(fx, cz)) {
        // Dry sandy bed of the lake to come, under the snow in winter.
        uv =
          season === 'winter'
            ? swatchUV('SnowGround', 0.75 + slope * 0.4 + jitter)
            : swatchUV('HexSand', 0.3 + slope * 0.6 + jitter);
      } else if (slope > 0.3) {
        // Earth on the banks of the meadow; the mountain stays grey along its falls.
        const earthy = level > -Infinity && cy < level + 1.2 && cy < 3;
        // Rock gets lighter towards the summits.
        const high = smoothstep(6, 16, cy) * 0.14;
        uv = swatchUV(earthy ? 'Earth' : 'Stone', 0.2 + slope * 0.55 + jitter * 2 - high);
      } else if (cy < level + 0.1) {
        uv = swatchUV('HexSand', 0.3 + Math.min(0.5, (level - cy) * 0.7) + jitter);
      } else {
        const patch = valueNoise2(this.seed + 5, fx / 4.5, cz / 4.5) - 0.5;
        // Darker under the forest and on the alpine slopes, lighter on the open meadow.
        const shade =
          smoothstep(-4.5, -9, cz) * 0.2 +
          smoothstep(0.6, 0.8, Math.abs(fx) / FINAL.hx) * 0.12 +
          smoothstep(2.5, 8, cy) * 0.25;
        const tone = Math.min(
          1,
          Math.max(0, 0.3 + this.layout.lush + slope * 1.3 + patch * 0.36 + shade + jitter),
        );
        // Thin snow under the forest and on the bumps: frosty grass shows through.
        const bare = season === 'winter' ? patch + shade * 0.5 - 0.41 : 0;
        uv =
          bare > 0
            ? swatchUV('Snow', 0.41 + Math.min(0.06, bare * 0.5))
            : swatchUV(grass.swatch, lerp(grass.from, grass.to, tone));
      }
      return uv;
    });
  }

  /** Shore value of a point of water: 1 where the bed is at the surface, 0 in deep water. */
  private shore(fx: number, z: number, level: number, range: number): number {
    return 1 - Math.min(1, Math.max(0, (level - this.heightRef(fx, z)) / range));
  }

  /** Ribbon of a stream on a step, or of a tributary down to the water it joins. */
  private ribbon(out: WaterBuilder, s: Stream): void {
    const m = this.mirror;
    const points: RibbonPoint[] = [];
    let along = 0;
    for (let i = 0; i < s.path.length; i++) {
      const p = s.path[i];
      if (i > 0) along += Math.hypot(p[0] - s.path[i - 1][0], p[1] - s.path[i - 1][1]);
      const a = s.path[Math.max(0, i - 1)];
      const b = s.path[Math.min(s.path.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const sx = -(b[1] - a[1]) / l;
      const sz = (b[0] - a[0]) / l;
      const half = s.halfWidth;
      let level = this.levelOf(s, along);
      let shoreCenter = i === 0 ? 0.7 : 0.15;
      let shoreEdge = 0.9;
      if (!s.onStep) {
        // A tributary ends just under the surface of the water it joins.
        level -= 0.02 + 0.03 * smoothstep(s.length - 2.5, s.length, along);
        shoreCenter = this.shore(p[0], p[1], level, 0.42) * 0.6;
        shoreEdge = Math.max(
          this.shore(p[0] + sx * half, p[1] + sz * half, level, 0.3),
          this.shore(p[0] - sx * half, p[1] - sz * half, level, 0.3),
        );
      }
      points.push({
        x: p[0] * m,
        y: level,
        z: p[1],
        sx: sx * m,
        sz,
        halfWidth: half,
        shoreCenter,
        shoreEdge,
      });
    }
    out.ribbon(points, WATER_STREAM);
  }

  /** Sheet of a fall, arcing from the lip to the water below. */
  private sheet(out: WaterBuilder, f: Fall): void {
    const m = this.mirror;
    const [dx, dz] = f.dir;
    const [lx, lz] = f.lip;
    const points: RibbonPoint[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const reach = -0.25 + (f.reach + 0.25) * Math.pow(t, 0.75);
      let shoreCenter = 0.2;
      if (i === 0) shoreCenter = 0.8;
      else if (i === steps) shoreCenter = 1;
      points.push({
        x: (lx + dx * reach) * m,
        y: lerp(f.top, f.bottom - 0.05, t * t),
        z: lz + dz * reach,
        sx: dz * m,
        sz: -dx,
        halfWidth: f.halfWidth * lerp(0.94, 1.12, t),
        shoreCenter,
        shoreEdge: i === steps ? 1 : 0.55,
        bulge: 0.19 * f.halfWidth * Math.sin(t * Math.PI),
        outX: dx * m,
        outZ: dz,
      });
    }
    out.ribbon(points, WATER_FALL);
  }

  /** Still water of a pool: rings around the centre, foam where the water is shallow. */
  private disc(out: WaterBuilder, pool: Pool): void {
    const m = this.mirror;
    const rings = [0.34, 0.68, 1];
    const segments = Math.max(14, Math.round(pool.radius * 5));
    const reach = pool.radius + 1.1;
    const center = out.point(pool.x * m, pool.level, pool.z, 0, 0, WATER_STILL, 0);
    let previous: number[] = [];
    rings.forEach((ring, r) => {
      const current: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * TAU;
        const fx = pool.x + Math.cos(a) * reach * ring;
        const z = pool.z + Math.sin(a) * reach * ring;
        const shore = this.shore(fx, z, pool.level, 0.6);
        current.push(out.point(fx * m, pool.level, z, 0, 0, WATER_STILL, shore));
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
  }

  buildWater(out: WaterBuilder): void {
    const m = this.mirror;
    for (const s of this.streams) if (s !== this.main) this.ribbon(out, s);
    for (const f of this.falls) this.sheet(out, f);
    for (const pool of this.pools) this.disc(out, pool);

    // Main stream, from the pond to the rim of the diorama.
    const main = this.main;
    const exit = this.streamExit();
    if (!main || !exit) return;
    const path = main.path;
    const half = main.halfWidth;
    const lower: RibbonPoint[] = [];
    let along = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (i > 0) along += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]);
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const sx = -(b[1] - a[1]) / l;
      const sz = (b[0] - a[0]) / l;
      const level = this.levelOf(main, along) - 0.02;
      const past = this.rim(p[0], p[1]) >= 1;
      const q = past ? [exit.x, exit.z] : p;
      lower.push({
        x: q[0] * m,
        y: past ? exit.y : level,
        z: q[1],
        sx: sx * m,
        sz,
        halfWidth: half,
        shoreCenter: this.shore(q[0], q[1], level, 0.42) * 0.6,
        shoreEdge: Math.max(
          this.shore(q[0] + sx * half, q[1] + sz * half, level, 0.3),
          this.shore(q[0] - sx * half, q[1] - sz * half, level, 0.3),
        ),
      });
      if (past) break;
    }
    const lowerLength = out.ribbon(lower, WATER_STREAM);

    // The stream falls off the rim and dissolves into foam.
    const last = lower[lower.length - 1];
    const drop: RibbonPoint[] = [];
    const height = this.voidDrop();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const forward = 0.1 + 1.3 * Math.pow(t, 0.7);
      drop.push({
        x: (exit.x + exit.tx * forward) * m,
        y: exit.y - height * t * t,
        z: exit.z + exit.tz * forward,
        sx: last.sx,
        sz: last.sz,
        halfWidth: half * lerp(0.9, 0.48, t),
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

export function createClearing(
  seed: number,
  stage: Stage,
  rares: readonly RareName[] = [],
): Terrain {
  return new Clearing(seed, stage, rares.includes('beavers'));
}
