import { Rng, hashSeed } from '../core/rng';
import type { WoodPiece } from '../scene/render/fact-tree-art';

// The tree of what is known by heart (#151), an « arbre de vie »: the trunk forks into limbs,
// the limbs into twigs, fanned out in a round crown, every fork a little off. A group of facts
// takes one twig, or a little fork of twigs around the stem that carries its name when the
// tree has few groups. Each fact has a little twig of its own, where its tuft grows.
// SVG units, y down; the 3D wood is drawn from the same pieces.

export const TREE_WIDTH = 1100;
export const TREE_HEIGHT = 600;

type P = [number, number];

export interface TreeGroup {
  count: number;
  /** The size of its name, tuft included. */
  label: { width: number; height: number };
}

export interface BranchLayout {
  /** The wood of this group alone, as an SVG path: it glows when Plume suggests it. */
  wood: string;
  /** Where the tuft of each fact grows, in the order of the group's facts. */
  tufts: { x: number; y: number }[];
  /** The centre of its name, and how askew it hangs, in degrees. */
  label: { x: number; y: number; tilt: number };
  /** The part of the tree that answers the finger, as an SVG path: never another's. */
  touch: string;
}

export interface TreeLayout {
  wood: WoodPiece[];
  branches: BranchLayout[];
}

const CENTRE: P = [550, 440];
const RX = 440;
const RY = 360;
/** Twigs the crown should have, about: a tree with few groups forks them further. */
const TWIGS = 10;
/** Facts on a twig, at least, when a group forks into several. */
const MIN_PER_TWIG = 3;
/** Forks lean towards the sky: their angle is pulled towards 90°. */
const UPRIGHT = 0.7;
const ROW_GAP = 26;
/** The touch areas are made of squares this big, each to the group nearest to it… */
const TOUCH_CELL = 12;
/** …if one is that close. */
const TOUCH_REACH = 80;

const radians = (deg: number) => (deg * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A bent piece of wood: a quadratic curve that wavers a little between its ends. */
class Curve {
  constructor(
    readonly a: P,
    readonly c: P,
    readonly b: P,
    private readonly amp: number,
    private readonly phase: number,
  ) {}

  at(t: number): P {
    const { a, b, c } = this;
    const u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    let tx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    let ty = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    // Zero at both ends, so the pieces meet.
    const w = this.amp * Math.sin(Math.PI * t) * Math.sin(this.phase + t * 2.2 * Math.PI);
    return [x - ty * w, y + tx * w];
  }

  tangent(t: number): P {
    const [x0, y0] = this.at(Math.max(0, t - 0.01));
    const [x1, y1] = this.at(Math.min(1, t + 0.01));
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [(x1 - x0) / l, (y1 - y0) / l];
  }

  get svg(): string {
    const p = (q: P) => q.map(Math.round).join(' ');
    return `M${p(this.a)}Q${p(this.c)} ${p(this.b)}`;
  }
}

/** Parts a fork splits `size` into: up to three, as even as can be. */
function parts(size: number): number[] {
  const k = size <= 3 ? size : size >= 6 ? 3 : 2;
  const out: number[] = [];
  let left = size;
  for (let p = k; p > 0; p--) {
    const take = Math.round(left / p);
    out.push(take);
    left -= take;
  }
  return out;
}

const reachOf = (size: number) => Math.max(0, 1 - 0.36 * Math.log2(size));
const girth = (size: number) => 5 + 8 * Math.sqrt(size);

/** What ends at a slot of the rim: a twig with facts, or the stem of a name. */
interface End {
  group: number;
  slot: number;
  facts: number[] | null;
}

/** Draws the wood: a curve sampled into a piece, its radius from `r0` to `r1`. */
function piece(cv: Curve, r0: number, r1: number, z0 = 0, z1 = 0): WoodPiece {
  const points: [number, number, number][] = [];
  const radii: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const [x, y] = cv.at(t);
    points.push([x, y, lerp(z0, z1, t)]);
    // A little swelling where the wood leaves a fork.
    radii.push(lerp(r0, r1, t) * (1 + 0.25 * Math.max(0, 1 - t * 6)));
  }
  return { points, radii, rough: r0 > 14 ? 0.1 : r0 > 8 ? 0.06 : 0 };
}

