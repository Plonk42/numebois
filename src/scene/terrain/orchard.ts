import { Rng, valueNoise2 } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import { LAST_STAGE, STAGES, type PerStage, type Stage } from '../description';
import type { MeshWriter } from '../mesh-data';
import {
  WATER_FALL,
  WATER_STILL,
  WATER_STREAM,
  type RibbonPoint,
  type WaterBuilder,
} from '../render/water';
import type { Season } from '../trees/builder';
import type { FamilyName } from '../trees/families';
import { groundSwatch } from './clearing';
import { buildDiorama, groundGrid } from './diorama';
import { rimValue, SLOT_COUNT } from './clearing-layout';
import {
  distanceToPath,
  lerp,
  smoothstep,
  spline,
  type Announcement,
  type BankPath,
  type CropRow,
  type Pond,
  type Reveal,
  type SlotSpot,
  type Spinner,
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
/** Height of a terrace, and the share of its band taken by its wall. */
const STEP = 2.2;
const WALL = 0.35;
const MAX_EDGE_TREES = 20;
const WINDMILL_SCALE = 6.5;
const COTTAGE_SCALE = 3;

// One value per stage. The diorama grows like the clearing; the hills rise terrace by
// terrace out of the meadow (main hill first, the east one at 5, the west one at 9), the
// strips are planted from the middle outwards, the whole orchard blossoms at 6, the
// windmill takes the place of the little house on the summit at 8, fruits come at 10.
const ORCHARD_BY_STAGE = {
  hx: [13.5, 15.5, 17.5, 19, 21, 22.5, 24, 25.5, 27, 28.5, 29.3, 30],
  hz: [10.5, 12, 14.5, 18.5, 20, 21.25, 22.25, 23.5, 24.5, 25.5, 26.3, 27],
  cz: [1, 0.5, -0.5, -3.5, -4, -3.75, -3.75, -4, -4, -4, -4, -4],
  /** Terraces risen out of the meadow, on each hill. */
  main: [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 6],
  east: [0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 4, 4],
  west: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3],
  /** Share of the strips planted, nearest the middle first. */
  planted: [0, 0.04, 0.1, 0.18, 0.28, 0.4, 0.52, 0.64, 0.76, 0.86, 0.94, 1],
  pond: [2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4],
  /** The brook springs by the summit and falls from terrace to terrace down to the pond. */
  brook: [0, 0, 0, 0.42, 0.46, 0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.74],
  cover: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.08, 1.15, 1.22, 1.3, 1.35, 1.4],
  /** A little house on the summit first; the windmill takes its place. */
  cottage: [false, false, false, false, true, true, true, true, false, false, false, false],
  windmill: [false, false, false, false, false, false, false, false, true, true, true, true],
  blossom: [false, false, false, false, false, false, true, true, true, true, true, true],
  fruit: [false, false, false, false, false, false, false, false, false, false, true, true],
} satisfies Record<string, PerStage<number> | PerStage<boolean>>;

const FINAL_HX = ORCHARD_BY_STAGE.hx[LAST_STAGE];

function revealAt(column: PerStage<boolean>, stage: Stage): Reveal {
  if (column[stage]) return 'shown';
  return stage < LAST_STAGE && column[stage + 1] ? 'announced' : 'waiting';
}

interface Outline {
  hx: number;
  hz: number;
  cz: number;
}

function outlineOf(stage: Stage): Outline {
  const r = ORCHARD_BY_STAGE;
  return { hx: r.hx[stage], hz: r.hz[stage], cz: r.cz[stage] };
}

/** A terraced hill: an elliptic cone with a flat top, waved by lobes, cut in bands. */
interface Hill {
  x: number;
  z: number;
  rx: number;
  rz: number;
  /** Bands at full height. */
  levels: number;
  lobes: readonly [number, number, number, number];
}

type StripKind = 'orchard' | 'tulip' | 'lavender' | 'wheat' | 'meadow' | 'forest';

/** A strip: the part of a band of a hill between two angles around it. */
interface Strip {
  hill: number;
  band: number;
  /** Angles around the hill (see `unwrap`), from the front left to the front right. */
  from: number;
  to: number;
  kind: StripKind;
  petal: SwatchName;
  family: FamilyName;
  fruit: SwatchName;
  /** Planting order, nearest the middle of the first diorama first. */
  rank: number;
}

/** Angle around a hill in [-π/2, 3π/2): the front (towards the camera) is 0 to π. */
function unwrap(theta: number): number {
  return theta < -Math.PI / 2 ? theta + TAU : theta;
}

const FRONT: readonly [number, number] = [-0.3, Math.PI + 0.3];
/** Half angle of the front rows of the orchard, around the middle of the front. */
const FRONT_ROWS = 0.5;

