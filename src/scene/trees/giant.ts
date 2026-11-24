import { hashSeed, Rng } from '../../core/rng';
import type { ModelName } from '../asset-catalog';
import type { AssetLibrary } from '../assets';
import type { SwatchName } from '../atlas';
import {
  blob,
  foliagePicker,
  placeTree,
  tube,
  type Season,
  type TreeContext,
  type TreeInfo,
  type TreeSpec,
  type TreeWriter,
} from './builder';
import { FAMILIES, type Family } from './families';
import { chains, normalize, perpendicular, rotate, Skeleton, type Vec } from './skeleton';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** The great tree of a décor (#92): its own seed, and how far it has grown (0 to 1). */
export interface GiantSpec {
  seed: number;
  growth: number;
}

/** Trunk height and radius at the foot of the colossus. */
const TRUNK = 11;
const GIRTH = 1.6;
/** Limbs of the colossus; the sprout has two. */
const LIMBS = 7;
/** Trunk nodes above the foot. */
const TRUNK_NODES = 6;

/** Size of the great tree for its growth: a sprout a little taller than a young tree, then 3.5 times. */
export function giantSize(growth: number): number {
  return 0.28 + 0.72 * growth;
}

export interface GiantShape {
  skeleton: Skeleton;
  /** Trunk axis from the foot to the top, local to the foot, with its radius. */
  trunk: readonly { x: number; y: number; z: number; r: number }[];
  /** Nodes of each limb, from the trunk outwards along its main path. */
  limbs: readonly (readonly number[])[];
  /** Width of a tuft at a branch end. */
  clump: number;
  /** Height of the trunk (its top node). */
  height: number;
  tuft: ModelName;
  sub: ModelName;
  bark: SwatchName;
}

/** Trunk axis and radius at a height above the foot, between two trunk nodes. */
export function trunkAt(shape: GiantShape, y: number): { x: number; z: number; r: number } {
  const t = shape.trunk;
  for (let k = 1; k < t.length; k++) {
    if (y <= t[k].y || k === t.length - 1) {
      const f = Math.min(1, Math.max(0, (y - t[k - 1].y) / (t[k].y - t[k - 1].y)));
      return {
        x: t[k - 1].x + (t[k].x - t[k - 1].x) * f,
        z: t[k - 1].z + (t[k].z - t[k - 1].z) * f,
        r: t[k - 1].r + (t[k].r - t[k - 1].r) * f,
      };
    }
  }
  return t[0];
}

const shapes = new Map<string, GiantShape>();

/**
 * Skeleton of the great tree, local to its foot. The same seed gives the same tree at every
 * growth: each root, limb and fork draws its own numbers, so the tree only gets larger and
 * adds limbs (two for the sprout, seven for the colossus) and forks.
 */
export function giantShape(seed: number, growth: number): GiantShape {
  const key = `${seed}:${growth}`;
  const cached = shapes.get(key);
  if (cached) return cached;
  const rng = new Rng(hashSeed(seed, 'giant'));
  const s = giantSize(growth);
  const height = TRUNK * s;
  // Thicker as it grows: a slender sprout, a massive colossus.
  const girth = GIRTH * Math.pow(s, 1.35);
  const lean = rng.range(0, TAU);
  const bow = rng.range(0.025, 0.05) * height;
  const a0 = rng.range(0, TAU);
  const rootCount = rng.int(5, 6);
  const cube = rng.chance(0.35);
  const dark = rng.chance(0.5);

  const sk = new Skeleton();
  const trunk: { x: number; y: number; z: number; r: number }[] = [];
  let node = -1;
  for (let k = 0; k <= TRUNK_NODES; k++) {
    const t = k / TRUNK_NODES;
    const off = Math.sin(t * Math.PI * 0.8) * bow;
    const x = Math.cos(lean) * off;
    const y = k === 0 ? -0.3 : height * t;
    const z = Math.sin(lean) * off;
    const r = girth * (k === 0 ? 1.3 : 1.2 - 0.6 * t);
    node = sk.add(x, y, z, r, node);
    sk.anchor[node] = node;
    trunk.push({ x, y, z, r });
  }
  sk.trunkTop = node;

  // Buttress roots arching out over the ground.
  for (let i = 0; i < rootCount; i++) {
    const rr = new Rng(hashSeed(seed, `giant:root:${i}`));
    const a = a0 + (i * TAU) / rootCount + rr.range(-0.25, 0.25);
    const curl = rr.range(-0.35, 0.35);
    const reach = rr.range(2.8, 3.8);
    const points: readonly (readonly [number, number, number])[] = [
      [0.35, 1.0, 0.62],
      [1.25, 0.42, 0.45],
      [2.1, 0.12, 0.3],
      [reach, -0.25, 0.12],
    ];
    let parent = -1;
    points.forEach(([d, y, r], k) => {
      const b = a + (curl * k) / 3;
      parent = sk.add(
        Math.cos(b) * d * girth,
        y * girth,
        Math.sin(b) * d * girth,
        r * girth,
        parent,
        true,
      );
    });
  }

  // Limbs: from the upper trunk, spreading wide, then forking.
  const count = Math.min(LIMBS, 2 + Math.floor(growth * 5.99));
  const depth = growth < 0.25 ? 1 : 2;
  const limbs: number[][] = [];
  for (let i = 0; i < count; i++) {
    const lr = new Rng(hashSeed(seed, `giant:limb:${i}`));
    const at = trunk.length - 3 + (i % 3);
    const az = a0 + 0.5 + i * 2.4 + lr.range(-0.25, 0.25);
    const tilt = lr.range(62, 76) * DEG;
    const length = height * lr.range(0.6, 0.75) * (at === trunk.length - 1 ? 0.75 : 1);
    let d: Vec = [Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt)];
    let { x, y, z } = trunk[at];
    let r = girth * 0.55;
    let parent = at;
    const path: number[] = [];
    for (let k = 0; k < 3; k++) {
      d = normalize([d[0], d[1] + 0.08, d[2]]);
      x += (d[0] * length) / 3;
      y += (d[1] * length) / 3;
      z += (d[2] * length) / 3;
      r *= 0.8;
      parent = sk.add(x, y, z, r, parent);
      sk.anchor[parent] = at;
      path.push(parent);
    }
    limbs.push(path);
    fork(sk, lr, parent, d, length * 0.55, r * 0.78, depth, at);
  }

  const shape: GiantShape = {
    skeleton: sk,
    trunk,
    limbs,
    clump: 1.7 + 3.4 * growth,
    height,
    tuft: cube ? 'Tuft_Cube' : 'Tuft_Round',
    sub: cube ? 'Tuft_CubeSmall' : 'Tuft_RoundSmall',
    bark: dark ? 'DarkBark' : 'Bark',
  };
  shapes.set(key, shape);
  return shape;
}

