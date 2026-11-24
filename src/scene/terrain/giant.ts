import { hashSeed, Rng, valueNoise2 } from '../../core/rng';
import { swatchUV, type SwatchName } from '../atlas';
import { LAST_STAGE, STAGES, type PerStage, type Stage } from '../description';
import type { MeshWriter } from '../mesh-data';
import { WATER_STILL, type WaterBuilder } from '../render/water';
import type { Season } from '../trees/builder';
import { giantShape, trunkAt, type GiantShape } from '../trees/giant';
import { groundSwatch } from './clearing';
import { rimValue, SLOT_COUNT } from './clearing-layout';
import { buildDiorama, groundGrid } from './diorama';
import {
  cabin,
  deck,
  flag,
  garland,
  ladder,
  lantern,
  nestingBox,
  railing,
  spiralStair,
  swing,
  type P3,
} from './treehouse';
import {
  lerp,
  smoothstep,
  type Announcement,
  type BankPath,
  type Pond,
  type Reveal,
  type SlotSpot,
  type Surface,
  type Terrain,
  type TreeSpot,
} from './types';

const TAU = Math.PI * 2;
/** Size of a ground facet. */
const CELL = 0.72;
/** The camera looks down at the diorama at this angle (degrees), straight from the front. */
const CAMERA_PITCH = 24;
const MAX_EDGE_TREES = 26;
/** Towards the camera, in the ground plane. */
const FRONT = Math.PI / 2;

// One value per stage. The great tree grows from a sprout to a colossus (full size at 10); the
// spring at its foot (2), its first deck and ladder (4), a spiral stair up the trunk (5),
// Plume's cabin (6), the swing (7), nesting boxes (8), the lookout (9), and the lanterns lit
// at dusk (11).
const GIANT_BY_STAGE = {
  hx: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 22.5],
  hz: [10, 10.8, 11.6, 12.4, 13.2, 14, 14.8, 15.4, 16, 16.6, 17.2, 17.6],
  cz: [0, 0, -0.3, -0.6, -0.9, -1.2, -1.5, -1.8, -2.1, -2.4, -2.7, -3],
  growth: [0, 0.1, 0.2, 0.3, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 1, 1],
  pond: [0, 0, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.3],
  cover: [0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.98, 1.05, 1.12, 1.2, 1.28, 1.35],
  ladder: [false, false, false, false, true, true, true, true, true, true, true, true],
  stair: [false, false, false, false, false, true, true, true, true, true, true, true],
  cabin: [false, false, false, false, false, false, true, true, true, true, true, true],
  swing: [false, false, false, false, false, false, false, true, true, true, true, true],
  nests: [false, false, false, false, false, false, false, false, true, true, true, true],
  lookout: [false, false, false, false, false, false, false, false, false, true, true, true],
  lanterns: [false, false, false, false, false, false, false, false, false, false, false, true],
} satisfies Record<string, PerStage<number> | PerStage<boolean>>;

/** Heights of the decks, as shares of the trunk: they rise with the tree. */
const DECKS = { low: 0.18, cabin: 0.37, lookout: 0.54 } as const;

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
  const r = GIANT_BY_STAGE;
  return { hx: r.hx[stage], hz: r.hz[stage], cz: r.cz[stage] };
}

interface Layout {
  power: number;
  wobble: readonly [number, number, number, number];
  /** Foot of the great tree. */
  tree: { x: number; z: number };
  /** Seed of the great tree. */
  giant: number;
  /** Side of the ladder and the stair (the cabin is on the other): +1 or -1. */
  side: number;
  pond: { x: number; z: number };
  /** Meadows kept free for the animals. */
  meadows: readonly { x: number; z: number }[];
  /** Colour of the roof of Plume's cabin. */
  roof: SwatchName;
}