interface Layout {
  mirror: number;
  power: number;
  wobble: readonly [number, number, number, number];
  hills: readonly Hill[];
  strips: Strip[];
  pond: { x: number; z: number };
  hero: { x: number; z: number };
  /** Angle of the brook around the main hill where it crosses each band boundary. */
  brook: readonly number[];
}

/** Water running on a terrace or across the meadow: points with their water level. */
interface Run {
  points: readonly (readonly [number, number])[];
  levels: readonly number[];
  /** Distance along the run at each point. */
  along: readonly number[];
  halfWidth: number;
  /** Bounds of what it digs: min x, min z, max x, max z. */
  box: readonly [number, number, number, number];
}

/** Fall over the wall of a terrace. */
interface Drop {
  lip: [number, number, number];
  foot: [number, number, number];
  halfWidth: number;
}

function drawLayout(seed: number): Layout {
  const rng = new Rng(seed).fork('orchard');
  const mirror = rng.chance(0.5) ? 1 : -1;
  const lobes = (): Hill['lobes'] => [
    rng.range(0.03, 0.08),
    rng.range(0, TAU),
    rng.range(0.02, 0.06),
    rng.range(0, TAU),
  ];
  const x0 = rng.range(-6, 6);
  const levels = rng.chance(0.5) ? 6 : 5;
  const big = rng.chance(0.5);
  const hills: Hill[] = [
    {
      x: x0,
      z: rng.range(-13, -11),
      rx: rng.range(22, 28),
      rz: rng.range(16, 19),
      levels,
      lobes: lobes(),
    },
    {
      x: x0 + mirror * rng.range(16, 20),
      z: rng.range(-18, -14),
      rx: big ? 11 : 9,
      rz: big ? 9 : 8,
      levels: big ? 5 : 4,
      lobes: lobes(),
    },
    {
      x: x0 - mirror * rng.range(16, 19),
      z: rng.range(-17, -13),
      rx: 8,
      rz: 7,
      levels: 3,
      lobes: lobes(),
    },
  ];
  // Each painting has its own colours of tulips.
  const tulips = rng.pick([
    ['PetalRed', 'PetalYellow'],
    ['PetalPink', 'PetalRed'],
    ['PetalYellow', 'PetalPink'],
    ['PetalRed', 'PetalPink', 'PetalYellow'],
  ] as const);
  const strips: Strip[] = [];
  const crops: readonly StripKind[] = [
    'orchard',
    'orchard',
    'tulip',
    'tulip',
    'tulip',
    'wheat',
    'lavender',
    'lavender',
  ];
  hills.forEach((hill, h) => {
    for (let band = 0; band < hill.levels; band++) {
      const top = band === hill.levels - 1;
      // Longer bands are cut in more strips.
      const count = top ? 1 : Math.max(2, Math.round((hill.levels - band) * 0.7 + rng.next()));
      const cuts = [FRONT[0], FRONT[1]];
      for (let i = 1; i < count; i++) cuts.push(rng.range(FRONT[0] + 0.3, FRONT[1] - 0.3));
      // The first rows of the orchard, right in front of the camera: the child's first places.
      const orchard = h === 0 && band <= 2;
      const [left, right] = [Math.PI / 2 - FRONT_ROWS, Math.PI / 2 + FRONT_ROWS];
      if (orchard)
        cuts.splice(0, cuts.length, ...cuts.filter((c) => c < left || c > right), left, right);
      cuts.sort((a, b) => a - b);
      let previous: StripKind | null = null;
      for (let i = 0; i + 1 < cuts.length; i++) {
        let kind: StripKind = top && h === 0 ? 'meadow' : rng.pick(crops);
        if (kind === previous) kind = rng.pick(crops.filter((k) => k !== previous));
        if (orchard && cuts[i] === left) kind = 'orchard';
        previous = kind;
        strips.push({
          hill: h,
          band,
          from: cuts[i],
          to: cuts[i + 1],
          kind,
          petal: kind === 'lavender' ? 'PetalViolet' : kind === 'wheat' ? 'Gold' : rng.pick(tulips),
          family: rng.chance(0.75) ? 'Round' : 'Cube',
          fruit: rng.chance(0.65) ? 'PetalRed' : 'PetalYellow',
          rank: 0,
        });
      }
      // Behind the hill, out of sight of the camera: forest, but not around the summit.
      if (band >= hill.levels - 3) continue;
      strips.push({
        hill: h,
        band,
        from: FRONT[1],
        to: FRONT[0] + TAU,
        kind: 'forest',
        petal: 'PetalWhite',
        family: 'Round',
        fruit: 'PetalRed',
        rank: 0,
      });
    }
  });
  const order = strips
    .map((strip, i) => {
      const hill = hills[strip.hill];
      const [x, z] = contour(hill, strip.band + 0.65, (strip.from + strip.to) / 2);
      return { i, d: Math.hypot(x, z - 2) + rng.range(0, 3) };
    })
    .sort((a, b) => a.d - b.d);
  order.forEach(({ i }, rank) => (strips[i].rank = rank / (order.length - 1)));
  const pond = { x: mirror * rng.range(6, 9), z: rng.range(8.5, 9.5) };
  const main = hills[0];
  const toPond = unwrap(Math.atan2((pond.z - main.z) / main.rz, (pond.x - main.x) / main.rx));
  return {
    mirror,
    power: rng.range(2.2, 2.8),
    wobble: [rng.range(0.02, 0.05), rng.range(0, TAU), rng.range(0.01, 0.03), rng.range(0, TAU)],
    hills,
    strips,
    pond,
    hero: { x: -mirror * rng.range(5.5, 8), z: rng.range(6.5, 8.5) },
    // A zigzag down the terraces: the brook runs along each one before it falls.
    brook: Array.from(
      { length: main.levels + 1 },
      (_, b) => toPond + (b % 2 === 0 ? 1 : -1) * rng.range(0.07, 0.13),
    ),
  };
}

