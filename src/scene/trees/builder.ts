import { Rng, hashSeed } from '../../core/rng';
import type { AssetLibrary } from '../assets';
import { CELL_U, CELL_V, LEAF_ROW, swatchColumn, swatchUV, type SwatchName } from '../atlas';
import { MeshWriter, grown, type MeshData } from '../mesh-data';
import { FAMILIES, type Family, type FamilyName } from './families';
import { buildSkeleton, chains, perpendicular, type Skeleton } from './skeleton';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export interface TreeSpec {
  family: FamilyName;
  seed: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** `light` trees (forest edge) have fewer forks and larger tufts; `far` ones even fewer. */
  detail: 'full' | 'light' | 'far';
}

export interface TreeInfo {
  triangles: number;
  vertices: number;
  /** Height above the base, in world units. */
  height: number;
}

const TAU = Math.PI * 2;
const MIXED_AUTUMN: readonly SwatchName[] = [
  'Orange',
  'Orange',
  'Red',
  'Gold',
  'Gold',
  'Brown',
  'Summer',
];

/**
 * Mesh buffers of a forest. Besides position, normal and UV, each vertex carries what the
 * shader needs to grow and sway the tree:
 * - pivot: point the vertex grows from (parent node of a tube ring, limb base of a tuft);
 * - grow: birth age at the pivot, birth age in place, bend with the wind, tuft wobble;
 * - tree: tree index, plus a phase in the fractional part.
 */
export class TreeWriter extends MeshWriter {
  pivots = new Float32Array(this.positions.length);
  grow = new Uint8Array((this.positions.length / 3) * 4);
  tree = new Float32Array(this.positions.length / 3);

  protected override growVertices(capacity: number): void {
    super.growVertices(capacity);
    this.pivots = grown(this.pivots, capacity * 3);
    this.grow = grown(this.grow, capacity * 4);
    this.tree = grown(this.tree, capacity);
  }

  setGrowth(
    i: number,
    px: number,
    py: number,
    pz: number,
    birth0: number,
    birth1: number,
    bend: number,
    wobble: number,
    tree: number,
  ): void {
    this.pivots[i * 3] = px;
    this.pivots[i * 3 + 1] = py;
    this.pivots[i * 3 + 2] = pz;
    this.grow[i * 4] = Math.round(clamp01(birth0) * 255);
    this.grow[i * 4 + 1] = Math.round(clamp01(birth1) * 255);
    this.grow[i * 4 + 2] = Math.round(clamp01(bend) * 255);
    this.grow[i * 4 + 3] = Math.round(clamp01(wobble) * 255);
    this.tree[i] = tree;
  }