function drawLayout(seed: number): Layout {
  const rng = new Rng(seed).fork('giant');
  const side = rng.chance(0.5) ? 1 : -1;
  const tree = { x: rng.range(-2.5, 2.5), z: rng.range(-3.5, -2) };
  // The spring is in front of the tree, on the cabin's side, beyond the roots.
  const phi = rng.range(0.35, 0.75);
  const pond = {
    x: tree.x - side * Math.cos(phi) * 10.5,
    z: tree.z + Math.sin(phi) * 10.5,
  };
  const meadows = [
    { x: tree.x + side * rng.range(8, 10), z: tree.z + rng.range(7, 9) },
    { x: tree.x - side * rng.range(11, 13), z: tree.z - rng.range(1, 4) },
  ];
  return {
    power: rng.range(2.1, 2.5),
    wobble: [rng.range(0.02, 0.05), rng.range(0, TAU), rng.range(0.01, 0.03), rng.range(0, TAU)],
    tree,
    giant: hashSeed(seed, 'giant'),
    side,
    pond,
    meadows,
    roof: rng.pick(['PetalRed', 'PetalBlue', 'PetalViolet', 'Orange'] as const),
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

/** The wooden pieces of a stage, from the tree's foot (world positions). */
export interface Treehouse {
  foot: P3;
  shape: GiantShape;
  low: { y: number; inner: number; outer: number } | null;
  ladder: { foot: P3; top: P3; angle: number } | null;
  stair: { from: number; to: number; angle: number; turn: number } | null;
  cabinDeck: { y: number; inner: number; outer: number } | null;
  cabin: { foot: P3; facing: number; size: number; angle: number; reach: number } | null;
  swing: { branch: P3; seatY: number; facing: number } | null;
  nests: { at: P3; facing: number; roof: SwatchName }[];
  lookout: {
    y: number;
    inner: number;
    outer: number;
    /** Arc of the deck, angles in the ground plane. */
    from: number;
    to: number;
    ladder: { foot: P3; top: P3 };
  } | null;
  lanterns: { at: P3; colour: SwatchName }[];
}

/** A place of the child: a tree or a grove on the meadow around the great tree. */
interface SlotDef {
  x: number;
  z: number;
  kind: 'tree' | 'grove';
  /** First stage whose diorama holds it. */
  opens: Stage;
  /** In front of the great tree: a grove only, never a tree. */
  low: boolean;
}

/** Groves among the slots: about one in four, like the clearing. */
const GROVES = 6;
const SLOT_SPACING = 2.6;
/** Places open at most at each stage: a few more than the elements to place. */
const OPEN_AT_MOST: PerStage<number> = [6, 6, 7, 9, 11, 13, 15, 17, 19, 21, 22, 22];

const slotCache = new Map<number, SlotDef[]>();
const swingCache = new Map<number, { x: number; z: number }[]>();

/** Where the seat of the swing hangs at every stage that has it: no slot under it. */
function swingSeats(seed: number): { x: number; z: number }[] {
  let seats = swingCache.get(seed);
  if (!seats) {
    seats = STAGES.filter((stage) => GIANT_BY_STAGE.swing[stage]).flatMap((stage) => {
      const seat = new GiantTree(seed, stage, false).treehouse.swing;
      return seat ? [{ x: seat.branch[0], z: seat.branch[2] }] : [];
    });
    swingCache.set(seed, seats);
  }
  return seats;
}

/**
 * The places of a painting, in their opening order: by the first stage that shows them, then
 * nearest the middle of the first diorama. Drawn in the final layout, off the roots, the
 * spring, the meadows and the swing, never in front of the spring, and only low groves right
 * in front of the great tree, so a place is good whatever is around it.
 */
export function slotsOf(seed: number): readonly SlotDef[] {
  const cached = slotCache.get(seed);
  if (cached) return cached;
  const layout = layoutOf(seed);
  const rng = new Rng(seed).fork('slots');
  const final = outlineOf(LAST_STAGE);
  const { tree, pond } = layout;
  const radius = GIANT_BY_STAGE.pond[LAST_STAGE];
  const seats = swingSeats(seed);
  const clear = (x: number, z: number) =>
    rimValue(layout, final, x, z) < 0.86 &&
    Math.hypot(x - tree.x, z - tree.z) > 7.5 &&
    !(z < tree.z && Math.abs(x - tree.x) < 3.5) &&
    Math.hypot(x - pond.x, z - pond.z) > radius + 2 &&
    !(z > pond.z && z - pond.z < 9 + radius && Math.abs(x - pond.x) < radius + 1.5) &&
    layout.meadows.every((m) => Math.hypot(x - m.x, z - m.z) > 3.5) &&
    seats.every((s) => Math.hypot(x - s.x, z - s.z) > 2.2);
  const opensAt = (x: number, z: number) =>
    STAGES.find((stage) => rimValue(layout, outlineOf(stage), x, z) < 0.9) ?? LAST_STAGE;
  const candidates: SlotDef[] = [];
  for (let gx = -final.hx; gx <= final.hx; gx += 2.4) {
    for (let gz = final.cz - final.hz; gz <= final.cz + final.hz; gz += 2.4) {
      const x = gx + rng.range(-1, 1);
      const z = gz + rng.range(-1, 1);
      if (!clear(x, z)) continue;
      const low = z > tree.z && Math.abs(x - tree.x) < 5;
      candidates.push({ x, z, kind: low ? 'grove' : 'tree', opens: opensAt(x, z), low });
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
      // A grove now and then; the low ones only where a tree would hide the great tree.
      const groves = slots.filter((s) => s.kind === 'grove').length;
      if (c.low && groves >= GROVES) continue;
      if (!c.low && groves < GROVES && groves <= slots.length / 4 && rng.chance(0.25)) {
        c.kind = 'grove';
      }
      slots.push(c);
    }
  }
  slots.sort((a, b) => order(a) - order(b));
  slotCache.set(seed, slots);
  return slots;
}

/**
 * The great tree of Plume (#92): a giant tree on a knoll in the middle of a forest meadow
 * grows from a sprout to a colossus; decks, ladders, a stair, Plume's cabin, a swing and
 * nesting boxes come in its branches, and lanterns light up at dusk.
 */
export class GiantTree implements Terrain {
  readonly treeSpots: TreeSpot[] = [];
  readonly slots: SlotSpot[] = [];
  readonly announcements: Announcement[] = [];
  readonly dam = null;
  readonly perch = null;
  readonly chain: Reveal = 'waiting';
  readonly staticModels = [];
  readonly spinners = [];
  readonly drifters = [];
  readonly cloudSea = null;
  readonly waterfalls = [];
  readonly banks: BankPath[] = [];
  readonly ponds: Pond[] = [];
  readonly crops = [];
  readonly lanterns: { x: number; y: number; z: number }[] = [];
  readonly canopy: Terrain['canopy'];
  readonly extent: { x: number; z: number };
  readonly cover: number;
  readonly frame: Terrain['frame'];
  readonly shadow: Terrain['shadow'];
  readonly treehouse: Treehouse;

  private readonly layout: Layout;
  private readonly outline: Outline;
  private readonly pond: { x: number; z: number; radius: number; level: number } | null;

  constructor(
    private readonly seed: number,
    private readonly stage: Stage,
    /** Without its scenery, a terrain only answers questions about its ground and tree. */
    scenery = true,
  ) {
    const r = GIANT_BY_STAGE;
    this.layout = layoutOf(seed);
    this.outline = outlineOf(stage);
    this.extent = { x: this.outline.hx, z: this.outline.hz + Math.abs(this.outline.cz) };
    this.cover = r.cover[stage];
    const radius = r.pond[stage];
    const { x, z } = this.layout.pond;
    this.pond = radius > 0 ? { x, z, radius, level: this.meadow(x, z) - 0.3 } : null;
    this.treehouse = this.plan();
    const { foot, shape } = this.treehouse;
    this.canopy = {
      x: foot[0],
      y: foot[1] + shape.height * 0.72,
      z: foot[2],
      radius: this.crownReach(shape),
      trunk: shape.trunk[1].r,
    };
    this.shadow = {
      center: [0, foot[1] + shape.height * 0.4, this.outline.cz],
      radius: Math.hypot(this.outline.hx, this.outline.hz) * 0.8 + 3,
    };
    if (scenery) this.compose();
    this.frame = this.framing();
  }

  private rim(x: number, z: number, outline = this.outline): number {
    return rimValue(this.layout, outline, x, z);
  }

  /** Rolling meadow, rising gently to the back. */
  private meadow(x: number, z: number): number {
    const n1 = valueNoise2(this.seed, x / 7 + 40, z / 7 + 40) - 0.5;
    const n2 = valueNoise2(this.seed + 1, x / 3.1 + 40, z / 3.1 + 40) - 0.5;
    const { tree } = this.layout;
    // Calm on the knoll, so the great tree stands level.
    const calm = smoothstep(3, 8, Math.hypot(x - tree.x, z - tree.z));
    return (0.7 * n1 + 0.25 * n2) * calm + 0.6 * smoothstep(4, -12, z);
  }

  private height(x: number, z: number): number {
    const { tree } = this.layout;
    const d = Math.hypot(x - tree.x, z - tree.z);
    let h = this.meadow(x, z) + 1.1 * (1 - smoothstep(4.5, 12, d));
    const p = this.pond;
    if (p) {
      const dp = Math.hypot(x - p.x, z - p.z);
      if (dp < p.radius + 1) {
        h = Math.min(h, lerp(p.level - 0.8, h, smoothstep(p.radius - 1.3, p.radius + 1, dp)));
      }
    }
    return h;
  }

  surfaceAt(x: number, z: number): Surface | null {
    if (this.rim(x, z) > 0.985) return null;
    const y = this.height(x, z);
    const e = 0.35;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) / 1.6);
    const p = this.pond;
    const near = p && Math.hypot(x - p.x, z - p.z) < p.radius + 1.2;
    let kind: Surface['kind'] = 'grass';
    if (near && y < p.level + 0.03) kind = 'water';
    else if (near && y < p.level + 0.28) kind = 'sand';
    else if (slope > 0.5) kind = 'rock';
    return { y, kind, slope };
  }

  nearLake(): boolean {
    return false;
  }

  /** Farthest reach of the crown from the trunk. */
  private crownReach(shape: GiantShape): number {
    const sk = shape.skeleton;
    let reach = 0;
    for (let i = 0; i < sk.count; i++) {
      if (!sk.root[i]) reach = Math.max(reach, Math.hypot(sk.x[i], sk.z[i]));
    }
    return reach + shape.clump * 0.6;
  }

  /** Where the decks, ladders and the rest go at this stage. */
  private plan(): Treehouse {
    const r = GIANT_BY_STAGE;
    const stage = this.stage;
    const { tree, giant, side } = this.layout;
    const shape = giantShape(giant, r.growth[stage]);
    const ground = this.surfaceAt(tree.x, tree.z)!;
    // As the forest plants it (`plantTrees`): the foot a little in the ground.
    const foot: P3 = [tree.x, ground.y - 0.05 - 0.4 * ground.slope, tree.z];
    const h = shape.height;
    const axis = (y: number) => {
      const t = trunkAt(shape, y - foot[1]);
      return { x: foot[0] + t.x, z: foot[2] + t.z, r: t.r };
    };
    const around = (y: number, angle: number, reach: number): P3 => {
      const a = axis(y);
      return [a.x + Math.cos(angle) * reach, y, a.z + Math.sin(angle) * reach];
    };
    const house: Treehouse = {
      foot,
      shape,
      low: null,
      ladder: null,
      stair: null,
      cabinDeck: null,
      cabin: null,
      swing: null,
      nests: [],
      lookout: null,
      lanterns: [],
    };
    const ladderAngle = FRONT + side * 0.55;
    if (r.ladder[stage]) {
      const y = foot[1] + h * DECKS.low;
      const inner = axis(y).r * 0.9;
      const outer = axis(y).r + 1.5;
      house.low = { y, inner, outer };
      const top = around(y, ladderAngle, outer - 0.05);
      const base = around(y, ladderAngle, outer + 0.9);
      const groundY = this.surfaceAt(base[0], base[2])?.y ?? foot[1];
      house.ladder = { foot: [base[0], groundY - 0.05, base[2]], top, angle: ladderAngle };
    }
    const cabinAngle = FRONT - side * 0.35;
    if (r.stair[stage]) {
      house.stair = {
        from: foot[1] + h * DECKS.low,
        to: foot[1] + h * DECKS.cabin,
        angle: ladderAngle + side * 0.5,
        turn: -side * 1.6 * Math.PI,
      };
    }
    if (r.cabin[stage]) {
      const y = foot[1] + h * DECKS.cabin;
      const t = axis(y).r;
      const size = 1.9;
      house.cabinDeck = { y, inner: t * 0.9, outer: t + 2.3 };
      const reach = t + 1.15;
      house.cabin = {
        foot: around(y, cabinAngle, reach),
        facing: cabinAngle,
        size,
        angle: cabinAngle,
        reach,
      };
    }
    if (r.swing[stage]) {
      // From the end of the limb reaching most towards the camera, on the ladder's side.
      const sk = shape.skeleton;
      let best = -Infinity;
      let branch: P3 | null = null;
      for (const limb of shape.limbs) {
        const end = limb[limb.length - 1];
        const score = sk.z[end] + side * sk.x[end] * 0.5;
        if (score > best) {
          best = score;
          branch = [foot[0] + sk.x[end], foot[1] + sk.y[end], foot[2] + sk.z[end]];
        }
      }
      if (branch) {
        const seatGround = this.surfaceAt(branch[0], branch[2])?.y ?? foot[1];
        house.swing = { branch, seatY: seatGround + 0.75, facing: FRONT };
      }
    }
    if (r.nests[stage]) {
      // Above the cabin's deck, beside the cabin and its roof.
      const roofs: SwatchName[] = ['PetalBlue', 'PetalRed', 'PetalYellow'];
      const deckY = foot[1] + h * DECKS.cabin;
      [0.55, -1.4, -2.0].forEach((turn, i) => {
        const y = deckY + 1.3 + 0.4 * i;
        const angle = FRONT + side * turn;
        house.nests.push({
          at: around(y, angle, axis(y).r + 0.2),
          facing: angle,
          roof: roofs[i],
        });
      });
    }
    if (r.lookout[stage]) {
      // On the side, away from the cabin's roof: an arc of a deck.
      const y = foot[1] + h * DECKS.lookout;
      const t = axis(y).r;
      const below = foot[1] + h * DECKS.cabin;
      const angle = FRONT + side * 1.1;
      const [a, b] = [FRONT + side * 0.9, FRONT + side * 2.6];
      house.lookout = {
        y,
        inner: t * 0.9,
        outer: t + 1.3,
        from: Math.min(a, b),
        to: Math.max(a, b),
        ladder: {
          foot: around(below, angle, axis(below).r + 0.7),
          top: around(y, angle, t + 0.75),
        },
      };
    }
    if (r.lanterns[stage]) {
      const colours: SwatchName[] = ['PetalRed', 'PetalYellow', 'Orange', 'PetalPink'];
      let k = 0;
      const hang = (at: P3) => house.lanterns.push({ at, colour: colours[k++ % colours.length] });
      // Around the decks, on the side of the camera.
      for (const d of [house.low, house.cabinDeck, house.lookout]) {
        if (!d) continue;
        const arc = d === house.lookout ? house.lookout : null;
        const from = Math.max(FRONT - 1.4, arc ? arc.from + 0.15 : -Infinity);
        const to = Math.min(FRONT + 1.4, arc ? arc.to - 0.15 : Infinity);
        const n = Math.round((d.outer * 1.3 * (to - from)) / 2.8);
        for (let i = 0; i <= n; i++) {
          hang(around(d.y + 0.5, from + ((to - from) * i) / Math.max(1, n), d.outer + 0.05));
        }
      }
      // Garlands from limb to limb under the crown.
      const sk = shape.skeleton;
      const mids = shape.limbs
        .map((limb): P3 => [
          foot[0] + sk.x[limb[1]],
          foot[1] + sk.y[limb[1]],
          foot[2] + sk.z[limb[1]],
        ])
        .sort(
          (a, b) =>
            Math.atan2(a[2] - foot[2], a[0] - foot[0]) - Math.atan2(b[2] - foot[2], b[0] - foot[0]),
        );
      for (let i = 0; i < mids.length; i++) {
        const a = mids[i];
        const b = mids[(i + 1) % mids.length];
        const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
        for (const at of garland(a, b, Math.max(2, Math.round(span / 1.6)), span * 0.18)) hang(at);
      }
    }
    return house;
  }

  private compose(): void {
    const r = GIANT_BY_STAGE;
    const { tree, giant } = this.layout;
    this.treeSpots.push({
      x: tree.x,
      z: tree.z,
      role: 'hero',
      size: 1,
      slot: 0,
      family: 'Round',
      giant: { seed: giant, growth: r.growth[this.stage] },
    });

    const slots = slotsOf(this.seed);
    for (const [index, slot] of slots.entries()) {
      if (slot.opens > this.stage) break;
      this.slots.push({
        index,
        x: slot.x,
        z: slot.z,
        kind: slot.kind,
        size: 1,
        detail: slot.opens <= 1 ? 'full' : 'light',
      });
    }

    const house = this.treehouse;
    for (const { at } of house.lanterns) this.lanterns.push({ x: at[0], y: at[1], z: at[2] });

    // Grand moments: sparkles where they come, the stage before.
    if (revealAt(r.cabin, this.stage) === 'announced') {
      const next = new GiantTree(this.seed, (this.stage + 1) as Stage, false).treehouse.cabin!;
      this.announcements.push({
        label: 'cabin',
        x: next.foot[0],
        y: next.foot[1] + 1,
        z: next.foot[2],
        radius: 1.6,
      });
    }
    if (revealAt(r.lanterns, this.stage) === 'announced') {
      const { foot, shape } = house;
      this.announcements.push({
        label: 'lanterns',
        x: foot[0],
        y: foot[1] + shape.height * 0.55,
        z: foot[2] + 2,
        radius: shape.height * 0.35,
      });
    }

    const p = this.pond;
    if (p) {
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

    this.forest();
  }

  /** The forest around the meadow, at the back and on the sides, off the meadows. */
  private forest(): void {
    const rng = new Rng(this.seed).fork('forest');
    const final = outlineOf(LAST_STAGE);
    const { tree, pond, meadows } = this.layout;
    const slots = slotsOf(this.seed);
    const placed: { x: number; z: number }[] = [];
    const spots: TreeSpot[] = [];
    for (let attempt = 0; attempt < 3000; attempt++) {
      const x = rng.range(-final.hx, final.hx);
      const z = rng.range(final.cz - final.hz, final.cz + final.hz);
      // The trees of the first diorama come first, so the sprout is not alone.
      const first = this.rim(x, z, outlineOf(0)) < 0.9;
      const rank = rng.next() * (first ? 0.5 : 1);
      const size = rng.next();
      const conifer = rng.chance(0.3);
      const rim = this.rim(x, z, final);
      if (rim > 0.93 || rim < 0.25) continue;
      // Behind and beside the great tree; in front, only on the sides of the first diorama:
      // the front meadow stays open.
      if (z > tree.z + 5 && (Math.abs(x - tree.x) < 8.5 || !first)) continue;
      if (Math.hypot(x - tree.x, z - tree.z) < 7) continue;
      if (Math.hypot(x - pond.x, z - pond.z) < GIANT_BY_STAGE.pond[LAST_STAGE] + 3) continue;
      if (meadows.some((m) => Math.hypot(x - m.x, z - m.z) < 4)) continue;
      if (slots.some((s) => Math.hypot(x - s.x, z - s.z) < 2.2)) continue;
      if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 3)) continue;
      placed.push({ x, z });
      spots.push({
        x,
        z,
        role: 'edge',
        rank,
        size: 0.95 + 0.3 * size,
        conifer,
        detail: z < tree.z - 6 ? 'far' : 'light',
      });
    }
    spots.sort((a, b) => a.rank! - b.rank!);
    for (const spot of spots.slice(0, MAX_EDGE_TREES)) {
      const surface = this.surfaceAt(spot.x, spot.z);
      if (!surface || surface.kind !== 'grass') continue;
      this.treeSpots.push(spot);
    }
  }

  /** Points the camera keeps in view: the rim, a part of the underside, the great tree. */
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
    // The great tree and its crown, whose top may leave the picture: it frames it.
    const { foot, shape } = this.treehouse;
    const sk = shape.skeleton;
    const half = shape.clump * 0.5;
    const top = foot[1] + shape.height * 1.05;
    for (let i = 0; i < sk.count; i++) {
      if (sk.root[i]) continue;
      points.push([foot[0] + sk.x[i], Math.min(top, foot[1] + sk.y[i] + half), foot[2] + sk.z[i]]);
    }
    let left = 0;
    let right = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i][0] < points[left][0]) left = i;
      if (points[i][0] > points[right][0]) right = i;
    }
    points.push(
      [points[left][0] - half, points[left][1], points[left][2]],
      [points[right][0] + half, points[right][1], points[right][2]],
    );
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
    const { power, wobble, tree } = this.layout;
    const grid = groundGrid(rng, { ...o, power, wobble }, CELL, (x, z) => this.height(x, z));
    const grass = groundSwatch(season);
    const p = this.pond;
    buildDiorama(out, grid, rng, o.cz, o.hx, (cx, cy, cz, slope, jitter) => {
      if (slope > 0.6) return swatchUV('Stone', 0.2 + slope * 0.4 + jitter * 2);
      if (p && Math.hypot(cx - p.x, cz - p.z) < p.radius + 1.2 && cy < p.level + 0.25) {
        return swatchUV('HexSand', 0.3 + Math.min(0.5, (p.level - cy) * 0.7) + jitter);
      }
      // Mossy shade under the great tree, sunny meadow around.
      const shade = 1 - smoothstep(3, 9, Math.hypot(cx - tree.x, cz - tree.z));
      const patch = valueNoise2(this.seed + 5, cx / 4.5, cz / 4.5) - 0.5;
      const tone = Math.min(1, Math.max(0, 0.3 + 0.35 * shade + slope + patch * 0.3 + jitter));
      return swatchUV(grass.swatch, lerp(grass.from, grass.to, tone));
    });
    this.buildTreehouse(out);
  }

  private buildTreehouse(out: MeshWriter): void {
    const house = this.treehouse;
    const { foot, shape } = house;
    const axis = (y: number) => {
      const t = trunkAt(shape, y - foot[1]);
      return { x: foot[0] + t.x, z: foot[2] + t.z, r: t.r };
    };
    const within = (angle: number, centre: number, half: number) =>
      Math.abs(((angle - centre + 3 * Math.PI) % TAU) - Math.PI) < half;
    if (house.low && house.ladder) {
      const { y, inner, outer } = house.low;
      const a = axis(y);
      deck(out, a.x, a.z, y, inner, outer);
      const stairAngle = house.stair?.angle;
      railing(
        out,
        a.x,
        a.z,
        y,
        outer - 0.08,
        (angle) =>
          within(angle, house.ladder!.angle, 0.45 / outer) ||
          (stairAngle !== undefined && within(angle, stairAngle, 0.5 / outer)),
      );
      ladder(out, house.ladder.foot, house.ladder.top);
    }
    if (house.stair) {
      const { from, to, angle, turn } = house.stair;
      spiralStair(out, axis, from + 0.3, to - 0.1, angle, turn);
    }
    if (house.cabinDeck && house.cabin) {
      const { y, inner, outer } = house.cabinDeck;
      const a = axis(y);
      deck(out, a.x, a.z, y, inner, outer);
      const stairEnd = house.stair ? house.stair.angle + house.stair.turn : null;
      const cabinHalf = (house.cabin.size * 0.6) / house.cabin.reach;
      railing(
        out,
        a.x,
        a.z,
        y,
        outer - 0.08,
        (angle) =>
          within(angle, house.cabin!.angle, cabinHalf) ||
          (stairEnd !== null && within(angle, stairEnd, 0.5 / outer)) ||
          (house.lookout !== null && within(angle, FRONT + this.layout.side * 1.1, 0.5 / outer)),
      );
      cabin(out, house.cabin.foot, house.cabin.facing, house.cabin.size, this.layout.roof);
    }
    if (house.swing) swing(out, house.swing.branch, house.swing.seatY, house.swing.facing);
    for (const nest of house.nests) nestingBox(out, nest.at, nest.facing, nest.roof);
    if (house.lookout) {
      const { y, inner, outer, from, to } = house.lookout;
      const a = axis(y);
      deck(out, a.x, a.z, y, inner, outer, from, to);
      const ladderAngle = FRONT + this.layout.side * 1.1;
      railing(
        out,
        a.x,
        a.z,
        y,
        outer - 0.08,
        (angle) => within(angle, ladderAngle, 0.5 / outer),
        from,
        to,
      );
      ladder(out, house.lookout.ladder.foot, house.lookout.ladder.top, 0.5);
      const flagAngle = FRONT + this.layout.side * 2.3;
      flag(
        out,
        [a.x + Math.cos(flagAngle) * (outer - 0.1), y, a.z + Math.sin(flagAngle) * (outer - 0.1)],
        2.2,
        FRONT,
      );
    }
    for (const { at, colour } of house.lanterns) lantern(out, at, colour);
  }

  buildWater(out: WaterBuilder): void {
    const p = this.pond;
    if (!p) return;
    const rings = [0.34, 0.68, 1];
    const segments = Math.max(14, Math.round(p.radius * 5));
    const reach = p.radius + 1.1;
    const shore = (x: number, z: number) =>
      1 - Math.min(1, Math.max(0, (p.level - this.height(x, z)) / 0.6));
    const center = out.point(p.x, p.level, p.z, 0, 0, WATER_STILL, 0);
    let previous: number[] = [];
    rings.forEach((ring, k) => {
      const current: number[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * TAU;
        const x = p.x + Math.cos(a) * reach * ring;
        const z = p.z + Math.sin(a) * reach * ring;
        current.push(out.point(x, p.level, z, 0, 0, WATER_STILL, shore(x, z)));
      }
      for (let i = 0; i < segments; i++) {
        const j = (i + 1) % segments;
        if (k === 0) out.triangle(center, current[j], current[i]);
        else {
          out.triangle(previous[i], current[j], current[i]);
          out.triangle(previous[i], previous[j], current[j]);
        }
      }
      previous = current;
    });
  }
}

export function createGiantTree(seed: number, stage: Stage): Terrain {
  return new GiantTree(seed, stage);
}