function lobeOf(hill: Hill, theta: number): number {
  const [a2, p2, a3, p3] = hill.lobes;
  return 1 + a2 * Math.sin(2 * theta + p2) + a3 * Math.sin(3 * theta + p3);
}

/** Level of a hill at full height (in bands, negative outside), and the angle around it. */
function hillLevel(hill: Hill, x: number, z: number): { level: number; theta: number } {
  const u = (x - hill.x) / hill.rx;
  const v = (z - hill.z) / hill.rz;
  const theta = Math.atan2(v, u);
  const d = Math.hypot(u, v) / lobeOf(hill, theta);
  return { level: (hill.levels * (1 - d)) / 0.85, theta };
}

/** Point of a hill at a level (in bands) and an angle around it. */
function contour(hill: Hill, level: number, theta: number): [number, number] {
  const d = (1 - (0.85 * level) / hill.levels) * lobeOf(hill, theta);
  return [hill.x + d * hill.rx * Math.cos(theta), hill.z + d * hill.rz * Math.sin(theta)];
}

/** Height of a level above the meadow: flat terraces, each above a short wall. */
function terrace(level: number): number {
  if (level <= 0) return 0;
  const k = Math.floor(level);
  return STEP * (k + smoothstep(0, WALL, level - k));
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

/** Points along a level of a hill within a strip, about `spacing` apart. */
function along(hill: Hill, level: number, strip: Strip, spacing: number): [number, number][] {
  const points: [number, number][] = [];
  const [ax, az] = contour(hill, level, strip.from);
  const [bx, bz] = contour(hill, level, (strip.from + strip.to) / 2);
  // Rough length of the arc, from its half.
  const length = 2 * Math.hypot(bx - ax, bz - az) * 1.1;
  const count = Math.max(1, Math.floor(length / spacing));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    points.push(contour(hill, level, lerp(strip.from, strip.to, t)));
  }
  return points;
}

/** Level of the row of trees of a band: the middle of its terrace. */
function rowLevel(band: number): number {
  return band + WALL + (1 - WALL) / 2;
}

const ROW_SPACING = 3.6;

/** Seen from the camera, slightly from above, a tree hides the ground up to this far behind it. */
function hides(water: readonly (readonly [number, number])[], x: number, z: number): boolean {
  return water.some(([wx, wz]) => z > wz && z - wz < 9 && Math.abs(x - wx) < 1.8);
}

const waterCache = new Map<number, [number, number][]>();

/** The brook and its falls at every stage: a tree keeps its place from one to the next. */
function waterOf(seed: number): [number, number][] {
  let water = waterCache.get(seed);
  if (!water) {
    water = STAGES.filter((stage) => ORCHARD_BY_STAGE.brook[stage] > 0).flatMap((stage) =>
      new Orchard(seed, stage, false).waterPoints(),
    );
    waterCache.set(seed, water);
  }
  return water;
}

/** Off the water of every stage, and never in front of it from the camera. */
function awayFromWater(seed: number, x: number, z: number): boolean {
  const water = waterOf(seed);
  const pond = layoutOf(seed).pond;
  const radius = ORCHARD_BY_STAGE.pond[LAST_STAGE];
  return (
    !water.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 2.2) &&
    !hides(water, x, z) &&
    Math.hypot(x - pond.x, z - pond.z) > radius + 2 &&
    !(z > pond.z && z - pond.z < 9 + radius && Math.abs(x - pond.x) < radius + 1.5)
  );
}

/** A place of the child: in a row of the orchard, or a grove in the meadow. */
interface SlotDef {
  x: number;
  z: number;
  kind: 'tree' | 'grove';
  /** Strip of the row it belongs to. */
  strip?: Strip;
  /** First stage whose diorama holds it. */
  opens: Stage;
  /** In the middle of the meadow: a grove only, never a tree. */
  low?: boolean;
}