  /** Copy of a vertex with another UV, for a facet that needs its own colour. */
  duplicate(i: number, u: number, v: number): number {
    const n = this.vertex(
      this.positions[i * 3],
      this.positions[i * 3 + 1],
      this.positions[i * 3 + 2],
      this.normals[i * 3],
      this.normals[i * 3 + 1],
      this.normals[i * 3 + 2],
      u,
      v,
    );
    this.pivots.copyWithin(n * 3, i * 3, i * 3 + 3);
    this.grow.copyWithin(n * 4, i * 4, i * 4 + 4);
    this.tree[n] = this.tree[i];
    return n;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Shader growth rule, mirrored here for tests: 0 = at the pivot, 1 = in place. */
export function growthFactor(age: number, birth0: number, birth1: number): number {
  return clamp01((age - birth0) / Math.max(birth1 - birth0, 0.004));
}

/** Overall size of a tree for its age (a young tree is also thinner and shorter). */
export function sizeForAge(age: number): number {
  return (0.5 + 0.5 * age) * Math.min(1, age * 20);
}

interface TreeContext {
  out: TreeWriter;
  rng: Rng;
  family: Family;
  season: Season;
  tree: number;
  /** Reference height for the wind bend. */
  top: number;
  sides: number;
}

/** Smooth low-poly tube with a pointed end, coloured with the bark gradient. */
function tube(ctx: TreeContext, sk: Skeleton, ages: number[], chain: number[]): void {
  const { out, rng, family } = ctx;
  // Thin twigs need fewer sides.
  const sides = sk.radius[chain[1]] < 0.075 ? Math.min(ctx.sides, 4) : ctx.sides;
  const shift = rng.range(-0.08, 0.08);
  const rings: number[] = [];
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const last = chain.length - 1;
  let tx = 0;
  let ty = 1;
  let tz = 0;
  const addVertex = (
    node: number,
    px: number,
    py: number,
    pz: number,
    ox: number,
    oy: number,
    oz: number,
  ) => {
    const frac = Math.min(0.95, Math.max(0.05, 0.3 + 0.5 * (1 - (oy + 1) / 2) + shift));
    const [u, v] = swatchUV(family.bark, frac);
    const i = out.vertex(px, py, pz, ox, oy, oz, u, v);
    const p = sk.parent[node];
    const bend = Math.max(0, py / ctx.top);
    if (p >= 0) {
      out.setGrowth(i, sk.x[p], sk.y[p], sk.z[p], ages[p], ages[node], bend * bend, 0, ctx.tree);
    } else {
      out.setGrowth(i, sk.x[node], sk.y[node], sk.z[node], 0, 0, bend * bend, 0, ctx.tree);
    }
    return i;
  };
  for (let k = 0; k <= last; k++) {
    const a = chain[Math.max(k - 1, 0)];
    const b = chain[Math.min(k + 1, last)];
    const node = chain[k];
    tx = sk.x[b] - sk.x[a];
    ty = sk.y[b] - sk.y[a];
    tz = sk.z[b] - sk.z[a];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    if (k === 0) {
      [nx, ny, nz] = perpendicular([tx, ty, tz]);
    } else {
      const d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d;
      ny -= ty * d;
      nz -= tz * d;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
    }
    const sx = ty * nz - tz * ny;
    const sy = tz * nx - tx * nz;
    const sz = tx * ny - ty * nx;
    const r = sk.radius[node];
    for (let i = 0; i < sides; i++) {
      const angle = (i * TAU) / sides;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const ox = nx * c + sx * s;
      const oy = ny * c + sy * s;
      const oz = nz * c + sz * s;
      rings.push(
        addVertex(node, sk.x[node] + ox * r, sk.y[node] + oy * r, sk.z[node] + oz * r, ox, oy, oz),
      );
    }
  }
  const end = chain[last];
  const reach = sk.radius[end] * 1.5;
  const tip = addVertex(
    end,
    sk.x[end] + tx * reach,
    sk.y[end] + ty * reach,
    sk.z[end] + tz * reach,
    tx,
    ty,
    tz,
  );
  const [su, sv] = swatchUV('Snow', 0.1);
  const face = (a: number, b: number, c: number) => {
    // Winter: snow on the facets turned to the sky. They need their own vertices, since a
    // UV interpolated between two atlas cells would cross other colours.
    if (
      ctx.season === 'winter' &&
      out.normals[a * 3 + 1] + out.normals[b * 3 + 1] + out.normals[c * 3 + 1] > 1.35
    ) {
      out.triangle(out.duplicate(a, su, sv), out.duplicate(b, su, sv), out.duplicate(c, su, sv));
    } else {
      out.triangle(a, b, c);
    }
  };
  for (let k = 0; k < last; k++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = rings[k * sides + i];
      const b = rings[k * sides + j];
      const c = rings[(k + 1) * sides + j];
      const d = rings[(k + 1) * sides + i];
      face(a, b, c);
      face(a, c, d);
    }
  }
  for (let i = 0; i < sides; i++) {
    face(rings[last * sides + i], rings[last * sides + ((i + 1) % sides)], tip);
  }
}

interface BlobPlacement {
  model: MeshData;
  /** Width of the model along X, to scale it to the wanted width. */
  modelWidth: number;
  x: number;
  y: number;
  z: number;
  width: number;
  squash: number;
  column: number;
  /** Point the tuft grows from, and its birth ages there and in place. */
  px: number;
  py: number;
  pz: number;
  birth0: number;
  birth1: number;
  /** Winter: pure snow on the vertices turned to the sky (conifers). */
  snowAbove?: number;
}

function blob(ctx: TreeContext, b: BlobPlacement): void {
  const { out, rng } = ctx;
  const s = b.width / b.modelWidth;
  const first = out.append(
    b.model,
    b.x,
    b.y,
    b.z,
    rng.range(0, TAU),
    s,
    s * b.squash,
    s,
    b.column * CELL_U,
    0,
  );
  const bend = clamp01(b.y / ctx.top);
  const wobble = rng.range(0.5, 1);
  const tree = ctx.tree + rng.range(0, 0.98);
  const snowV = (LEAF_ROW + 0.1) * CELL_V;
  for (let i = first; i < out.vertexCount; i++) {
    out.setGrowth(i, b.px, b.py, b.pz, b.birth0, b.birth1, bend * bend, wobble, tree);
    if (b.snowAbove !== undefined && out.normals[i * 3 + 1] > b.snowAbove)
      out.uvs[i * 2 + 1] = snowV;
  }
}

/** Foliage colour of a tree for the season: one atlas column per tuft. */
function foliagePicker(rng: Rng, family: Family, season: Season): () => number {
  const col = swatchColumn;
  const conifer = family.shape === 'conifer';
  const fixed = (name: SwatchName) => () => col(name);
  switch (season) {
    case 'spring': {
      const r = rng.next();
      if (conifer) return fixed(r < 0.3 ? 'Summer' : 'Spring');
      return fixed(r < 0.4 ? 'Blossom' : 'Spring');
    }
    case 'summer':
      return fixed('Summer');
    case 'autumn': {
      const r = rng.next();
      if (conifer) return fixed(r < 0.2 ? 'Gold' : 'Summer');
      if (r < 0.2) return fixed('Gold');
      if (r < 0.42) return fixed('Orange');
      if (r < 0.6) return fixed('Red');
      // Mixed: a colour drawn for each tuft, as in the Blender recipe.
      return () => col(rng.pick(MIXED_AUTUMN));
    }
    case 'winter':
      return fixed('Snow');
  }
}

function broadleafBlobs(
  ctx: TreeContext,
  assets: AssetLibrary,
  sk: Skeleton,
  ages: number[],
  clump: number,
  light: boolean,
  column: () => number,
): void {
  const { rng, family } = ctx;
  // Trees of the forest edge use the lighter KayKit tuft of the family.
  const blobModel = light ? family.sub : family.blob;
  const main = assets.data(blobModel);
  const mainWidth = assets.size(blobModel)[0];
  const withSubs = !light;
  const sub = assets.data(family.sub);
  const subWidth = assets.size(family.sub)[0];
  const kids = sk.children();
  for (let i = 0; i < sk.count; i++) {
    const p = sk.parent[i];
    if (sk.root[i] || kids[i].length > 0 || p < 0) continue;
    const dx = sk.x[i] - sk.x[p];
    const dy = sk.y[i] - sk.y[p];
    const dz = sk.z[i] - sk.z[p];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const cx = sk.x[i] + (dx / dl) * clump * 0.2;
    const cy = sk.y[i] + (dy / dl) * clump * 0.2;
    const cz = sk.z[i] + (dz / dl) * clump * 0.2;
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
    if (withSubs && rng.chance(0.5)) {
      const reach = clump * 0.45;
      blob(ctx, {
        model: sub,
        modelWidth: subWidth,
        x: cx + rng.range(-1, 1) * reach,
        y: cy - Math.abs(rng.range(-1, 1) * reach) * 0.5,
        z: cz + rng.range(-1, 1) * reach,
        width: clump * 0.45,
        squash: 1,
        column: c,
        ...growth,
      });
    }
  }
  if (family.crown > 0) {
    const top = sk.trunkTop;
    blob(ctx, {
      model: main,
      modelWidth: mainWidth,
      x: sk.x[top],
      y: sk.y[top] + clump * 0.3,
      z: sk.z[top],
      width: clump * family.crown,
      squash: family.squash,
      column: column(),
      px: 0,
      py: 0,
      pz: 0,
      birth0: 0.02,
      birth1: ages[top],
    });
  }
}

function coniferBlobs(
  ctx: TreeContext,
  assets: AssetLibrary,
  sk: Skeleton,
  total: number,
  layers: number,
  column: () => number,
): void {
  const { family } = ctx;
  const layer = assets.data(family.blob);
  const layerWidth = assets.size(family.blob)[0];
  const cap = assets.data(family.sub);
  const capWidth = assets.size(family.sub)[0];
  const top = sk.trunkTop;
  const c = column();
  const snowAbove = ctx.season === 'winter' ? 0.3 : undefined;
  let width = family.clump;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = total * (0.24 + 0.58 * t);
    width = family.clump * (1 - 0.64 * t);
    const lean = y / sk.y[top];
    blob(ctx, {
      model: layer,
      modelWidth: layerWidth,
      x: sk.x[top] * lean,
      y,
      z: sk.z[top] * lean,
      width,
      squash: family.squash,
      column: c,
      px: 0,
      py: 0,
      pz: 0,
      birth0: 0.03,
      birth1: Math.min(1, y / total),
      snowAbove,
    });
  }
  const y = total * 0.93;
  const lean = y / sk.y[top];
  blob(ctx, {
    model: cap,
    modelWidth: capWidth,
    x: sk.x[top] * lean,
    y,
    z: sk.z[top] * lean,
    width: width * 0.85,
    squash: 1,
    column: c,
    px: 0,
    py: 0,
    pz: 0,
    birth0: 0.03,
    birth1: 1,
    snowAbove,
  });
}