/** Two branches out of a node, each forking again down to `depth` levels. */
function fork(
  sk: Skeleton,
  rng: Rng,
  from: number,
  d: Vec,
  length: number,
  radius: number,
  depth: number,
  anchor: number,
): void {
  const side0 = rotate(perpendicular(d), d, rng.range(0, TAU));
  for (let c = 0; c < 2; c++) {
    const side = rotate(side0, d, c * Math.PI + rng.range(-0.3, 0.3));
    const spread = rng.range(0.55, 0.85);
    let nd = normalize([
      d[0] + side[0] * spread,
      d[1] + side[1] * spread + 0.08,
      d[2] + side[2] * spread,
    ]);
    let x = sk.x[from];
    let y = sk.y[from];
    let z = sk.z[from];
    let r = radius;
    let node = from;
    for (let k = 0; k < 2; k++) {
      nd = normalize([nd[0], nd[1] + 0.08, nd[2]]);
      x += (nd[0] * length) / 2;
      y += (nd[1] * length) / 2;
      z += (nd[2] * length) / 2;
      r *= 0.85;
      node = sk.add(x, y, z, r, node);
      sk.anchor[node] = anchor;
    }
    if (depth > 1) fork(sk, rng, node, nd, length * 0.7, r * 0.75, depth - 1, anchor);
  }
}