/** Groves among the slots: about one in four, like the clearing. */
const GROVES = 6;
const SLOT_SPACING = 2.6;
/** Places open at most at each stage: a few more than the elements to place. */
const OPEN_AT_MOST: PerStage<number> = [6, 6, 7, 9, 11, 13, 15, 17, 19, 21, 22, 22];

const slotCache = new Map<number, SlotDef[]>();

/**
 * The places of a painting, in their opening order: by the first stage that shows them, then
 * nearest the middle of the first diorama. Drawn in the final layout, away from the water of
 * every stage and never in front of it, so a place is good whatever is around it.
 */
export function slotsOf(seed: number): readonly SlotDef[] {
  const cached = slotCache.get(seed);
  if (cached) return cached;
  const layout = layoutOf(seed);
  const rng = new Rng(seed).fork('slots');
  const main = layout.hills[0];
  const final = outlineOf(LAST_STAGE);
  const clear = (x: number, z: number) =>
    rimValue(layout, final, x, z) < 0.88 &&
    awayFromWater(seed, x, z) &&
    Math.hypot(x - layout.hero.x, z - layout.hero.z) > 4 &&
    Math.hypot(x - main.x, z - main.z) > 5;
  const opensAt = (x: number, z: number) =>
    STAGES.find((stage) => rimValue(layout, outlineOf(stage), x, z) < 0.9) ?? LAST_STAGE;
  const candidates: SlotDef[] = [];
  for (const strip of layout.strips) {
    if (strip.kind !== 'orchard') continue;
    const hill = layout.hills[strip.hill];
    for (const [x, z] of along(hill, rowLevel(strip.band), strip, ROW_SPACING)) {
      if (clear(x, z)) candidates.push({ x, z, kind: 'tree', strip, opens: opensAt(x, z) });
    }
  }
  // The meadow in front of the hills.
  for (let gx = -final.hx; gx <= final.hx; gx += 2.4) {
    for (let gz = -4; gz <= final.cz + final.hz; gz += 2.4) {
      const x = gx + rng.range(-1, 1);
      const z = gz + rng.range(-1, 1);
      if (layout.hills.some((hill) => hillLevel(hill, x, z).level > -0.4)) continue;
      if (clear(x, z)) {
        const low = Math.abs(x - main.x) < 8;
        candidates.push({ x, z, kind: 'grove', opens: opensAt(x, z), low });
      }
    }
  }
  const order = (s: SlotDef) => s.opens * 1000 + Math.hypot(s.x, s.z - 2);
  candidates.sort((a, b) => order(a) - order(b));
  const slots: SlotDef[] = [];
  const room = (c: SlotDef) => slots.every((s) => Math.hypot(s.x - c.x, s.z - c.z) >= SLOT_SPACING);
  // Not all at once: the places open as the diorama grows; the last ones wherever there is room.
  for (const spread of [true, false]) {
    for (const c of candidates) {
      if (slots.length === SLOT_COUNT) break;
      if (spread && slots.length >= OPEN_AT_MOST[c.opens]) continue;
      if (slots.includes(c) || !room(c)) continue;
      // In the meadow, a grove now and then, a lone fruit tree otherwise; only low groves in
      // the middle, where a tree would hide the terraces.
      const groves = slots.filter((s) => s.kind === 'grove').length;
      if (c.kind === 'grove' && (groves >= GROVES || groves > slots.length / 3)) {
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

/**
 * The orchard on its hills (#31): terraced hills rise out of a meadow, their bands planted
 * with rows of fruit trees, tulips, wheat and lavender; a brook falls from terrace to
 * terrace, a windmill turns on the summit, then the whole orchard blossoms.
 */
class Orchard implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly slots: SlotSpot[] = [];
  readonly announcements: Announcement[] = [];
  readonly dam = null;
  readonly perch = null;
  readonly chain: Reveal = 'waiting';
  readonly staticModels: StaticModel[] = [];
  readonly spinners: Spinner[] = [];
  readonly waterfalls: Waterfall[] = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly crops: CropRow[] = [];
  readonly extent: { x: number; z: number };
  readonly cover: number;
  readonly frame: Terrain['frame'];
  readonly shadow: Terrain['shadow'];

  private readonly layout: Layout;
  private readonly outline: Outline;
  /** Terraces risen on each hill. */
  private readonly risen: readonly number[];
  private readonly pond: { x: number; z: number; radius: number; level: number };
  private readonly windmill: Reveal;
  private readonly blossom: Reveal;
  private readonly runs: Run[] = [];
  private readonly drops: Drop[] = [];

  constructor(
    private readonly seed: number,
    private readonly stage: Stage,
    /** Without its scenery, a terrain only answers questions about its ground and water. */
    scenery = true,
  ) {
    const r = ORCHARD_BY_STAGE;
    this.layout = layoutOf(seed);
    this.outline = outlineOf(stage);
    this.risen = [
      Math.min(this.layout.hills[0].levels, r.main[stage]),
      Math.min(this.layout.hills[1].levels, r.east[stage]),
      r.west[stage],
    ];
    this.extent = { x: this.outline.hx, z: this.outline.hz + Math.abs(this.outline.cz) };
    this.cover = r.cover[stage];
    this.shadow = {
      center: [0, 2, this.outline.cz],
      radius: Math.hypot(this.outline.hx, this.outline.hz) * 0.8 + 3,
    };
    const { x, z } = this.layout.pond;
    const radius = r.pond[stage];
    this.pond = { x, z, radius, level: this.meadow(x, z) - 0.3 };
    this.windmill = revealAt(r.windmill, stage);
    this.blossom = revealAt(r.blossom, stage);
    this.brook();
    if (scenery) this.compose();
    this.frame = this.framing();
  }

  /** Points of the water a tree must not hide: the brook and its falls. */
  waterPoints(): [number, number][] {
    const points: [number, number][] = this.runs.flatMap((run) =>
      run.points.map(([x, z]): [number, number] => [x, z]),
    );
    for (const d of this.drops) points.push([d.lip[0], d.lip[2]], [d.foot[0], d.foot[2]]);
    return points;
  }

  private rim(x: number, z: number, outline = this.outline): number {
    return rimValue(this.layout, outline, x, z);
  }

  /** Rolling meadow under the hills. */
  private meadow(x: number, z: number): number {
    const n1 = valueNoise2(this.seed, x / 7 + 40, z / 7 + 40) - 0.5;
    const n2 = valueNoise2(this.seed + 1, x / 3.1 + 40, z / 3.1 + 40) - 0.5;
    return 0.7 * n1 + 0.25 * n2 + 0.6 * smoothstep(4, -8, z);
  }

  /** Highest risen level at a point: the hill it belongs to, its band and its angle. */
  private levelAt(
    x: number,
    z: number,
  ): { risen: number; hill: number; band: number; angle: number } | null {
    let best: { risen: number; hill: number; band: number; angle: number } | null = null;
    this.layout.hills.forEach((hill, h) => {
      const { level, theta } = hillLevel(hill, x, z);
      if (level < 0) return;
      const risen = level - (hill.levels - this.risen[h]);
      if (best && risen <= best.risen) return;
      best = {
        risen,
        hill: h,
        band: Math.min(hill.levels - 1, Math.floor(level)),
        angle: unwrap(theta),
      };
    });
    return best;
  }

  private stripAt(x: number, z: number): Strip | null {
    const at = this.levelAt(x, z);
    if (!at) return null;
    return (
      this.layout.strips.find(
        (s) =>
          s.hill === at.hill &&
          s.band === at.band &&
          ((at.angle >= s.from && at.angle < s.to) ||
            (at.angle + TAU >= s.from && at.angle + TAU < s.to)),
      ) ?? null
    );
  }

  private planted(strip: Strip | null): boolean {
    const share = ORCHARD_BY_STAGE.planted[this.stage];
    return !!strip && share > 0 && strip.rank <= share;
  }

  /** Ground before any water: rolling meadow, terraces. */
  private ground(x: number, z: number): number {
    const at = this.levelAt(x, z);
    const risen = at?.risen ?? -1;
    // The meadow rolls; the terraces stay almost flat.
    return this.meadow(x, z) * lerp(1, 0.25, smoothstep(-0.3, 0.3, risen)) + terrace(risen);
  }

  private height(x: number, z: number): number {
    let h = this.ground(x, z);
    for (const run of this.runs) {
      const [x0, z0, x1, z1] = run.box;
      if (x < x0 || z < z0 || x > x1 || z > z1) continue;
      const q = distanceToPath(run.points, x, z);
      const outer = run.halfWidth + 0.7;
      if (q.distance >= outer) continue;
      const bed = this.levelAlong(run, q.along) - 0.3;
      h = Math.min(h, lerp(bed, h, smoothstep(run.halfWidth * 0.7, outer, q.distance)));
    }
    const p = this.pond;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.radius + 1) {
      h = Math.min(h, lerp(p.level - 0.8, h, smoothstep(p.radius - 1.3, p.radius + 1, d)));
    }
    return h;
  }

  private levelAlong(run: Run, along: number): number {
    const i = run.along.findIndex((a) => a >= along);
    if (i <= 0) return run.levels[Math.max(0, i)];
    const t = (along - run.along[i - 1]) / (run.along[i] - run.along[i - 1] || 1);
    return lerp(run.levels[i - 1], run.levels[i], t);
  }

  /** Water level of the brook near a point, and how far from its middle. */
  private brookAt(x: number, z: number): { level: number; distance: number } | null {
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

  private makeRun(points: [number, number][], levels: number[], halfWidth: number): Run {
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

  /** From a spring by the summit, along each terrace and over its wall, then to the pond. */
  private brook(): void {
    const half = ORCHARD_BY_STAGE.brook[this.stage];
    if (half === 0) return;
    const main = this.layout.hills[0];
    const angles = this.layout.brook;
    const top = main.levels;
    const first = top - this.risen[0];
    const terraces: Run[] = [];
    for (let b = top - 1; b >= first; b--) {
      const from = b === top - 1 ? top - 0.45 : b + 0.9;
      const to = b + WALL + 0.08;
      const points: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        points.push(contour(main, lerp(from, to, t), lerp(angles[b + 1], angles[b], t)));
      }
      // Still water on a terrace, just under its lowest ground.
      const level = Math.min(...points.map(([x, z]) => this.ground(x, z))) - 0.08;
      terraces.push(
        this.makeRun(
          points,
          points.map(() => level),
          half,
        ),
      );
    }
    // Across the meadow, down to the pond.
    const p = this.pond;
    const start = contour(main, first - 0.2, angles[first]);
    const dx = p.x - start[0];
    const dz = p.z - start[1];
    const length = Math.hypot(dx, dz);
    const end: [number, number] = [
      p.x - (dx / length) * (p.radius - 0.8),
      p.z - (dz / length) * (p.radius - 0.8),
    ];
    const bend = Math.min(2, length * 0.15);
    const control = [
      start,
      [
        lerp(start[0], end[0], 0.5) - (dz / length) * bend,
        lerp(start[1], end[1], 0.5) + (dx / length) * bend,
      ],
      end,
    ];
    const points = spline(control, 5) as [number, number][];
    const levels: number[] = [];
    const from = this.ground(...start) - 0.12;
    points.forEach(([x, z], i) => {
      const t = i / (points.length - 1);
      const level = Math.min(lerp(from, p.level - 0.02, t), this.ground(x, z) - 0.12);
      levels.push(i === 0 ? level : Math.min(levels[i - 1], level));
    });
    const meadow = this.makeRun(points, levels, half);
    const all = [...terraces, meadow];
    for (let i = 0; i + 1 < all.length; i++) {
      const upper = all[i];
      const lower = all[i + 1];
      const [lx, lz] = upper.points.at(-1)!;
      const [fx, fz] = lower.points[0];
      this.drops.push({
        lip: [lx, upper.levels.at(-1)!, lz],
        foot: [fx, lower.levels[0], fz],
        halfWidth: half,
      });
    }
    this.runs.push(...all);
  }

  surfaceAt(x: number, z: number): Surface | null {
    if (this.rim(x, z) > 0.985) return null;
    const y = this.height(x, z);
    const e = 0.35;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const p = this.pond;
    const nearPond = Math.hypot(x - p.x, z - p.z) < p.radius + 1.2;
    const brook = this.brookAt(x, z);
    let kind: Surface['kind'] = 'grass';
    if (nearPond && y < p.level + 0.03) kind = 'water';
    else if (nearPond && y < p.level + 0.28) kind = 'sand';
    else if (brook && brook.distance < 0.9 && y < brook.level + 0.03) kind = 'water';
    else if (brook && brook.distance < 0.9 && y < brook.level + 0.28) kind = 'sand';
    else if (slope > 0.5) kind = 'rock';
    else if (!brook || brook.distance > 1.2) {
      const strip = this.stripAt(x, z);
      const crop = strip?.kind === 'tulip' || strip?.kind === 'lavender' || strip?.kind === 'wheat';
      if (crop && this.planted(strip) && slope < 0.3) kind = 'field';
    }
    return { y, kind, slope };
  }

  nearLake(): boolean {
    return false;
  }

  private compose(): void {
    const { hills, strips, hero } = this.layout;
    const r = ORCHARD_BY_STAGE;
    const blossom = this.blossom === 'shown';
    const fruit = r.fruit[this.stage];
    // Before the blossom, young green leaves; then pink, and fruits on a third of the rows.
    const foliage = (strip?: Strip): { foliage: SwatchName[]; fruit?: SwatchName } => {
      if (fruit && (strip?.band ?? 0) % 3 === 0)
        return { foliage: ['Summer', 'Spring'], fruit: strip?.fruit ?? 'PetalRed' };
      if (blossom) return { foliage: ['Blossom', 'Blossom', 'Blossom', 'Spring'] };
      return { foliage: ['Spring', 'Spring', 'Summer'] };
    };
    const slots = slotsOf(this.seed);

    for (const strip of strips) {
      if (!this.planted(strip)) continue;
      const hill = hills[strip.hill];
      if (strip.kind === 'orchard') {
        // One row of trees along the middle of the terrace, but for the child's places.
        for (const [x, z] of along(hill, rowLevel(strip.band), strip, ROW_SPACING)) {
          if (this.rim(x, z) > 0.93 || !awayFromWater(this.seed, x, z)) continue;
          if (slots.some((s) => Math.hypot(s.x - x, s.z - z) < 1)) continue;
          this.treeSpots.push({
            x,
            z,
            role: 'edge',
            size: 0.8,
            detail: 'far',
            family: strip.family,
            ...foliage(strip),
          });
        }
      } else if (strip.kind === 'tulip' || strip.kind === 'lavender' || strip.kind === 'wheat') {
        for (const k of [0.3, 0.7]) {
          const level = strip.band + WALL + (1 - WALL) * k;
          this.crops.push({
            points: along(hill, level, strip, 0.5).map(([x, z]) => ({ x, z })),
            crop: strip.kind,
            petal: strip.petal,
          });
        }
      }
    }

    // The child's places, strictly in their opening order: trees in the rows, groves in the
    // meadow.
    for (const [index, slot] of slots.entries()) {
      if (slot.opens > this.stage) break;
      this.slots.push({
        index,
        x: slot.x,
        z: slot.z,
        kind: slot.kind,
        size: 0.85,
        detail: slot.kind === 'tree' ? 'far' : 'light',
        family: slot.strip?.family ?? 'Round',
        ...foliage(slot.strip),
      });
    }

    // A large apple tree in the front meadow.
    this.treeSpots.push({
      x: hero.x,
      z: hero.z,
      role: 'hero',
      size: 1.15,
      slot: 0,
      family: 'Gnarly',
      foliage: fruit ? ['Summer', 'Spring'] : blossom ? ['Blossom'] : ['Spring', 'Summer'],
      fruit: fruit ? 'PetalRed' : undefined,
    });

    // The windmill on the summit, announced by sparkles the stage before.
    const main = hills[0];
    const top = { x: main.x, z: main.z + 0.8 };
    if (this.windmill === 'shown') {
      const at = {
        x: top.x,
        y: this.height(top.x, top.z) - 0.05,
        z: top.z,
        yaw: 0.3 * this.layout.mirror,
        scale: WINDMILL_SCALE,
      };
      this.staticModels.push({ model: 'Windmill', ...at });
      this.spinners.push({ model: 'Windmill_Sails', ...at, speed: 0.12 });
    } else if (this.windmill === 'announced') {
      this.announcements.push({
        label: 'windmill',
        x: top.x,
        y: this.height(top.x, top.z) + 1.5,
        z: top.z,
        radius: 2.5,
      });
    }
    if (ORCHARD_BY_STAGE.cottage[this.stage]) {
      this.staticModels.push({
        model: 'Cottage',
        x: top.x,
        y: this.height(top.x, top.z) - 0.05,
        z: top.z,
        yaw: 0.3 * this.layout.mirror,
        scale: COTTAGE_SCALE,
      });
    }
    // The great blossom: sparkles over the front of the orchard the stage before.
    if (this.blossom === 'announced') {
      const [x, z] = contour(main, rowLevel(1), Math.PI / 2);
      this.announcements.push({ label: 'blossom', x, y: this.height(x, z) + 1.5, z, radius: 7 });
    }

    const p = this.pond;
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
    for (const run of this.runs) {
      this.banks.push({
        points: run.points.map(([x, z]) => ({ x, z })),
        halfWidth: run.halfWidth + 0.1,
      });
    }
    for (const d of this.drops) {
      this.waterfalls.push({ top: d.lip, foot: d.foot, width: d.halfWidth * 2, splash: true });
    }

    this.forest();
  }

  /** Forest behind the hills and along the sides, kept off the fields. */
  private forest(): void {
    const rng = new Rng(this.seed).fork('forest');
    const final = outlineOf(LAST_STAGE);
    // Drawn in the final painting, so a tree stays from one stage to the next.
    const last = this.stage === LAST_STAGE ? this : new Orchard(this.seed, LAST_STAGE, false);
    const placed: { x: number; z: number }[] = [this.layout.hero];
    const spots: TreeSpot[] = [];
    for (let attempt = 0; attempt < 4000; attempt++) {
      const x = rng.range(-final.hx, final.hx);
      const z = rng.range(final.cz - final.hz, final.cz + final.hz * 0.6);
      const rank = rng.next();
      const size = rng.next();
      const conifer = rng.chance(0.35);
      if (this.rim(x, z, final) > 0.93) continue;
      const strip = last.stripAt(x, z);
      const side = Math.abs(x) > 0.72 * FINAL_HX && z < 2;
      if (strip ? strip.kind !== 'forest' : !side && z > -6) continue;
      if (Math.hypot(x - this.pond.x, z - this.pond.z) < 6) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      const ground = last.surfaceAt(x, z);
      if (!ground || ground.kind !== 'grass' || ground.slope > 0.45) continue;
      placed.push({ x, z });
      spots.push({
        x,
        z,
        role: 'edge',
        rank,
        size: 0.95 + 0.3 * size,
        conifer,
        family: conifer ? undefined : 'Round',
        detail: z < -14 ? 'far' : 'light',
        // The great blossom reaches the forest around the orchard too.
        foliage:
          !conifer && ORCHARD_BY_STAGE.blossom[this.stage]
            ? ['Blossom', 'Blossom', 'Spring', 'Summer']
            : undefined,
      });
    }
    spots.sort((a, b) => a.rank! - b.rank!);
    for (const spot of spots.slice(0, MAX_EDGE_TREES)) {
      const surface = this.surfaceAt(spot.x, spot.z);
      if (!surface || surface.kind === 'water' || surface.kind === 'sand') continue;
      this.treeSpots.push(spot);
    }
  }

  /** Points the camera keeps in view: the rim, a part of the underside, the summit. */
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
      points.push([x, Math.max(0, this.height(x, z)) + (s < 0.3 ? 4.5 : 1.5), z]);
      points.push([x, (-2.6 * o.hx) / 20, z]);
    }
    const main = this.layout.hills[0];
    if (this.rim(main.x, main.z) < 0.97) {
      const lift = this.windmill === 'shown' ? 1.6 * WINDMILL_SCALE : 1.5;
      points.push([main.x, this.height(main.x, main.z) + lift, main.z]);
    }
    const { hero } = this.layout;
    const y = this.height(hero.x, hero.z) + 5.5 * 1.15;
    points.push([hero.x - 3.4, y, hero.z], [hero.x + 3.4, y, hero.z]);
    return {
      center: [0, 1.4, o.cz],
      size: [o.hx * 2, 9, o.hz * 2],
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
    const winter = season === 'winter';
    const p = this.pond;
    buildDiorama(out, grid, rng, o.cz, o.hx, (cx, cy, cz, slope, jitter) => {
      const nearPond = Math.hypot(cx - p.x, cz - p.z) < p.radius + 1.2;
      let uv: [number, number];
      if (slope > 0.8) {
        // Dry-stone walls where the terraces are steepest, grassy banks elsewhere.
        uv = swatchUV('Stone', 0.2 + slope * 0.4 + jitter * 2);
      } else if (slope > 0.3) {
        uv = swatchUV(grass.swatch, lerp(grass.from, grass.to, 0.75 + jitter));
      } else if (nearPond && cy < p.level + 0.25) {
        uv = swatchUV('HexSand', 0.3 + Math.min(0.5, (p.level - cy) * 0.7) + jitter);
      } else {
        const strip = this.stripAt(cx, cz);
        const kind = this.planted(strip) && !winter ? strip!.kind : 'meadow';
        const patch = valueNoise2(this.seed + 5, cx / 4.5, cz / 4.5) - 0.5;
        const tone = (base: number) =>
          Math.min(1, Math.max(0, base + slope * 1.3 + patch * 0.3 + jitter));
        switch (kind) {
          case 'tulip':
          case 'lavender':
            uv = swatchUV(strip!.petal, tone(0.5));
            break;
          case 'wheat':
            uv = swatchUV('Gold', tone(0.35));
            break;
          case 'orchard':
            uv = swatchUV(grass.swatch, lerp(grass.from, grass.to, tone(0.55)));
            break;
          case 'forest':
            uv = swatchUV(grass.swatch, lerp(grass.from, grass.to, tone(0.65)));
            break;
          default:
            uv = swatchUV(grass.swatch, lerp(grass.from, grass.to, tone(0.3)));
        }
      }
      return uv;
    });
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
      const steps = 7;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = -0.25 + (reach + 0.25) * Math.pow(t, 0.75);
        points.push({
          x: lx + dx * r,
          y: lerp(top, bottom - 0.05, t * t),
          z: lz + dz * r,
          sx: dz,
          sz: -dx,
          halfWidth: d.halfWidth * lerp(0.94, 1.12, t),
          shoreCenter: i === 0 ? 0.8 : i === steps ? 1 : 0.2,
          shoreEdge: i === steps ? 1 : 0.55,
          bulge: 0.19 * d.halfWidth * Math.sin(t * Math.PI),
          outX: dx,
          outZ: dz,
        });
      }
      out.ribbon(points, WATER_FALL);
    }
    const p = this.pond;
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

export function createOrchard(seed: number, stage: Stage): Terrain {
  return new Orchard(seed, stage);
}