/** A curve from `a` to `b`: up first, then out, bent to one side or the other. */
function bent(rng: Rng, a: P, b: P, wave = 1): Curve {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const side = rng.range(-0.12, 0.12) * length;
  const c: P = [
    a[0] + dx * 0.4 - (dy / length) * side,
    a[1] + dy * 0.55 - Math.abs(dx) * rng.range(0.08, 0.2) + (dx / length) * side,
  ];
  return new Curve(a, c, b, wave * Math.min(9, length * 0.04), rng.range(0, Math.PI * 2));
}

/**
 * The facts of a twig along it, each on a little twig of its own, in one or two rows: where
 * their tufts grow, and their wood.
 */
function sprigs(
  rng: Rng,
  cv: Curve,
  count: number,
  from = 0.38,
  scale = 1,
): { tufts: P[]; wood: WoodPiece[] } {
  const rows = count > 3 ? 2 : 1;
  const perRow = Math.ceil(count / rows);
  const tufts: P[] = [];
  const wood: WoodPiece[] = [];
  for (let j = 0; j < count; j++) {
    const row = j % rows;
    const k = Math.floor(j / rows);
    const t = (perRow === 1 ? 0.75 : lerp(from, 0.9, k / (perRow - 1))) + rng.range(-0.025, 0.025);
    const [x, y] = cv.at(t);
    const [tx, ty] = cv.tangent(t);
    const offset =
      ((rows === 1 ? (j % 2 ? 12 : -12) : (row - 0.5) * ROW_GAP) + rng.range(-3, 3)) * scale;
    const side = offset < 0 ? -1 : 1;
    const nx = -ty * side;
    const ny = tx * side;
    // Away from the wood, a little forwards.
    const dir = Math.atan2(ny + ty * 0.6, nx + tx * 0.6);
    const base: P = [x + nx * 3 * scale, y + ny * 3 * scale];
    const reach = ((rows === 1 ? 20 : 14) + rng.range(-3, 4)) * scale + Math.abs(offset);
    const tip: P = [base[0] + Math.cos(dir) * reach, base[1] + Math.sin(dir) * reach];
    wood.push(piece(bent(rng, base, tip, 0.3), 3 * scale, 1.6 * scale, 4, 10));
    tufts.push(tip);
  }
  return { tufts, wood };
}