/**
 * Append the great tree to the forest buffers: the tubes of its skeleton, large tufts at the
 * ends of its branches and on its top. Built in place at the foot (`spec.x/y/z`), without yaw
 * or scale, so the terrain knows where its trunk and limbs are.
 */
export function buildGiant(
  out: TreeWriter,
  spec: TreeSpec,
  giant: GiantSpec,
  assets: AssetLibrary,
  season: Season,
  treeIndex: number,
): TreeInfo {
  const shape = giantShape(giant.seed, giant.growth);
  const sk = shape.skeleton;
  const rng = new Rng(hashSeed(giant.seed, 'giant:build'));
  const family: Family = {
    ...FAMILIES.Round,
    blob: shape.tuft,
    sub: shape.sub,
    bark: shape.bark,
    squash: 0.85,
  };
  const firstVertex = out.vertexCount;
  const firstIndex = out.indexCount;
  const ages = sk.ages();
  const top = shape.height + shape.clump;
  const ctx: TreeContext = {
    out,
    rng,
    family,
    season,
    tree: treeIndex,
    // A colossus barely sways: its bend is measured against a much taller tree.
    top: top * 2.5,
    sides: 8,
  };
  for (const chain of chains(sk)) if (chain.length >= 2) tube(ctx, sk, ages, chain);

  const column = foliagePicker(
    new Rng(hashSeed(giant.seed, 'giant:foliage')),
    family,
    season,
    spec.foliage,
  );
  const main = assets.data(shape.tuft);
  const mainWidth = assets.size(shape.tuft)[0];
  const sub = assets.data(shape.sub);
  const subWidth = assets.size(shape.sub)[0];
  const kids = sk.children();
  const clump = shape.clump;
  for (let i = 0; i < sk.count; i++) {
    const p = sk.parent[i];
    if (sk.root[i] || kids[i].length > 0 || p < 0) continue;
    const dx = sk.x[i] - sk.x[p];
    const dy = sk.y[i] - sk.y[p];
    const dz = sk.z[i] - sk.z[p];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const cx = sk.x[i] + (dx / dl) * clump * 0.15;
    const cy = sk.y[i] + (dy / dl) * clump * 0.15;
    const cz = sk.z[i] + (dz / dl) * clump * 0.15;
    const anchor = sk.anchor[i];
    const growth = {
      px: sk.x[anchor],
      py: sk.y[anchor],
      pz: sk.z[anchor],
      birth0: ages[anchor],
      birth1: ages[i],
    };
    const c = column();
    blob(ctx, {
      model: main,
      modelWidth: mainWidth,
      x: cx,
      y: cy,
      z: cz,
      width: clump * rng.range(0.85, 1.1),
      squash: family.squash,
      column: c,
      ...growth,
    });
    for (let k = 0; k < 2; k++) {
      const reach = clump * 0.5;
      blob(ctx, {
        model: sub,
        modelWidth: subWidth,
        x: cx + rng.range(-1, 1) * reach,
        y: cy - rng.range(0.1, 0.4) * reach,
        z: cz + rng.range(-1, 1) * reach,
        width: clump * 0.5,
        squash: 1,
        column: c,
        ...growth,
      });
    }
  }
  const t = sk.trunkTop;
  blob(ctx, {
    model: main,
    modelWidth: mainWidth,
    x: sk.x[t],
    y: sk.y[t] + clump * 0.35,
    z: sk.z[t],
    width: clump * 1.25,
    squash: family.squash,
    column: column(),
    px: 0,
    py: 0,
    pz: 0,
    birth0: 0.02,
    birth1: ages[t],
  });
  placeTree(out, firstVertex, { x: spec.x, y: spec.y, z: spec.z, yaw: 0, scale: 1 });
  return {
    triangles: (out.indexCount - firstIndex) / 3,
    vertices: out.vertexCount - firstVertex,
    height: top,
  };
}