/**
 * Append a tree to the forest buffers. The same seed always gives the same tree.
 * The tree is built at its full age; the shader cuts it for younger ages.
 */
export function buildTree(
  out: TreeWriter,
  spec: TreeSpec,
  assets: AssetLibrary,
  season: Season,
  treeIndex: number,
): TreeInfo {
  const family = FAMILIES[spec.family];
  const rng = new Rng(hashSeed(spec.seed, spec.family));
  const far = spec.detail === 'far';
  const light = spec.detail !== 'full';
  const firstVertex = out.vertexCount;
  const firstIndex = out.indexCount;
  const conifer = family.shape === 'conifer';
  const clump = family.clump * (conifer ? 1 : far ? 1.45 : light ? 1.3 : 1);
  const depth = far ? 0 : light ? Math.max(1, family.depth - 1) : family.depth;
  const sk = buildSkeleton(
    rng,
    conifer ? { ...family, height: family.height * 0.8 } : family,
    depth,
    !far,
  );
  const ages = sk.ages();
  const total = conifer ? family.height : sk.height() + clump * 0.6;
  const ctx: TreeContext = {
    out,
    rng,
    family,
    season,
    tree: treeIndex,
    top: total,
    sides: far ? 4 : light ? 5 : 6,
  };
  for (const chain of chains(sk)) if (chain.length >= 2) tube(ctx, sk, ages, chain);
  const column = foliagePicker(
    new Rng(hashSeed(spec.seed, `${spec.family}:foliage`)),
    family,
    season,
  );
  if (conifer) coniferBlobs(ctx, assets, sk, total, far ? 3 : light ? 4 : 5, column);
  else broadleafBlobs(ctx, assets, sk, ages, clump, light, column);

  // Local space to world: scale, yaw, translation (pivots too).
  const cos = Math.cos(spec.yaw);
  const sin = Math.sin(spec.yaw);
  const place = (array: Float32Array, i: number, direction: boolean) => {
    const k = direction ? 1 : spec.scale;
    const x = array[i] * k;
    const y = array[i + 1] * k;
    const z = array[i + 2] * k;
    array[i] = x * cos + z * sin + (direction ? 0 : spec.x);
    array[i + 1] = y + (direction ? 0 : spec.y);
    array[i + 2] = -x * sin + z * cos + (direction ? 0 : spec.z);
  };
  for (let i = firstVertex * 3; i < out.vertexCount * 3; i += 3) {
    place(out.positions, i, false);
    place(out.pivots, i, false);
    place(out.normals, i, true);
  }
  return {
    triangles: (out.indexCount - firstIndex) / 3,
    vertices: out.vertexCount - firstVertex,
    height: total * spec.scale,
  };
}