/** The tree of a notion: the same for the same `seed`, whatever is known. */
export function treeLayout(groups: readonly TreeGroup[], seed: string): TreeLayout {
  const rng = new Rng(hashSeed(7, seed));
  const n = groups.length;
  const twigsOf = groups.map((g) =>
    Math.max(1, Math.min(Math.round(TWIGS / n), Math.ceil(g.count / MIN_PER_TWIG))),
  );
  // The ends of each group on the rim, the stem of its name in the middle when it has several
  // twigs; an empty slot between two groups that have several.
  const ends: End[][] = [];
  let slot = 0;
  for (const [g, k] of twigsOf.entries()) {
    if (g > 0 && (k > 1 || twigsOf[g - 1] > 1)) slot += 1;
    const mine: End[] = [];
    let fact = 0;
    let twig = 0;
    for (let i = 0; i < (k > 1 ? k + 1 : 1); i++) {
      if (k > 1 && i === Math.floor(k / 2)) {
        mine.push({ group: g, slot: slot++, facts: null });
        continue;
      }
      const share = Math.round((groups[g].count - fact) / (k - twig));
      mine.push({
        group: g,
        slot: slot++,
        facts: Array.from({ length: share }, (_, j) => fact + j),
      });
      fact += share;
      twig += 1;
    }
    ends.push(mine);
  }
  const total = slot;
  const spread = total <= 1 ? 0 : clamp(26 * (total - 1), 130, 186);
  // Each slot a little off its place, and the rim a little uneven.
  const jitter = Array.from({ length: total }, () => [rng.range(-3, 3), rng.range(0.92, 1.04)]);
  const angle = (s: number) =>
    total <= 1 ? 90 : 90 + spread / 2 - (s * spread) / (total - 1) + jitter[s][0];
  const upright = (deg: number) => 90 + (deg - 90) * UPRIGHT + rng.range(-5, 5);
  const fork: P = [550 + rng.range(-24, 24), 420 + rng.range(-14, 10)];
  const onRim = (deg: number, rho: number): P => [
    lerp(fork[0], CENTRE[0] + RX * Math.cos(radians(deg)), rho),
    lerp(fork[1], CENTRE[1] - RY * Math.sin(radians(deg)), rho),
  ];

  const wood: WoodPiece[] = [];
  const trunk = new Curve(
    [550 + rng.range(-6, 6), TREE_HEIGHT + 40],
    [550 + rng.range(-34, 34), TREE_HEIGHT - 60],
    fork,
    10,
    rng.range(0, Math.PI * 2),
  );
  wood.push(piece(trunk, girth(total) * 1.35, girth(total)));

  const branches: BranchLayout[] = groups.map(() => ({
    wood: '',
    tufts: [],
    label: { x: 0, y: 0, tilt: rng.range(-4, 4) },
    touch: '',
  }));

  /** The name of group `g` hung past `tip`, and a bit more wood if it had to move away. */
  const hang = (g: number, tip: P, [ex, ey]: P, gap: number, radius: number) => {
    const { width, height } = groups[g].label;
    const push = (Math.abs(ex) * width) / 2 + (Math.abs(ey) * height) / 2 + gap;
    // Always whole inside the picture.
    const x = clamp(tip[0] + ex * push, width / 2 + 6, TREE_WIDTH - width / 2 - 6);
    const y = clamp(tip[1] + ey * push, height / 2 + 6, TREE_HEIGHT - height / 2 - 6);
    const into: P = [
      clamp(tip[0], x - width / 2 + 16, x + width / 2 - 16),
      clamp(tip[1], y - height / 2 + 16, y + height / 2 - 16),
    ];
    if (Math.hypot(into[0] - tip[0], into[1] - tip[1]) > 4) {
      const cv = bent(rng, tip, into, 0.3);
      wood.push(piece(cv, radius, radius * 0.8, 8, 12));
      branches[g].wood += cv.svg;
    }
    Object.assign(branches[g].label, { x, y });
  };

  /** A bare spur on a limb, sometimes. */
  const spur = (cv: Curve, size: number) => {
    if (!rng.chance(0.55)) return;
    const t = rng.range(0.35, 0.65);
    const [x, y] = cv.at(t);
    const [tx, ty] = cv.tangent(t);
    const side = rng.chance(0.5) ? 1 : -1;
    const length = rng.range(34, 56);
    const out: P = [
      x + (-ty * side * 0.8 + tx * 0.6) * length,
      y + (tx * side * 0.8 + ty * 0.6) * length,
    ];
    wood.push(piece(bent(rng, [x, y], out, 0.5), Math.min(girth(size) * 0.45, 8), 2.5, 0, -10));
  };

  /** What ends at `end`, from `at`. */
  const leafEnd = (end: End, at: P) => {
    const g = end.group;
    const b = onRim(angle(end.slot), end.facts ? jitter[end.slot][1] : 0.94);
    const cv = bent(rng, at, b, 0.7);
    wood.push(piece(cv, girth(1) + 1, end.facts ? 3.5 : 5, 0, 8));
    branches[g].wood += cv.svg;
    if (!end.facts) {
      hang(g, b, cv.tangent(1), 30, 5);
      return;
    }
    const twig = sprigs(rng, cv, end.facts.length);
    wood.push(...twig.wood);
    for (const [j, fact] of end.facts.entries()) {
      const [x, y] = twig.tufts[j];
      branches[g].tufts[fact] = { x, y };
    }
    if (twigsOf[g] === 1) hang(g, b, cv.tangent(1), 2, 3.5);
  };

  /** The ends `list` (side by side on the rim) grow from `at`, forking on the way. */
  const grow = (list: End[], at: P, byGroup: boolean): void => {
    if (list.length === 1) {
      leafEnd(list[0], at);
      return;
    }
    // Groups part first, then the ends of a group.
    const units: End[][] = byGroup
      ? [...new Set(list.map((e) => e.group))].map((g) => list.filter((e) => e.group === g))
      : list.map((e) => [e]);
    if (byGroup && units.length === 1) {
      grow(units[0], at, false);
      return;
    }
    let start = 0;
    for (const size of parts(units.length)) {
      const chunk = units.slice(start, start + size).flat();
      start += size;
      if (chunk.length === 1) {
        leafEnd(chunk[0], at);
        continue;
      }
      const first = chunk[0].slot;
      const last = chunk[chunk.length - 1].slot;
      const width = last - first + 1;
      const node = onRim(
        upright((angle(first) + angle(last)) / 2),
        reachOf(width) * rng.range(0.85, 1) + 0.08,
      );
      const cv = bent(rng, at, node);
      wood.push(piece(cv, girth(width) + 2, girth(width)));
      const owners = new Set(chunk.map((e) => e.group));
      // Only a group's own wood glows, not the limbs it shares.
      if (owners.size === 1) for (const g of owners) branches[g].wood += cv.svg;
      spur(cv, width);
      grow(chunk, node, byGroup && size > 1);
    }
  };
  grow(ends.flat(), fork, true);

  // Each group answers around its tufts and its name: a spot of the picture goes to the nearest,
  // so the parts never overlap.
  const near = branches.flatMap((b, g) => {
    const { width, height } = groups[g].label;
    const name = [-0.5, 0, 0.5].flatMap((sx) =>
      [-0.5, 0, 0.5].map((sy) => ({ x: b.label.x + sx * width, y: b.label.y + sy * height, g })),
    );
    return [...b.tufts.map((t) => ({ ...t, g })), ...name];
  });
  const cols = Math.ceil(TREE_WIDTH / TOUCH_CELL);
  const rows = Math.ceil(TREE_HEIGHT / TOUCH_CELL);
  const owners = new Int8Array(cols * rows).fill(-1);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * TOUCH_CELL;
      const cy = (row + 0.5) * TOUCH_CELL;
      let closest = TOUCH_REACH * TOUCH_REACH;
      for (const p of near) {
        const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
        if (d < closest) {
          closest = d;
          owners[row * cols + col] = p.g;
        }
      }
    }
  }
  // Under a tuft, always its own group, even right against another's.
  for (const [g, branch] of branches.entries()) {
    for (const { x, y } of branch.tufts) {
      const col = Math.floor(x / TOUCH_CELL);
      const row = Math.floor(y / TOUCH_CELL);
      for (const [dc, dr] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (col + dc >= 0 && col + dc < cols && row + dr >= 0 && row + dr < rows)
          owners[(row + dr) * cols + col + dc] = g;
      }
    }
  }
  // Rows of squares of the same group, as runs.
  const runs: string[] = branches.map(() => '');
  for (let row = 0; row < rows; row++) {
    let owner = -1;
    let from = 0;
    for (let col = 0; col <= cols; col++) {
      const g = col < cols ? owners[row * cols + col] : -1;
      if (g === owner) continue;
      const [x0, x1, y] = [
        from * TOUCH_CELL,
        Math.min(col * TOUCH_CELL, TREE_WIDTH),
        row * TOUCH_CELL,
      ];
      if (owner >= 0) runs[owner] += `M${x0} ${y}h${x1 - x0}v${TOUCH_CELL}h${x0 - x1}z`;
      owner = g;
      from = col;
    }
  }
  for (const [g, branch] of branches.entries()) branch.touch = runs[g];
  return { wood, branches };
}

/** The branch of a round in big, between two rounds (#131): left to right, its name at the tip. */
export function branchLayout(
  count: number,
  label: { width: number; height: number },
  size: { width: number; height: number },
  seed: string,
): { wood: WoodPiece[]; tufts: { x: number; y: number }[]; label: { x: number; y: number } } {
  const rng = new Rng(hashSeed(11, seed));
  const mid = size.height / 2;
  const tip: P = [size.width - label.width - 10, mid - 6];
  const cv = new Curve(
    [-20, mid + 20],
    [(size.width - label.width) / 2, mid + 34],
    tip,
    6,
    rng.range(0, 6),
  );
  const wood = [piece(cv, 18, 6)];
  const twig = sprigs(rng, cv, count, 0.14, 1.7);
  wood.push(...twig.wood);
  return {
    wood,
    tufts: twig.tufts.map(([x, y]) => ({ x, y })),
    label: { x: size.width - label.width / 2 - 4, y: mid - 6 },
  };
}
